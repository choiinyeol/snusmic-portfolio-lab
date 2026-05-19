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
from dataclasses import asdict, dataclass
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
]
RebalanceCadence = Literal["D", "W", "M"]
WeightMode = Literal["equal", "rank_linear", "winner_compress", "score_proportional"]
ScoreMode = Literal["dynamic_upside", "blend", "momentum_blend", "reversal_gap"]


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

    def to_row(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class StockRuleSearchResult:
    """Search/admission result with accepted configs and full audit rows."""

    configs: tuple[StockRuleConfig, ...]
    trial_rows: pd.DataFrame


@dataclass(frozen=True)
class _PreparedMarket:
    close: pd.DataFrame
    reports: pd.DataFrame


@dataclass(frozen=True)
class _Evaluation:
    config: StockRuleConfig
    metrics: dict[str, float | int]
    current_holdings: dict[str, float]
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
    """Replay candidate stock rules OOS and admit benchmark-beating rules.

    ``benchmark_total_return`` is the OOS hurdle.  A rule is accepted only if it
    passed activity gates in both windows, passed optional IS/OOS metric gates,
    beat ``benchmark_total_return + min_oos_excess_return``, and was not a near
    duplicate of an earlier accepted rule.
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
) -> StockRuleConfig:
    rule_id = (
        f"{family}_ma{fast_ma_days}_{slow_ma_days}_{rebalance}"
        f"_age{min_report_age_days}-{max_report_age_days}"
        f"_pool{top_pool}_hold{hold_top}_{weight_mode}_{score_mode}"
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
    )


def _load_market(warehouse_dir: Path, start_date: date, end_date: date) -> _PreparedMarket:
    board = PriceBoard.from_warehouse(warehouse_dir)
    if board.is_empty:
        raise RuntimeError(f"Warehouse {warehouse_dir} has no daily_prices rows; cannot search stock rules.")
    close = board.close.loc[
        (board.close.index >= pd.Timestamp(start_date)) & (board.close.index <= pd.Timestamp(end_date))
    ].copy()
    close = close.ffill(limit=3).dropna(how="all")
    if len(close) < 2:
        raise RuntimeError(f"Not enough price rows in {start_date}..{end_date} to search stock rules.")

    reports = read_table(warehouse_dir, "reports")
    reports = _prepare_reports(reports, start_date, end_date)
    reports = align_report_targets_to_market_scale(reports, board, end_date)
    reports = _prepare_stock_reports(reports, board)
    return _PreparedMarket(close=close, reports=reports)


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
    close = prepared.close.loc[
        (prepared.close.index >= pd.Timestamp(start_date)) & (prepared.close.index <= pd.Timestamp(end_date))
    ].copy()
    close = close.dropna(how="all")
    if len(close) < 2:
        return _empty_evaluation(config, "insufficient_activity", "not_enough_price_rows")

    columns = list(close.columns)
    if not columns:
        return _empty_evaluation(config, "insufficient_activity", "no_price_symbols")

    report_state = _report_state_matrices(close.index, columns, prepared.reports)
    returns = (
        close.pct_change(fill_method=None).replace([np.inf, -np.inf], np.nan).fillna(0.0).to_numpy(float)
    )
    weights, rebalance_weights = _weights_for_config(close, report_state, config)
    if weights.size == 0:
        return _empty_evaluation(config, "insufficient_activity", "no_rebalance_rows")

    start_idx = 1
    portfolio_returns = np.sum(weights * returns, axis=1)[start_idx:]
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
) -> dict[str, np.ndarray]:
    n_days = len(dates)
    n_symbols = len(columns)
    target = np.full((n_days, n_symbols), np.nan)
    static_upside = np.full((n_days, n_symbols), np.nan)
    report_age = np.full((n_days, n_symbols), np.nan)
    if reports.empty:
        return {"target": target, "static_upside": static_upside, "report_age": report_age}

    ordinal_dates = dates.values.astype("datetime64[D]").astype(np.int64)
    by_symbol = {symbol: idx for idx, symbol in enumerate(columns)}
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
    return {"target": target, "static_upside": static_upside, "report_age": report_age}


def _weights_for_config(
    close: pd.DataFrame,
    report_state: Mapping[str, np.ndarray],
    config: StockRuleConfig,
) -> tuple[np.ndarray, np.ndarray]:
    n_days, n_symbols = close.shape
    close_np = close.to_numpy(float)
    fast_ma = (
        close.rolling(config.fast_ma_days, min_periods=max(3, config.fast_ma_days // 2))
        .mean()
        .to_numpy(float)
    )
    slow_ma = (
        close.rolling(config.slow_ma_days, min_periods=max(3, config.slow_ma_days // 2))
        .mean()
        .to_numpy(float)
    )
    with np.errstate(divide="ignore", invalid="ignore"):
        dynamic_upside = report_state["target"] / close_np - 1.0
        momentum = close_np / slow_ma - 1.0
        pullback = fast_ma / close_np - 1.0

    age = report_state["report_age"]
    static_upside = report_state["static_upside"]
    trend = close_np > slow_ma
    if config.family in {"target_upside_momentum", "fresh_report_momentum"}:
        trend &= fast_ma >= slow_ma
    if config.family == "target_gap_reversal":
        trend = pullback >= config.min_pullback_pct

    if config.score_mode == "dynamic_upside":
        score = dynamic_upside
    elif config.score_mode == "momentum_blend":
        score = 0.45 * dynamic_upside + 0.20 * static_upside + 0.70 * momentum
    elif config.score_mode == "reversal_gap":
        score = 0.65 * dynamic_upside + 0.50 * pullback + 0.10 * static_upside
    else:
        score = 0.65 * dynamic_upside + 0.25 * static_upside + 0.35 * momentum

    valid = (
        trend
        & np.isfinite(score)
        & np.isfinite(dynamic_upside)
        & np.isfinite(age)
        & (dynamic_upside >= config.min_dynamic_upside)
        & (momentum >= config.min_momentum_return)
        & (age >= config.min_report_age_days)
        & (age <= config.max_report_age_days)
    )
    rebalance_indices = _rebalance_indices(close.index, config.rebalance)
    if len(rebalance_indices) == 0:
        return np.zeros((n_days, n_symbols)), np.zeros((0, n_symbols))

    rebalance_weights: list[np.ndarray] = []
    for day_idx in rebalance_indices:
        weights = np.zeros(n_symbols)
        day_score = np.where(valid[day_idx], score[day_idx], np.nan)
        ok = np.flatnonzero(np.isfinite(day_score))
        if ok.size:
            selected = ok[np.argsort(day_score[ok])[::-1]][: config.top_pool][: config.hold_top]
            if selected.size:
                weights[selected] = _selected_weights(day_score[selected], config.weight_mode)
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
        status=status,
        reasons=(reason,),
        reason_metadata={},
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

    required_oos = benchmark_total_return + min_oos_excess_return
    if float(oos_eval.metrics["total_return"]) <= required_oos:
        reasons.append("below_oos_benchmark")
    behavior_key = _behavior_key(oos_eval)
    if behavior_key in seen_behaviors:
        reasons.append("duplicate_oos_behavior")

    status = "accepted" if not reasons else _primary_rejection(reasons)
    metadata = {
        "benchmark_total_return": benchmark_total_return,
        "min_oos_excess_return": min_oos_excess_return,
        "required_oos_total_return": required_oos,
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
    )
