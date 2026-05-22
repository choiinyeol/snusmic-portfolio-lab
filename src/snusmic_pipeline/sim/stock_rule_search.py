"""Stock-level rule search with explicit in-sample and OOS admission gates.

This module deliberately searches *stock rules*, not meta-persona overlays.  A
candidate rule ranks individual report symbols using only prices and report
fields available at the rebalance close, shifts the selected weights by one
trading day, and then admits candidates only after a separate out-of-sample
replay.  The row outputs keep reason metadata so downstream artifacts can show
why a candidate was accepted or rejected.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence

# Pandas/numpy vectorized search code is intentionally dataframe-heavy.  Keep
# the public dataclasses typed and avoid forcing broad casts through every
# vectorized intermediate.
# mypy: disable-error-code="arg-type,assignment,return-value,dict-item,call-overload,type-arg,misc,union-attr,index"
from dataclasses import asdict, dataclass, field
from datetime import date
from math import isfinite, sqrt
from pathlib import Path
from typing import Any, Literal

import numpy as np
import pandas as pd

from .market import PriceBoard
from .runner import _prepare_reports
from .target_adjustment import align_report_targets_to_market_scale
from .warehouse import read_table

RuleFamily = Literal[
    "target_upside_momentum",
    "fresh_report_momentum",
    "target_gap_reversal",
    "price_momentum",
    "ma_crossover",
    "rsi_reversal",
]
RebalanceCadence = Literal["D", "W", "M"]
WeightMode = Literal["equal", "rank_linear", "winner_compress", "score_proportional"]
ScoreMode = Literal[
    "dynamic_upside", "blend", "momentum_blend", "reversal_gap", "price_momentum", "ma_cross", "rsi_reversal"
]


@dataclass(frozen=True)
class StockRuleConfig:
    """A stock-level ranking rule replayable in IS and OOS windows."""

    rule_id: str
    family: RuleFamily
    fast_ma_days: int
    slow_ma_days: int
    min_report_age_days: int
    max_report_age_days: int
    rebalance: RebalanceCadence
    top_pool: int
    hold_top: int
    weight_mode: WeightMode
    score_mode: ScoreMode
    min_dynamic_upside: float = 0.0
    min_momentum_return: float = -1.0
    min_pullback_pct: float = 0.0
    coverage_failure_trading_days: int = 0
    min_return_21d: float = -1.0
    min_return_63d: float = -1.0
    min_return_126d: float = -1.0
    min_distance_from_52w_high: float = -1.0
    require_ma_stack: bool = False
    hold_target_winners: bool = False
    target_winner_trailing_stop_pct: float = 0.0
    target_carry_ma_days: int = 0
    risk_off_ma_days: int = 0
    risk_off_symbol: str = "069500.KS"
    fallback_symbol: str = ""

    def to_row(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class StockRuleSearchResult:
    """Search/admission result with accepted configs and full audit rows."""

    configs: tuple[StockRuleConfig, ...]
    trial_rows: pd.DataFrame


@dataclass(frozen=True)
class _PreparedWindow:
    close: pd.DataFrame
    columns: tuple[str, ...]
    report_state: dict[str, np.ndarray]
    returns: np.ndarray
    moving_average_cache: dict[int, np.ndarray] = field(default_factory=dict, compare=False)
    indicator_cache: dict[str, np.ndarray] = field(default_factory=dict, compare=False)
    rebalance_cache: dict[RebalanceCadence, np.ndarray] = field(default_factory=dict, compare=False)


@dataclass(frozen=True)
class _PreparedMarket:
    close: pd.DataFrame
    high: pd.DataFrame
    trading_calendar: pd.DatetimeIndex
    reports: pd.DataFrame
    window_cache: dict[tuple[date, date], _PreparedWindow] = field(default_factory=dict, compare=False)


@dataclass(frozen=True)
class _Evaluation:
    config: StockRuleConfig
    metrics: dict[str, float | int]
    current_holdings: dict[str, float]
    daily_returns: np.ndarray
    status: str
    reasons: tuple[str, ...]
    reason_metadata: dict[str, Any]

    @property
    def passed_activity_gate(self) -> bool:
        return self.status != "insufficient_activity"


DEFAULT_MIN_OBSERVATIONS = 60
DEFAULT_MIN_NONCASH_FRACTION = 0.05


def search_is(
    *,
    warehouse_dir: Path,
    start_date: date,
    end_date: date,
    configs: Sequence[StockRuleConfig] | None = None,
    top_n: int = 50,
    min_observations: int = DEFAULT_MIN_OBSERVATIONS,
    min_noncash_fraction: float = DEFAULT_MIN_NONCASH_FRACTION,
) -> StockRuleSearchResult:
    """Rank stock-rule configs on an in-sample window.

    The function performs no OOS admission.  It returns the top in-sample
    configs that generated enough shifted, non-cash observations to be replayed
    by :func:`admit_oos`.
    """

    prepared = _load_market(warehouse_dir, start_date, end_date)
    candidates = tuple(configs or default_stock_rule_configs())
    evaluations = [
        _evaluate_config(
            prepared,
            config,
            start_date=start_date,
            end_date=end_date,
            min_observations=min_observations,
            min_noncash_fraction=min_noncash_fraction,
        )
        for config in candidates
    ]
    rows = [_search_row(ev, prefix="is") for ev in evaluations]
    frame = pd.DataFrame(rows)
    if frame.empty:
        return StockRuleSearchResult(configs=(), trial_rows=frame)
    frame = frame.sort_values(
        ["is_rank_score", "is_total_return", "rule_id"], ascending=[False, False, True]
    ).reset_index(drop=True)
    replayable = [
        _config_from_row(row) for row in frame.to_dict("records") if row.get("is_status") == "searched"
    ]
    if top_n > 0:
        replayable = replayable[:top_n]
    return StockRuleSearchResult(configs=tuple(replayable), trial_rows=frame)


def admit_oos(
    *,
    warehouse_dir: Path,
    configs: Sequence[StockRuleConfig] | StockRuleSearchResult,
    is_start: date,
    is_end: date,
    oos_start: date,
    oos_end: date,
    benchmark_total_return: float = 0.0,
    top_n: int = 0,
    min_oos_excess_return: float = 0.0,
    min_is_total_return: float = 0.0,
    min_is_sharpe: float | None = None,
    min_oos_sharpe: float | None = None,
    min_observations: int = DEFAULT_MIN_OBSERVATIONS,
    min_noncash_fraction: float = DEFAULT_MIN_NONCASH_FRACTION,
) -> StockRuleSearchResult:
    """Replay candidate stock rules OOS and admit validation-quality rules.

    ``benchmark_total_return`` is retained as comparative metadata only.  A rule
    is accepted when it passes activity gates in both windows, optional IS/OOS
    metric gates, and is not a near duplicate of an earlier accepted rule.  A
    validation window can lag the benchmark without being disqualified because
    benchmark-relative return is a portfolio-selection context, not a hard stock
    rule contract.
    """

    candidate_configs = configs.configs if isinstance(configs, StockRuleSearchResult) else tuple(configs)
    if not candidate_configs:
        return StockRuleSearchResult(configs=(), trial_rows=pd.DataFrame())

    start = min(is_start, oos_start)
    end = max(is_end, oos_end)
    prepared = _load_market(warehouse_dir, start, end)
    rows: list[dict[str, Any]] = []
    accepted: list[StockRuleConfig] = []
    seen_behaviors: set[tuple[float, float, int, str]] = set()
    oos_daily_returns: dict[str, list[float]] = {}

    for config in candidate_configs:
        is_eval = _evaluate_config(
            prepared,
            config,
            start_date=is_start,
            end_date=is_end,
            min_observations=min_observations,
            min_noncash_fraction=min_noncash_fraction,
        )
        oos_eval = _evaluate_config(
            prepared,
            config,
            start_date=oos_start,
            end_date=oos_end,
            min_observations=min_observations,
            min_noncash_fraction=min_noncash_fraction,
        )
        oos_daily_returns[config.rule_id] = [
            float(value) for value in oos_eval.daily_returns if isfinite(float(value))
        ]
        status, reasons, metadata = _admission_decision(
            is_eval=is_eval,
            oos_eval=oos_eval,
            benchmark_total_return=benchmark_total_return,
            min_oos_excess_return=min_oos_excess_return,
            min_is_total_return=min_is_total_return,
            min_is_sharpe=min_is_sharpe,
            min_oos_sharpe=min_oos_sharpe,
            seen_behaviors=seen_behaviors,
        )
        accepted_flag = status == "accepted"
        if accepted_flag:
            accepted.append(config)
            seen_behaviors.add(_behavior_key(oos_eval))
        row = {
            **config.to_row(),
            **_metrics_with_prefix(is_eval.metrics, "is"),
            **_metrics_with_prefix(oos_eval.metrics, "oos"),
            "accepted": accepted_flag,
            "admission_status": status,
            "admission_reasons": list(reasons),
            "reason_metadata": metadata,
            "is_reason_metadata": is_eval.reason_metadata,
            "oos_reason_metadata": oos_eval.reason_metadata,
            "current_holdings": oos_eval.current_holdings,
        }
        rows.append(row)
        if top_n > 0 and len(accepted) >= top_n:
            # Keep rows up to the point where the requested admission count was
            # reached; callers that need every rejection can pass top_n=0.
            break

    frame = pd.DataFrame(rows)
    if not frame.empty:
        frame = frame.sort_values(
            ["accepted", "oos_total_return", "oos_annualized_sharpe", "rule_id"],
            ascending=[False, False, False, True],
        ).reset_index(drop=True)
        frame.attrs["oos_daily_returns"] = oos_daily_returns
    return StockRuleSearchResult(configs=tuple(accepted), trial_rows=frame)


def default_stock_rule_configs() -> tuple[StockRuleConfig, ...]:
    """Return a deterministic, bounded stock-rule family grid."""

    configs: list[StockRuleConfig] = []
    ma_pairs = ((5, 20), (10, 30), (20, 60))
    age_windows = ((0, 60), (7, 120), (30, 365))
    pool_shapes = ((3, (1, 2)), (5, (3,)), (10, (5,)))
    for family in ("target_upside_momentum", "fresh_report_momentum", "target_gap_reversal"):
        for fast, slow in ma_pairs:
            for min_age, max_age in age_windows:
                for rebalance in ("D", "W", "M"):
                    for top_pool, hold_choices in pool_shapes:
                        for hold_top in hold_choices:
                            for weight_mode in ("equal", "winner_compress"):
                                score_modes: tuple[ScoreMode, ...]
                                if family == "target_gap_reversal":
                                    score_modes = ("reversal_gap",)
                                elif family == "fresh_report_momentum":
                                    score_modes = ("momentum_blend",)
                                else:
                                    score_modes = ("dynamic_upside", "blend")
                                for score_mode in score_modes:
                                    min_pullback = 0.03 if family == "target_gap_reversal" else 0.0
                                    min_momentum = 0.0 if family == "fresh_report_momentum" else -1.0
                                    configs.append(
                                        _config(
                                            family=family,
                                            fast_ma_days=fast,
                                            slow_ma_days=slow,
                                            min_report_age_days=min_age,
                                            max_report_age_days=max_age,
                                            rebalance=rebalance,
                                            top_pool=top_pool,
                                            hold_top=hold_top,
                                            weight_mode=weight_mode,
                                            score_mode=score_mode,
                                            min_dynamic_upside=0.0,
                                            min_momentum_return=min_momentum,
                                            min_pullback_pct=min_pullback,
                                            coverage_failure_trading_days=0,
                                            min_return_21d=-0.20,
                                            min_return_63d=-0.10 if family == "target_gap_reversal" else 0.0,
                                            min_return_126d=-0.20,
                                            min_distance_from_52w_high=-0.40
                                            if family == "target_gap_reversal"
                                            else -0.30,
                                            require_ma_stack=family != "target_gap_reversal",
                                            hold_target_winners=True,
                                            target_winner_trailing_stop_pct=0.25,
                                            target_carry_ma_days=60,
                                            risk_off_ma_days=120,
                                            fallback_symbol="069500.KS",
                                        )
                                    )

    price_families: tuple[tuple[RuleFamily, ScoreMode], ...] = (
        ("price_momentum", "price_momentum"),
        ("ma_crossover", "ma_cross"),
        ("rsi_reversal", "rsi_reversal"),
    )
    price_ma_pairs = ((3, 10), (5, 20), (10, 30), (15, 45), (20, 60), (30, 90), (50, 150))
    for family, score_mode in price_families:
        for fast, slow in price_ma_pairs:
            for rebalance in ("D", "W", "M"):
                for top_pool, hold_choices in ((5, (3,)), (10, (5,)), (20, (5, 10))):
                    for hold_top in hold_choices:
                        for weight_mode in ("equal", "winner_compress"):
                            configs.append(
                                _config(
                                    family=family,
                                    fast_ma_days=fast,
                                    slow_ma_days=slow,
                                    min_report_age_days=0,
                                    max_report_age_days=3650,
                                    rebalance=rebalance,
                                    top_pool=top_pool,
                                    hold_top=hold_top,
                                    weight_mode=weight_mode,
                                    score_mode=score_mode,
                                    min_dynamic_upside=0.0,
                                    min_momentum_return=0.0 if family != "rsi_reversal" else -1.0,
                                    min_pullback_pct=0.0,
                                    coverage_failure_trading_days=500,
                                    min_return_21d=-0.10,
                                    min_return_63d=0.0 if family != "rsi_reversal" else -0.15,
                                    min_return_126d=-0.05,
                                    min_distance_from_52w_high=-0.30,
                                    require_ma_stack=family != "rsi_reversal",
                                    hold_target_winners=True,
                                    target_winner_trailing_stop_pct=0.22,
                                    target_carry_ma_days=60,
                                    risk_off_ma_days=120,
                                    fallback_symbol="069500.KS",
                                )
                            )
    return tuple(configs)


def _config(
    *,
    family: RuleFamily,
    fast_ma_days: int,
    slow_ma_days: int,
    min_report_age_days: int,
    max_report_age_days: int,
    rebalance: RebalanceCadence,
    top_pool: int,
    hold_top: int,
    weight_mode: WeightMode,
    score_mode: ScoreMode,
    min_dynamic_upside: float,
    min_momentum_return: float,
    min_pullback_pct: float,
    coverage_failure_trading_days: int,
    min_return_21d: float,
    min_return_63d: float,
    min_return_126d: float,
    min_distance_from_52w_high: float,
    require_ma_stack: bool,
    hold_target_winners: bool,
    target_winner_trailing_stop_pct: float,
    target_carry_ma_days: int,
    risk_off_ma_days: int,
    fallback_symbol: str,
) -> StockRuleConfig:
    failure_suffix = f"_fail{coverage_failure_trading_days}t" if coverage_failure_trading_days > 0 else ""
    quality_suffix = (
        f"_q21{_pct_token(min_return_21d)}"
        f"_q63{_pct_token(min_return_63d)}"
        f"_q126{_pct_token(min_return_126d)}"
        f"_hi{_pct_token(min_distance_from_52w_high)}"
    )
    stack_suffix = "_stack" if require_ma_stack else ""
    carry_suffix = (
        f"_carry{_pct_token(target_winner_trailing_stop_pct)}ma{target_carry_ma_days}"
        if hold_target_winners
        else ""
    )
    risk_suffix = f"_risk{risk_off_ma_days}" if risk_off_ma_days > 0 else ""
    fallback_suffix = f"_fb{_safe_token(fallback_symbol)}" if fallback_symbol else ""
    rule_id = (
        f"{family}_ma{fast_ma_days}_{slow_ma_days}_{rebalance}"
        f"_age{min_report_age_days}-{max_report_age_days}"
        f"{failure_suffix}_pool{top_pool}_hold{hold_top}_{weight_mode}_{score_mode}"
        f"{quality_suffix}{stack_suffix}{carry_suffix}{risk_suffix}{fallback_suffix}"
    )
    return StockRuleConfig(
        rule_id=rule_id,
        family=family,
        fast_ma_days=fast_ma_days,
        slow_ma_days=slow_ma_days,
        min_report_age_days=min_report_age_days,
        max_report_age_days=max_report_age_days,
        rebalance=rebalance,
        top_pool=top_pool,
        hold_top=hold_top,
        weight_mode=weight_mode,
        score_mode=score_mode,
        min_dynamic_upside=min_dynamic_upside,
        min_momentum_return=min_momentum_return,
        min_pullback_pct=min_pullback_pct,
        coverage_failure_trading_days=coverage_failure_trading_days,
        min_return_21d=min_return_21d,
        min_return_63d=min_return_63d,
        min_return_126d=min_return_126d,
        min_distance_from_52w_high=min_distance_from_52w_high,
        require_ma_stack=require_ma_stack,
        hold_target_winners=hold_target_winners,
        target_winner_trailing_stop_pct=target_winner_trailing_stop_pct,
        target_carry_ma_days=target_carry_ma_days,
        risk_off_ma_days=risk_off_ma_days,
        fallback_symbol=fallback_symbol,
    )


def _pct_token(value: float) -> str:
    scaled = int(round(value * 100))
    return f"m{abs(scaled)}" if scaled < 0 else str(scaled)


def _safe_token(value: str) -> str:
    return "".join(ch.lower() for ch in value if ch.isalnum())


def _load_market(warehouse_dir: Path, start_date: date, end_date: date) -> _PreparedMarket:
    board = PriceBoard.from_warehouse(warehouse_dir)
    if board.is_empty:
        raise RuntimeError(f"Warehouse {warehouse_dir} has no daily_prices rows; cannot search stock rules.")
    full_close = board.close.ffill(limit=3).dropna(how="all")
    close = full_close.loc[
        (full_close.index >= pd.Timestamp(start_date)) & (full_close.index <= pd.Timestamp(end_date))
    ].copy()
    if len(close) < 2:
        raise RuntimeError(f"Not enough price rows in {start_date}..{end_date} to search stock rules.")

    if board.high is not None:
        high = board.high.reindex(index=full_close.index, columns=full_close.columns).copy()
    else:
        high = full_close.copy()
    high = high.where(high.notna(), full_close)

    reports = read_table(warehouse_dir, "reports")
    reports = _prepare_reports(reports, start_date, end_date)
    reports = align_report_targets_to_market_scale(reports, board, end_date)
    reports = _prepare_stock_reports(reports, board)
    return _PreparedMarket(
        close=close, high=high, trading_calendar=pd.DatetimeIndex(full_close.index), reports=reports
    )


def _prepared_window(prepared: _PreparedMarket, start_date: date, end_date: date) -> _PreparedWindow:
    """Cache point-in-time invariant arrays for one evaluation window."""

    key = (start_date, end_date)
    cached = prepared.window_cache.get(key)
    if cached is not None:
        return cached

    close = prepared.close.loc[
        (prepared.close.index >= pd.Timestamp(start_date)) & (prepared.close.index <= pd.Timestamp(end_date))
    ].copy()
    close = close.dropna(how="all")
    columns = tuple(close.columns)
    report_state = _report_state_matrices(
        close.index,
        list(columns),
        prepared.reports,
        prepared.high,
        trading_calendar=prepared.trading_calendar,
    )
    returns = (
        close.pct_change(fill_method=None).replace([np.inf, -np.inf], np.nan).fillna(0.0).to_numpy(float)
    )
    window = _PreparedWindow(close=close, columns=columns, report_state=report_state, returns=returns)
    prepared.window_cache[key] = window
    return window


def _prepare_stock_reports(reports: pd.DataFrame, board: PriceBoard) -> pd.DataFrame:
    if reports.empty:
        return pd.DataFrame(
            columns=[
                "report_id",
                "symbol",
                "publication_date",
                "target_price_krw",
                "report_current_price_krw",
            ]
        )
    frame = reports.copy()
    frame["publication_date"] = pd.to_datetime(frame["publication_date"], errors="coerce").dt.tz_localize(
        None
    )
    frame["symbol"] = frame["symbol"].astype(str)
    if "report_id" not in frame.columns:
        frame["report_id"] = [f"report-{idx}" for idx in range(len(frame))]
    frame["report_id"] = frame["report_id"].astype(str)
    target_source = frame["target_price_krw"] if "target_price_krw" in frame else frame.get("target_price")
    frame["target_price_krw"] = pd.to_numeric(target_source, errors="coerce")
    if "report_current_price_krw" in frame:
        frame["report_current_price_krw"] = pd.to_numeric(frame["report_current_price_krw"], errors="coerce")
    else:
        frame["report_current_price_krw"] = np.nan
    missing_current = frame["report_current_price_krw"].isna() | frame["report_current_price_krw"].le(0)
    if missing_current.any():
        filled: list[float] = []
        for row in frame.loc[missing_current].itertuples(index=False):
            pub = row.publication_date
            symbol = str(row.symbol)
            value = board.asof(pub.date(), symbol) if pd.notna(pub) else None
            filled.append(float(value) if value is not None and value > 0 else np.nan)
        frame.loc[missing_current, "report_current_price_krw"] = filled
    frame = frame.dropna(
        subset=["symbol", "publication_date", "target_price_krw", "report_current_price_krw"]
    )
    frame = frame[(frame["target_price_krw"] > 0) & (frame["report_current_price_krw"] > 0)]
    frame["static_upside"] = frame["target_price_krw"] / frame["report_current_price_krw"] - 1.0
    return frame.sort_values(["publication_date", "report_id"]).reset_index(drop=True)


def _evaluate_config(
    prepared: _PreparedMarket,
    config: StockRuleConfig,
    *,
    start_date: date,
    end_date: date,
    min_observations: int,
    min_noncash_fraction: float,
) -> _Evaluation:
    window = _prepared_window(prepared, start_date, end_date)
    close = window.close
    if len(close) < 2:
        return _empty_evaluation(config, "insufficient_activity", "not_enough_price_rows")

    columns = list(window.columns)
    if not columns:
        return _empty_evaluation(config, "insufficient_activity", "no_price_symbols")

    weights, rebalance_weights = _weights_for_config(
        close,
        window.report_state,
        config,
        moving_average_cache=window.moving_average_cache,
        indicator_cache=window.indicator_cache,
        rebalance_cache=window.rebalance_cache,
    )
    if weights.size == 0:
        return _empty_evaluation(config, "insufficient_activity", "no_rebalance_rows")

    start_idx = 1
    portfolio_returns = np.sum(weights * window.returns, axis=1)[start_idx:]
    active = np.sum(weights, axis=1) > 0
    metrics = _metrics(
        portfolio_returns,
        active_days=int(active[start_idx:].sum()),
        noncash_fraction=float(active[start_idx:].mean()) if len(active[start_idx:]) else 0.0,
        avg_positions=float(np.mean(np.sum(weights[start_idx:] > 0, axis=1)))
        if len(weights[start_idx:])
        else 0.0,
        avg_turnover_per_rebalance=_avg_turnover(rebalance_weights),
    )
    reasons: list[str] = []
    if int(metrics["observations"]) < min_observations:
        reasons.append("below_min_observations")
    if float(metrics["noncash_fraction"]) < min_noncash_fraction:
        reasons.append("below_min_noncash_fraction")
    status = "insufficient_activity" if reasons else "searched"
    return _Evaluation(
        config=config,
        metrics=metrics,
        current_holdings=_current_holdings(columns, weights),
        daily_returns=portfolio_returns,
        status=status,
        reasons=tuple(reasons),
        reason_metadata={
            "min_observations": min_observations,
            "min_noncash_fraction": min_noncash_fraction,
            "decision_lag": "rebalance close signal shifted one trading day before returns are earned",
        },
    )


def _report_state_matrices(
    dates: pd.DatetimeIndex,
    columns: list[str],
    reports: pd.DataFrame,
    high: pd.DataFrame | None = None,
    *,
    trading_calendar: pd.DatetimeIndex | None = None,
) -> dict[str, np.ndarray]:
    dates = pd.DatetimeIndex(dates)
    n_days = len(dates)
    n_symbols = len(columns)
    target = np.full((n_days, n_symbols), np.nan)
    static_upside = np.full((n_days, n_symbols), np.nan)
    report_age = np.full((n_days, n_symbols), np.nan)
    trading_age = np.full((n_days, n_symbols), np.nan)
    target_touched = np.full((n_days, n_symbols), False)
    target_touch_trading_age = np.full((n_days, n_symbols), np.inf)
    if n_days == 0 or reports.empty:
        return {
            "target": target,
            "static_upside": static_upside,
            "report_age": report_age,
            "trading_age": trading_age,
            "target_touched": target_touched,
            "target_touch_trading_age": target_touch_trading_age,
        }

    ordinal_dates = dates.values.astype("datetime64[D]").astype(np.int64)
    if trading_calendar is None:
        trading_calendar = pd.DatetimeIndex(high.index) if high is not None else dates
    calendar = pd.DatetimeIndex(trading_calendar).sort_values().unique()
    calendar_ord = calendar.values.astype("datetime64[D]").astype(np.int64)
    if len(calendar_ord) == 0:
        calendar = dates
        calendar_ord = ordinal_dates
    date_calendar_pos = np.searchsorted(calendar_ord, ordinal_dates, side="left")
    exact_dates = (date_calendar_pos < len(calendar_ord)) & (
        calendar_ord[np.minimum(date_calendar_pos, len(calendar_ord) - 1)] == ordinal_dates
    )
    by_symbol = {symbol: idx for idx, symbol in enumerate(columns)}
    high_np = high.reindex(index=calendar, columns=columns).to_numpy(float) if high is not None else None
    for symbol, group in reports.groupby("symbol", sort=False):
        col_idx = by_symbol.get(str(symbol))
        if col_idx is None:
            continue
        group = group.sort_values("publication_date")
        pub_ord = pd.to_datetime(group["publication_date"]).values.astype("datetime64[D]").astype(np.int64)
        if len(pub_ord) == 0:
            continue
        idx = np.searchsorted(pub_ord, ordinal_dates, side="right") - 1
        ok = idx >= 0
        target_values = group["target_price_krw"].to_numpy(float)
        static_values = group["static_upside"].to_numpy(float)
        target[ok, col_idx] = target_values[idx[ok]]
        static_upside[ok, col_idx] = static_values[idx[ok]]
        report_age[ok, col_idx] = ordinal_dates[ok] - pub_ord[idx[ok]]
        out_positions = np.searchsorted(ordinal_dates, pub_ord, side="left")
        calendar_positions = np.searchsorted(calendar_ord, pub_ord, side="left")
        for report_idx, out_start in enumerate(out_positions):
            out_end = int(out_positions[report_idx + 1]) if report_idx + 1 < len(out_positions) else n_days
            if out_start >= n_days or out_end <= out_start:
                continue
            out_start = max(0, int(out_start))
            out_end = min(n_days, out_end)
            segment_calendar_pos = date_calendar_pos[out_start:out_end]
            start_calendar_pos = max(0, int(calendar_positions[report_idx]))
            trading_age[out_start:out_end, col_idx] = np.where(
                exact_dates[out_start:out_end] & (segment_calendar_pos >= start_calendar_pos),
                segment_calendar_pos - start_calendar_pos,
                np.nan,
            )
            if high_np is None:
                observed = np.zeros(out_end - out_start, dtype=bool)
                touch_age = np.full(out_end - out_start, np.inf)
            else:
                end_calendar_pos = (
                    int(calendar_positions[report_idx + 1])
                    if report_idx + 1 < len(calendar_positions)
                    else len(calendar_ord)
                )
                end_calendar_pos = max(start_calendar_pos, min(len(calendar_ord), end_calendar_pos))
                calendar_observed = (
                    high_np[start_calendar_pos:end_calendar_pos, col_idx] >= target_values[report_idx]
                )
                calendar_observed = np.where(
                    np.isfinite(high_np[start_calendar_pos:end_calendar_pos, col_idx]),
                    calendar_observed,
                    False,
                )
                touched_so_far = np.maximum.accumulate(calendar_observed)
                touch_positions = np.flatnonzero(calendar_observed)
                first_touch_age = float(touch_positions[0]) if len(touch_positions) > 0 else np.inf
                lookup = segment_calendar_pos - start_calendar_pos
                observed = np.zeros(out_end - out_start, dtype=bool)
                valid_lookup = exact_dates[out_start:out_end] & (lookup >= 0) & (lookup < len(touched_so_far))
                observed[valid_lookup] = touched_so_far[lookup[valid_lookup]]
                touch_age = np.full(out_end - out_start, np.inf)
                touch_age[valid_lookup & observed] = first_touch_age
            target_touched[out_start:out_end, col_idx] = observed
            target_touch_trading_age[out_start:out_end, col_idx] = touch_age
    return {
        "target": target,
        "static_upside": static_upside,
        "report_age": report_age,
        "trading_age": trading_age,
        "target_touched": target_touched,
        "target_touch_trading_age": target_touch_trading_age,
    }


def _weights_for_config(
    close: pd.DataFrame,
    report_state: Mapping[str, np.ndarray],
    config: StockRuleConfig,
    *,
    moving_average_cache: dict[int, np.ndarray] | None = None,
    indicator_cache: dict[str, np.ndarray] | None = None,
    rebalance_cache: dict[RebalanceCadence, np.ndarray] | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    n_days, n_symbols = close.shape
    close_np = close.to_numpy(float)
    fast_ma = _moving_average(close, config.fast_ma_days, moving_average_cache)
    slow_ma = _moving_average(close, config.slow_ma_days, moving_average_cache)
    return_21d = _period_return(close, 21, indicator_cache)
    return_63d = _period_return(close, 63, indicator_cache)
    return_126d = _period_return(close, 126, indicator_cache)
    high_252d = _rolling_high(close, 252, indicator_cache)
    with np.errstate(divide="ignore", invalid="ignore"):
        dynamic_upside = report_state["target"] / close_np - 1.0
        momentum = close_np / slow_ma - 1.0
        pullback = fast_ma / close_np - 1.0
        ma_spread = fast_ma / slow_ma - 1.0
        distance_from_high = close_np / high_252d - 1.0

    rsi = _rsi_14(close, indicator_cache)

    age = report_state["report_age"]
    trading_age = report_state["trading_age"]
    target_touched = report_state["target_touched"].astype(bool)
    target_touch_trading_age = report_state.get("target_touch_trading_age")
    if target_touch_trading_age is None:
        target_touch_trading_age = np.full_like(trading_age, np.inf, dtype=float)
    static_upside = report_state["static_upside"]
    trend = close_np > slow_ma
    report_family = config.family in {
        "target_upside_momentum",
        "fresh_report_momentum",
        "target_gap_reversal",
    }
    if config.family in {"target_upside_momentum", "fresh_report_momentum", "price_momentum", "ma_crossover"}:
        trend &= fast_ma >= slow_ma
    if config.family == "target_gap_reversal":
        trend = pullback >= config.min_pullback_pct

    if config.score_mode == "dynamic_upside":
        score = dynamic_upside
    elif config.score_mode == "momentum_blend":
        score = 0.45 * dynamic_upside + 0.20 * static_upside + 0.70 * momentum
    elif config.score_mode == "reversal_gap":
        score = 0.65 * dynamic_upside + 0.50 * pullback + 0.10 * static_upside
    elif config.score_mode == "price_momentum":
        score = momentum
    elif config.score_mode == "ma_cross":
        score = 0.70 * ma_spread + 0.30 * momentum
    elif config.score_mode == "rsi_reversal":
        score = (45.0 - rsi) / 45.0 + 0.20 * momentum
        trend = (rsi <= 45.0) & (close_np >= slow_ma * 0.90)
    else:
        score = 0.65 * dynamic_upside + 0.25 * static_upside + 0.35 * momentum

    loser_quarantine = (
        _threshold_ok(return_21d, config.min_return_21d)
        & _threshold_ok(return_63d, config.min_return_63d)
        & _threshold_ok(return_126d, config.min_return_126d)
        & _threshold_ok(distance_from_high, config.min_distance_from_52w_high)
    )
    if config.require_ma_stack:
        ma20 = _moving_average(close, 20, moving_average_cache)
        ma60 = _moving_average(close, 60, moving_average_cache)
        ma120 = _moving_average(close, 120, moving_average_cache)
        loser_quarantine &= (close_np >= ma20) & (ma20 >= ma60) & (ma60 >= ma120)

    carry_ok = np.full((n_days, n_symbols), False)
    if config.hold_target_winners:
        carry_ok = target_touched & (close_np >= slow_ma) & np.isfinite(momentum)
        if config.target_carry_ma_days > 0:
            carry_ma = _moving_average(close, config.target_carry_ma_days, moving_average_cache)
            carry_ok &= close_np >= carry_ma
        if config.target_winner_trailing_stop_pct > 0:
            carry_peak = _rolling_high(close, 63, indicator_cache)
            carry_ok &= close_np >= carry_peak * (1.0 - config.target_winner_trailing_stop_pct)
        score = np.where(
            carry_ok & (dynamic_upside < config.min_dynamic_upside),
            0.65 * momentum + 0.35 * ma_spread + 0.10 * static_upside,
            score,
        )

    # Every stock rule ranks symbols that entered the investable universe via a
    # published research report.  Even price-only families must therefore wait
    # until the first publication date; otherwise a later report would leak the
    # symbol into an earlier rebalance.
    coverage_live = np.isfinite(age)
    if config.coverage_failure_trading_days > 0:
        timely_target_touch = target_touched & (
            target_touch_trading_age <= config.coverage_failure_trading_days
        )
        coverage_live = coverage_live & (
            timely_target_touch
            | (np.isfinite(trading_age) & (trading_age <= config.coverage_failure_trading_days))
        )

    valid = (
        trend
        & np.isfinite(score)
        & coverage_live
        & loser_quarantine
        & (momentum >= config.min_momentum_return)
        & (age >= config.min_report_age_days)
        & (age <= config.max_report_age_days)
    )
    if report_family:
        upside_ok = np.isfinite(dynamic_upside) & (dynamic_upside >= config.min_dynamic_upside)
        valid = valid & (upside_ok | carry_ok)
    risk_on = _risk_on_mask(close, config, moving_average_cache)
    if risk_on is not None:
        valid = valid & risk_on[:, None]
    rebalance_indices = _cached_rebalance_indices(close.index, config.rebalance, rebalance_cache)
    if len(rebalance_indices) == 0:
        return np.zeros((n_days, n_symbols)), np.zeros((0, n_symbols))

    rebalance_weights: list[np.ndarray] = []
    fallback_idx = (
        list(close.columns).index(config.fallback_symbol) if config.fallback_symbol in close.columns else None
    )
    for day_idx in rebalance_indices:
        weights = np.zeros(n_symbols)
        day_score = np.where(valid[day_idx], score[day_idx], np.nan)
        ok = np.flatnonzero(np.isfinite(day_score))
        if ok.size:
            selected = ok[np.argsort(day_score[ok])[::-1]][: config.top_pool][: config.hold_top]
            if selected.size:
                weights[selected] = _selected_weights(day_score[selected], config.weight_mode)
        if weights.sum() <= 0 and fallback_idx is not None and (risk_on is None or bool(risk_on[day_idx])):
            weights[fallback_idx] = 1.0
        rebalance_weights.append(weights)

    rebalance_matrix = np.vstack(rebalance_weights)
    daily_weights = np.zeros((n_days, n_symbols))
    cursor = 0
    current = np.zeros(n_symbols)
    for day_idx in range(n_days):
        while cursor < len(rebalance_indices) and rebalance_indices[cursor] == day_idx:
            current = rebalance_matrix[cursor]
            cursor += 1
        if day_idx + 1 < n_days:
            daily_weights[day_idx + 1] = current
    return daily_weights, rebalance_matrix


def _moving_average(
    close: pd.DataFrame,
    days: int,
    cache: dict[int, np.ndarray] | None,
) -> np.ndarray:
    cached = cache.get(days) if cache is not None else None
    if cached is not None:
        return cached
    values = close.rolling(days, min_periods=max(3, days // 2)).mean().to_numpy(float)
    if cache is not None:
        cache[days] = values
    return values


def _period_return(
    close: pd.DataFrame,
    days: int,
    cache: dict[str, np.ndarray] | None,
) -> np.ndarray:
    key = f"return_{days}"
    cached = cache.get(key) if cache is not None else None
    if cached is not None:
        return cached
    values = (
        close.pct_change(periods=days, fill_method=None).replace([np.inf, -np.inf], np.nan).to_numpy(float)
    )
    if cache is not None:
        cache[key] = values
    return values


def _threshold_ok(values: np.ndarray, minimum: float) -> np.ndarray:
    if minimum <= -1.0:
        return np.full(values.shape, True)
    return np.isfinite(values) & (values >= minimum)


def _rolling_high(
    close: pd.DataFrame,
    days: int,
    cache: dict[str, np.ndarray] | None,
) -> np.ndarray:
    key = f"rolling_high_{days}"
    cached = cache.get(key) if cache is not None else None
    if cached is not None:
        return cached
    values = close.rolling(days, min_periods=3).max().to_numpy(float)
    if cache is not None:
        cache[key] = values
    return values


def _risk_on_mask(
    close: pd.DataFrame,
    config: StockRuleConfig,
    moving_average_cache: dict[int, np.ndarray] | None,
) -> np.ndarray | None:
    if config.risk_off_ma_days <= 0:
        return None
    if config.risk_off_symbol in close.columns:
        symbol_idx = list(close.columns).index(config.risk_off_symbol)
        ma = _moving_average(close, config.risk_off_ma_days, moving_average_cache)
        close_np = close.to_numpy(float)
        return close_np[:, symbol_idx] >= ma[:, symbol_idx]
    long_ma = _moving_average(close, config.risk_off_ma_days, moving_average_cache)
    with np.errstate(divide="ignore", invalid="ignore"):
        breadth = np.nanmean(close.to_numpy(float) >= long_ma, axis=1)
    return breadth >= 0.40


def _rsi_14(close: pd.DataFrame, cache: dict[str, np.ndarray] | None) -> np.ndarray:
    cached = cache.get("rsi_14") if cache is not None else None
    if cached is not None:
        return cached
    returns_frame = close.pct_change(fill_method=None).replace([np.inf, -np.inf], np.nan)
    losses = (-returns_frame.clip(upper=0)).rolling(14, min_periods=7).mean().to_numpy(float)
    gains = returns_frame.clip(lower=0).rolling(14, min_periods=7).mean().to_numpy(float)
    with np.errstate(divide="ignore", invalid="ignore"):
        rsi = 100.0 - (100.0 / (1.0 + gains / losses))
    rsi = np.where((losses == 0) & np.isfinite(gains), 100.0, rsi)
    if cache is not None:
        cache["rsi_14"] = rsi
    return rsi


def _cached_rebalance_indices(
    index: pd.DatetimeIndex,
    cadence: RebalanceCadence,
    cache: dict[RebalanceCadence, np.ndarray] | None,
) -> np.ndarray:
    cached = cache.get(cadence) if cache is not None else None
    if cached is not None:
        return cached
    indices = _rebalance_indices(index, cadence)
    if cache is not None:
        cache[cadence] = indices
    return indices


def _rebalance_indices(index: pd.DatetimeIndex, cadence: RebalanceCadence) -> np.ndarray:
    if cadence == "D":
        return np.arange(len(index), dtype=int)
    freq = "W-FRI" if cadence == "W" else "ME"
    positions: list[int] = []
    frame = pd.DataFrame(index=index)
    for _, group in frame.groupby(pd.Grouper(freq=freq)):
        if len(group):
            positions.append(index.get_loc(group.index[-1]))
    return np.array(positions, dtype=int)


def _selected_weights(scores: np.ndarray, mode: WeightMode) -> np.ndarray:
    n = len(scores)
    if n == 0:
        return np.array([], dtype=float)
    if mode == "equal":
        return np.repeat(1.0 / n, n)
    if mode == "rank_linear":
        values = np.arange(n, 0, -1, dtype=float)
        return values / values.sum()
    if mode == "winner_compress":
        if n == 1:
            return np.array([1.0], dtype=float)
        values = np.repeat(0.45 / (n - 1), n)
        values[0] = 0.55
        return values
    finite = np.maximum(np.nan_to_num(scores, nan=0.0, posinf=0.0, neginf=0.0), 0.0)
    total = float(finite.sum())
    if total <= 0:
        return np.repeat(1.0 / n, n)
    return finite / total


def _metrics(
    daily_returns: np.ndarray,
    *,
    active_days: int,
    noncash_fraction: float,
    avg_positions: float,
    avg_turnover_per_rebalance: float,
) -> dict[str, float | int]:
    returns = daily_returns[np.isfinite(daily_returns)]
    observations = int(len(returns))
    if observations == 0:
        return {
            "observations": 0,
            "total_return": 0.0,
            "annualized_return": 0.0,
            "annualized_volatility": 0.0,
            "annualized_sharpe": 0.0,
            "annualized_sortino": 0.0,
            "max_drawdown": 0.0,
            "active_days": active_days,
            "noncash_fraction": noncash_fraction,
            "avg_positions": avg_positions,
            "avg_turnover_per_rebalance": avg_turnover_per_rebalance,
        }
    equity = np.cumprod(1.0 + returns)
    total_return = float(equity[-1] - 1.0)
    annualized_return = float(equity[-1] ** (252.0 / observations) - 1.0) if equity[-1] > 0 else -1.0
    annualized_vol = float(returns.std(ddof=1) * sqrt(252.0)) if observations > 1 else 0.0
    downside_returns = returns[returns < 0]
    downside = float(downside_returns.std(ddof=1) * sqrt(252.0)) if len(downside_returns) > 1 else 0.0
    peak = np.maximum.accumulate(equity)
    max_drawdown = float(np.min(equity / peak - 1.0)) if len(peak) else 0.0
    return {
        "observations": observations,
        "total_return": total_return,
        "annualized_return": annualized_return,
        "annualized_volatility": annualized_vol,
        "annualized_sharpe": annualized_return / annualized_vol if annualized_vol > 0 else 0.0,
        "annualized_sortino": annualized_return / downside if downside > 0 else 0.0,
        "max_drawdown": max_drawdown,
        "active_days": active_days,
        "noncash_fraction": noncash_fraction,
        "avg_positions": avg_positions,
        "avg_turnover_per_rebalance": avg_turnover_per_rebalance,
    }


def _avg_turnover(rebalance_weights: np.ndarray) -> float:
    if len(rebalance_weights) <= 1:
        return 0.0
    return float(np.mean(np.sum(np.abs(np.diff(rebalance_weights, axis=0)), axis=1)))


def _current_holdings(columns: list[str], weights: np.ndarray) -> dict[str, float]:
    if weights.size == 0:
        return {}
    latest = weights[-1]
    return {
        columns[idx]: float(latest[idx])
        for idx in np.argsort(latest)[::-1]
        if latest[idx] > 0 and isfinite(float(latest[idx]))
    }


def _empty_evaluation(config: StockRuleConfig, status: str, reason: str) -> _Evaluation:
    return _Evaluation(
        config=config,
        metrics=_metrics(
            np.array([], dtype=float),
            active_days=0,
            noncash_fraction=0.0,
            avg_positions=0.0,
            avg_turnover_per_rebalance=0.0,
        ),
        current_holdings={},
        daily_returns=np.array([], dtype=float),
        status=status,
        reasons=(reason,),
        reason_metadata={
            "failure_reason": reason,
            "decision_lag": "rebalance close signal shifted one trading day before returns are earned",
        },
    )


def _search_row(evaluation: _Evaluation, *, prefix: str) -> dict[str, Any]:
    return {
        **evaluation.config.to_row(),
        f"{prefix}_status": evaluation.status,
        f"{prefix}_reasons": list(evaluation.reasons),
        f"{prefix}_reason_metadata": evaluation.reason_metadata,
        f"{prefix}_rank_score": _rank_score(evaluation.metrics),
        **_metrics_with_prefix(evaluation.metrics, prefix),
        "current_holdings": evaluation.current_holdings,
    }


def _metrics_with_prefix(metrics: Mapping[str, float | int], prefix: str) -> dict[str, float | int]:
    return {f"{prefix}_{key}": value for key, value in metrics.items()}


def _rank_score(metrics: Mapping[str, float | int]) -> float:
    return (
        float(metrics.get("annualized_sharpe", 0.0))
        + 0.50 * float(metrics.get("annualized_sortino", 0.0))
        + 0.25 * float(metrics.get("total_return", 0.0))
        + 0.20 * float(metrics.get("noncash_fraction", 0.0))
        + 0.20 * float(metrics.get("max_drawdown", 0.0))
    )


def _admission_decision(
    *,
    is_eval: _Evaluation,
    oos_eval: _Evaluation,
    benchmark_total_return: float,
    min_oos_excess_return: float,
    min_is_total_return: float,
    min_is_sharpe: float | None,
    min_oos_sharpe: float | None,
    seen_behaviors: set[tuple[float, float, int, str]],
) -> tuple[str, tuple[str, ...], dict[str, Any]]:
    reasons: list[str] = []
    if not is_eval.passed_activity_gate:
        reasons.extend(f"is_{reason}" for reason in is_eval.reasons)
    if not oos_eval.passed_activity_gate:
        reasons.extend(f"oos_{reason}" for reason in oos_eval.reasons)
    if float(is_eval.metrics["total_return"]) < min_is_total_return:
        reasons.append("below_is_total_return")
    if min_is_sharpe is not None and float(is_eval.metrics["annualized_sharpe"]) < min_is_sharpe:
        reasons.append("below_is_sharpe")
    if min_oos_sharpe is not None and float(oos_eval.metrics["annualized_sharpe"]) < min_oos_sharpe:
        reasons.append("below_oos_sharpe")

    behavior_key = _behavior_key(oos_eval)
    if behavior_key in seen_behaviors:
        reasons.append("duplicate_oos_behavior")

    status = "accepted" if not reasons else _primary_rejection(reasons)
    required_oos = benchmark_total_return + min_oos_excess_return
    metadata = {
        "benchmark_total_return": benchmark_total_return,
        "min_oos_excess_return": min_oos_excess_return,
        "required_oos_total_return": required_oos,
        "benchmark_gate_enabled": False,
        "min_is_total_return": min_is_total_return,
        "min_is_sharpe": min_is_sharpe,
        "min_oos_sharpe": min_oos_sharpe,
        "is_status": is_eval.status,
        "oos_status": oos_eval.status,
        "decision_lag": "rebalance close signal shifted one trading day before returns are earned",
    }
    return status, tuple(reasons), metadata


def _primary_rejection(reasons: Sequence[str]) -> str:
    for prefix, status in (
        ("is_", "failed_is_activity_gate"),
        ("oos_", "failed_oos_activity_gate"),
    ):
        if any(reason.startswith(prefix) for reason in reasons):
            return status
    if "below_oos_benchmark" in reasons:
        return "below_oos_benchmark"
    if "duplicate_oos_behavior" in reasons:
        return "duplicate_oos_behavior"
    if any(reason.startswith("below_is") for reason in reasons):
        return "below_is_gate"
    if any(reason.startswith("below_oos") for reason in reasons):
        return "below_oos_gate"
    return "rejected"


def _behavior_key(evaluation: _Evaluation) -> tuple[float, float, int, str]:
    holdings_key = ",".join(sorted(evaluation.current_holdings))
    return (
        round(float(evaluation.metrics["total_return"]), 6),
        round(float(evaluation.metrics["max_drawdown"]), 6),
        int(evaluation.metrics["active_days"]),
        holdings_key,
    )


def _config_from_row(row: Mapping[str, Any]) -> StockRuleConfig:
    return StockRuleConfig(
        rule_id=str(row["rule_id"]),
        family=row["family"],
        fast_ma_days=int(row["fast_ma_days"]),
        slow_ma_days=int(row["slow_ma_days"]),
        min_report_age_days=int(row["min_report_age_days"]),
        max_report_age_days=int(row["max_report_age_days"]),
        rebalance=row["rebalance"],
        top_pool=int(row["top_pool"]),
        hold_top=int(row["hold_top"]),
        weight_mode=row["weight_mode"],
        score_mode=row["score_mode"],
        min_dynamic_upside=float(row.get("min_dynamic_upside", 0.0)),
        min_momentum_return=float(row.get("min_momentum_return", -1.0)),
        min_pullback_pct=float(row.get("min_pullback_pct", 0.0)),
        coverage_failure_trading_days=int(row.get("coverage_failure_trading_days") or 0),
        min_return_21d=float(row.get("min_return_21d", -1.0)),
        min_return_63d=float(row.get("min_return_63d", -1.0)),
        min_return_126d=float(row.get("min_return_126d", -1.0)),
        min_distance_from_52w_high=float(row.get("min_distance_from_52w_high", -1.0)),
        require_ma_stack=_boolish(row.get("require_ma_stack", False)),
        hold_target_winners=_boolish(row.get("hold_target_winners", False)),
        target_winner_trailing_stop_pct=float(row.get("target_winner_trailing_stop_pct", 0.0)),
        target_carry_ma_days=int(row.get("target_carry_ma_days") or 0),
        risk_off_ma_days=int(row.get("risk_off_ma_days") or 0),
        risk_off_symbol=str(row.get("risk_off_symbol") or "069500.KS"),
        fallback_symbol=str(row.get("fallback_symbol") or ""),
    )


def _boolish(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y"}
    return bool(value)
