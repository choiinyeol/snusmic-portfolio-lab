"""Deterministic local strategy evaluator and explicit random search."""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import date
from itertools import product
from typing import Any, cast

import pandas as pd
from pydantic import BaseModel, ConfigDict

from .configs import ParametricSmicFollowerConfig
from .objective import score_metrics


class StrategyMetrics(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    score: float
    final_equity_krw: float
    net_profit_krw: float
    money_weighted_return: float
    cagr: float | None = None
    max_drawdown: float
    trade_count: int
    turnover: float
    average_holding_days: float | None = None
    win_rate: float | None = None
    hit_rate: float | None = None
    max_single_position_weight: float
    open_positions: int
    excess_return_vs_smic_follower: float | None = None
    excess_return_vs_smic_follower_v2: float | None = None
    excess_return_vs_all_weather: float | None = None


@dataclass(frozen=True)
class BaselineReturns:
    smic_follower: float | None = None
    smic_follower_v2: float | None = None
    all_weather: float | None = None


def baseline_returns_from_summary(summary: pd.DataFrame | None) -> BaselineReturns:
    if summary is None or summary.empty or "persona" not in summary.columns:
        return BaselineReturns()

    def _get(persona: str) -> float | None:
        rows = summary[summary["persona"].astype(str) == persona]
        if rows.empty or "money_weighted_return" not in rows.columns:
            return None
        value = pd.to_numeric(rows.iloc[0]["money_weighted_return"], errors="coerce")
        return None if pd.isna(value) else float(value)

    return BaselineReturns(
        smic_follower=_get("smic_follower"),
        smic_follower_v2=_get("smic_follower_v2"),
        all_weather=_get("all_weather"),
    )


def evaluate_strategy(
    config: ParametricSmicFollowerConfig,
    report_performance: pd.DataFrame,
    *,
    baseline_summary: pd.DataFrame | None = None,
    initial_capital_krw: float = 10_000_000.0,
) -> StrategyMetrics:
    """Evaluate a parametric follower from report-performance artifacts."""
    selected = _select_reports(report_performance, config)
    baselines = baseline_returns_from_summary(baseline_summary)
    if selected.empty:
        return StrategyMetrics(
            score=-1.0,
            final_equity_krw=initial_capital_krw,
            net_profit_krw=0.0,
            money_weighted_return=0.0,
            cagr=0.0,
            max_drawdown=0.0,
            trade_count=0,
            turnover=0.0,
            average_holding_days=None,
            win_rate=None,
            hit_rate=None,
            max_single_position_weight=0.0,
            open_positions=0,
            excess_return_vs_smic_follower=_excess(0.0, baselines.smic_follower),
            excess_return_vs_smic_follower_v2=_excess(0.0, baselines.smic_follower_v2),
            excess_return_vs_all_weather=_excess(0.0, baselines.all_weather),
        )

    returns = _strategy_returns(selected, config)
    weights = _position_weights(selected, config)
    weighted_return = float((returns * weights).sum())
    hit_rate = float(selected["target_hit"].astype(bool).mean()) if "target_hit" in selected else None
    wins = returns > 0
    win_rate = float(wins.mean()) if len(wins) else None
    avg_holding_days = _avg_holding_days(selected)
    max_weight = float(weights.max()) if len(weights) else 0.0
    rebalance_factor = 12 if config.rebalance == "monthly" else 4
    turnover = min(4.0, (len(selected) / max(config.max_positions, 1)) * (rebalance_factor / 12))
    max_drawdown = min(0.95, max(0.0, float((-returns[returns < 0]).mean() if (returns < 0).any() else 0.0)))
    concentration_penalty = max(0.0, max_weight - 0.20)
    annual_turnover_penalty = max(0.0, turnover - 1.0)
    mwr = weighted_return
    score = score_metrics(
        money_weighted_return=mwr,
        max_drawdown=max_drawdown,
        annual_turnover_penalty=annual_turnover_penalty,
        concentration_penalty=concentration_penalty,
    )
    final_equity = initial_capital_krw * (1.0 + mwr)
    return StrategyMetrics(
        score=score,
        final_equity_krw=final_equity,
        net_profit_krw=final_equity - initial_capital_krw,
        money_weighted_return=mwr,
        cagr=mwr,
        max_drawdown=max_drawdown,
        trade_count=int(len(selected) * 2),
        turnover=turnover,
        average_holding_days=avg_holding_days,
        win_rate=win_rate,
        hit_rate=hit_rate,
        max_single_position_weight=max_weight,
        open_positions=min(len(selected), config.max_positions),
        excess_return_vs_smic_follower=_excess(mwr, baselines.smic_follower),
        excess_return_vs_smic_follower_v2=_excess(mwr, baselines.smic_follower_v2),
        excess_return_vs_all_weather=_excess(mwr, baselines.all_weather),
    )


def run_random_search(
    report_performance: pd.DataFrame,
    *,
    baseline_summary: pd.DataFrame | None = None,
    trials: int = 20,
    seed: int = 42,
) -> list[dict[str, Any]]:
    """Run deterministic random search without pretending it is an Optuna run."""
    rng = random.Random(seed)
    rows: list[dict[str, Any]] = []
    for trial_number in range(trials):
        config = _sample_config(rng)
        metrics = evaluate_strategy(config, report_performance, baseline_summary=baseline_summary)
        rows.append(_trial_row(trial_number, config, metrics, sampler="random-search"))
    return sorted(rows, key=lambda row: float(row["score"]), reverse=True)


def run_grid_search(
    report_performance: pd.DataFrame,
    *,
    baseline_summary: pd.DataFrame | None = None,
) -> list[dict[str, Any]]:
    """Run a deterministic, interpretable grid of strategy candidates."""
    rows: list[dict[str, Any]] = []
    for trial_number, config in enumerate(_grid_configs()):
        metrics = evaluate_strategy(config, report_performance, baseline_summary=baseline_summary)
        rows.append(_trial_row(trial_number, config, metrics, sampler="grid-search"))
    return sorted(rows, key=lambda row: float(row["score"]), reverse=True)


def run_train_selected_grid_search(
    report_performance: pd.DataFrame,
    *,
    baseline_summary: pd.DataFrame | None = None,
    train_start: date,
    train_end: date,
    full_start: date,
    top_candidates: int = 5,
) -> list[dict[str, Any]]:
    """Select top grid candidates on train dates, then rank them on full/holdout evidence."""
    if train_end < train_start:
        raise ValueError(f"train_end {train_end} must be on or after train_start {train_start}")
    if full_start > train_start:
        raise ValueError(f"full_start {full_start} must be on or before train_start {train_start}")
    if top_candidates < 1:
        raise ValueError("top_candidates must be >= 1")

    train_frame = _filter_publication_window(report_performance, start=train_start, end=train_end)
    full_frame = _filter_publication_window(report_performance, start=full_start, end=None)
    holdout_frame = _filter_publication_window(report_performance, start=_day_after(train_end), end=None)
    if train_frame.empty:
        raise ValueError(f"No report_performance rows in train window {train_start}..{train_end}")
    if full_frame.empty:
        raise ValueError(f"No report_performance rows in full window from {full_start}")

    train_rows: list[tuple[int, ParametricSmicFollowerConfig, StrategyMetrics]] = []
    for trial_number, config in enumerate(_grid_configs()):
        train_metrics = evaluate_strategy(config, train_frame, baseline_summary=baseline_summary)
        train_rows.append((trial_number, config, train_metrics))
    selected = sorted(train_rows, key=lambda item: item[2].score, reverse=True)[:top_candidates]

    rows: list[dict[str, Any]] = []
    for train_rank, (trial_number, config, train_metrics) in enumerate(selected, start=1):
        full_metrics = evaluate_strategy(config, full_frame, baseline_summary=baseline_summary)
        holdout_metrics = (
            evaluate_strategy(config, holdout_frame, baseline_summary=baseline_summary)
            if not holdout_frame.empty
            else None
        )
        robust_score = _robust_score(train_metrics, full_metrics, holdout_metrics)
        row = _trial_row(
            trial_number,
            config,
            full_metrics,
            sampler="train-selected-grid",
            scope="train-selected/full-evaluated",
        )
        row.update(
            {
                "score": robust_score,
                "robust_score": robust_score,
                "selection_rank": train_rank,
                "candidate_pool_size": len(train_rows),
                "selected_candidate_count": len(selected),
                "train_start_date": train_start.isoformat(),
                "train_end_date": train_end.isoformat(),
                "full_start_date": full_start.isoformat(),
                "holdout_start_date": _day_after(train_end).isoformat(),
                "train_score": train_metrics.score,
                "train_money_weighted_return": train_metrics.money_weighted_return,
                "train_max_drawdown": train_metrics.max_drawdown,
                "train_trade_count": train_metrics.trade_count,
                "train_turnover": train_metrics.turnover,
                "full_score": full_metrics.score,
                "full_money_weighted_return": full_metrics.money_weighted_return,
                "full_max_drawdown": full_metrics.max_drawdown,
                "full_trade_count": full_metrics.trade_count,
                "full_turnover": full_metrics.turnover,
                "score_decay": train_metrics.score - full_metrics.score,
                "return_decay": train_metrics.money_weighted_return - full_metrics.money_weighted_return,
            }
        )
        if holdout_metrics is not None:
            row.update(
                {
                    "holdout_score": holdout_metrics.score,
                    "holdout_money_weighted_return": holdout_metrics.money_weighted_return,
                    "holdout_max_drawdown": holdout_metrics.max_drawdown,
                    "holdout_trade_count": holdout_metrics.trade_count,
                    "holdout_turnover": holdout_metrics.turnover,
                    "train_to_holdout_score_decay": train_metrics.score - holdout_metrics.score,
                    "train_to_holdout_return_decay": (
                        train_metrics.money_weighted_return - holdout_metrics.money_weighted_return
                    ),
                }
            )
        rows.append(row)
    return sorted(rows, key=lambda row: float(row["score"]), reverse=True)


def _filter_publication_window(frame: pd.DataFrame, *, start: date, end: date | None) -> pd.DataFrame:
    if frame.empty:
        return frame.copy()
    if "publication_date" not in frame.columns:
        raise ValueError("report_performance must include publication_date for robust selection")
    published = pd.to_datetime(frame["publication_date"], errors="coerce").dt.date
    if published.isna().any():
        raise ValueError("report_performance contains invalid publication_date values")
    mask = published >= start
    if end is not None:
        mask &= published <= end
    return frame.loc[mask].copy()


def _day_after(day: date) -> date:
    return day + pd.Timedelta(days=1).to_pytimedelta()


def _robust_score(
    train_metrics: StrategyMetrics,
    full_metrics: StrategyMetrics,
    holdout_metrics: StrategyMetrics | None,
) -> float:
    holdout_score = full_metrics.score if holdout_metrics is None else holdout_metrics.score
    decay_penalty = max(0.0, train_metrics.score - holdout_score)
    return 0.6 * full_metrics.score + 0.4 * holdout_score - 0.25 * decay_penalty


def _select_reports(frame: pd.DataFrame, config: ParametricSmicFollowerConfig) -> pd.DataFrame:
    if frame.empty:
        return frame.copy()
    selected = frame.copy()
    if config.require_publication_price and "entry_price_krw" in selected.columns:
        selected = selected[pd.to_numeric(selected["entry_price_krw"], errors="coerce").notna()]
    if "target_upside_at_pub" in selected.columns:
        upside = pd.to_numeric(selected["target_upside_at_pub"], errors="coerce")
        selected = selected[
            (upside >= config.min_target_upside_at_pub) & (upside <= config.max_target_upside_at_pub)
        ]
    if "days_to_target" in selected.columns:
        days = pd.to_numeric(selected["days_to_target"], errors="coerce")
        selected = selected[days.isna() | (days <= config.max_report_age_days)]
    if config.universe != "all" and "symbol" in selected.columns:
        is_domestic = selected["symbol"].astype(str).str.endswith(".KS") | selected["symbol"].astype(
            str
        ).str.endswith(".KQ")
        selected = selected[is_domestic] if config.universe == "domestic" else selected[~is_domestic]
    if config.exclude_missing_confidence_rows:
        selected = selected.dropna(subset=["target_upside_at_pub", "current_return"])
    sort_cols = [col for col in ["publication_date", "report_id"] if col in selected.columns]
    if sort_cols:
        selected = selected.sort_values(sort_cols)
    return selected.reset_index(drop=True)


def _strategy_returns(selected: pd.DataFrame, config: ParametricSmicFollowerConfig) -> pd.Series:
    current = pd.to_numeric(
        selected.get("current_return", pd.Series(0.0, index=selected.index)), errors="coerce"
    ).fillna(0.0)
    upside = pd.to_numeric(
        selected.get("target_upside_at_pub", pd.Series(0.0, index=selected.index)), errors="coerce"
    ).fillna(0.0)
    target_return = (upside * config.target_hit_multiplier).clip(upper=config.take_profit_pct)
    hit = selected.get("target_hit", pd.Series(False, index=selected.index)).astype(bool)
    returns = current.where(~hit, target_return)
    returns = returns.clip(lower=-config.stop_loss_pct, upper=config.take_profit_pct)
    if "days_to_target" in selected.columns:
        days = pd.to_numeric(selected["days_to_target"], errors="coerce")
        stale_loss = days.fillna(config.time_loss_days + 1) >= config.time_loss_days
        returns = returns.where(~(stale_loss & (returns < 0)), returns.clip(lower=-config.stop_loss_pct))
    return returns.astype(float)


def _position_weights(selected: pd.DataFrame, config: ParametricSmicFollowerConfig) -> pd.Series:
    if selected.empty:
        return pd.Series(dtype=float)
    if config.weighting == "equal":
        raw = pd.Series(1.0, index=selected.index)
    elif config.weighting in {"target_upside", "capped_target_upside"}:
        raw = (
            pd.to_numeric(
                selected.get("target_upside_at_pub", pd.Series(1.0, index=selected.index)), errors="coerce"
            )
            .fillna(0.0)
            .clip(lower=0.01)
        )
        if config.weighting == "capped_target_upside":
            raw = raw.clip(upper=1.0)
    else:
        trough = (
            pd.to_numeric(
                selected.get("trough_return", pd.Series(-0.2, index=selected.index)), errors="coerce"
            )
            .abs()
            .fillna(0.2)
        )
        raw = 1.0 / trough.clip(lower=0.05)
    total = float(raw.sum())
    if total <= 0:
        return pd.Series(1.0 / len(selected), index=selected.index)
    return raw / total


def _avg_holding_days(selected: pd.DataFrame) -> float | None:
    if "days_to_target" not in selected.columns:
        return None
    days = pd.to_numeric(selected["days_to_target"], errors="coerce").dropna()
    return None if days.empty else float(days.mean())


def _excess(value: float, baseline: float | None) -> float | None:
    return None if baseline is None else value - baseline


def _sample_config(rng: random.Random) -> ParametricSmicFollowerConfig:
    min_upside = _sample_step(rng, 0.05, 0.60, 0.01)
    max_upside = _sample_step(rng, max(0.20, min_upside), 5.0, 0.01)
    return ParametricSmicFollowerConfig(
        target_hit_multiplier=_sample_step(rng, 0.7, 1.2, 0.01),
        min_target_upside_at_pub=min_upside,
        max_target_upside_at_pub=max_upside,
        max_report_age_days=rng.randint(90, 1500),
        time_loss_days=rng.randint(60, 1000),
        stop_loss_pct=_sample_step(rng, 0.05, 0.50, 0.01),
        take_profit_pct=_sample_step(rng, 0.05, 3.0, 0.01),
        rebalance=rng.choice(["monthly", "quarterly"]),
        max_positions=rng.randint(5, 80),
        weighting=rng.choice(["equal", "target_upside", "inverse_volatility", "capped_target_upside"]),
        universe=rng.choice(["all", "domestic", "overseas"]),
        exclude_missing_confidence_rows=rng.choice([False, True]),
        require_publication_price=rng.choice([False, True]),
    )


def _grid_configs() -> list[ParametricSmicFollowerConfig]:
    configs: list[ParametricSmicFollowerConfig] = []
    for (
        min_upside,
        max_report_age_days,
        stop_loss_pct,
        take_profit_pct,
        max_positions,
        weighting,
        universe,
    ) in product(
        [0.10, 0.20, 0.30, 0.50],
        [180, 365, 730, 1095],
        [0.10, 0.20, 0.30],
        [0.50, 1.00, 2.00],
        [10, 20, 40],
        ["equal", "capped_target_upside"],
        ["all", "domestic", "overseas"],
    ):
        configs.append(
            ParametricSmicFollowerConfig(
                target_hit_multiplier=1.0,
                min_target_upside_at_pub=min_upside,
                max_target_upside_at_pub=5.0,
                max_report_age_days=max_report_age_days,
                time_loss_days=min(max_report_age_days, 1000),
                stop_loss_pct=stop_loss_pct,
                take_profit_pct=take_profit_pct,
                rebalance="monthly",
                max_positions=max_positions,
                weighting=cast(Any, weighting),
                universe=cast(Any, universe),
                exclude_missing_confidence_rows=True,
                require_publication_price=True,
            )
        )
    return configs


def _sample_step(rng: random.Random, low: float, high: float, step: float) -> float:
    """Sample a discrete decimal grid and return values rounded to 2 decimals."""
    units_low = round(low / step)
    units_high = round(high / step)
    return round(rng.randint(units_low, units_high) * step, 2)


def _trial_row(
    trial_number: int,
    config: ParametricSmicFollowerConfig,
    metrics: StrategyMetrics,
    *,
    sampler: str,
    scope: str = "in-sample",
) -> dict[str, Any]:
    return {
        "trial_number": trial_number,
        "sampler": sampler,
        "scope": scope,
        **config.model_dump(mode="json"),
        **metrics.model_dump(mode="json"),
    }
