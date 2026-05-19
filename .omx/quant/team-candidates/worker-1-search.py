#!/usr/bin/env python3
"""Worker 1 moving-average crossover / top-N compression search.

Local-only inputs: data/warehouse/daily_prices.csv and reports.csv.
Signals are formed with report rows and prices known by the rebalance close;
weights are shifted one trading day before returns are earned.
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd


def _metrics(daily_returns: np.ndarray) -> dict[str, float | int]:
    r = daily_returns[np.isfinite(daily_returns)]
    if len(r) < 100:
        raise ValueError("not enough observations")
    equity = np.cumprod(1.0 + r)
    annualized_return = float(equity[-1] ** (252 / len(r)) - 1.0)
    annualized_vol = float(r.std(ddof=1) * math.sqrt(252))
    downside = r[r < 0].std(ddof=1) * math.sqrt(252) if np.sum(r < 0) > 1 else np.nan
    peak = np.maximum.accumulate(equity)
    return {
        "observations": int(len(r)),
        "annualized_return": annualized_return,
        "annualized_volatility": annualized_vol,
        "annualized_sharpe": float(annualized_return / annualized_vol)
        if annualized_vol > 0
        else float("nan"),
        "annualized_sortino": float(annualized_return / downside)
        if np.isfinite(downside) and downside > 0
        else float("nan"),
        "max_drawdown": float(np.min(equity / peak - 1.0)),
        "total_return": float(equity[-1] - 1.0),
        "daily_mean": float(r.mean()),
        "daily_std": float(r.std(ddof=1)),
    }


def run_search(repo: Path) -> dict[str, object]:
    prices = pd.read_csv(
        repo / "data/warehouse/daily_prices.csv", usecols=["date", "symbol", "split_adjusted_close"]
    )
    reports = pd.read_csv(repo / "data/warehouse/reports.csv")
    prices["date"] = pd.to_datetime(prices["date"])
    reports["publication_date"] = pd.to_datetime(reports["publication_date"])
    reports = reports.dropna(
        subset=["symbol", "publication_date", "target_price_krw", "report_current_price_krw"]
    )
    reports = reports[(reports["target_price_krw"] > 0) & (reports["report_current_price_krw"] > 0)].copy()
    reports["static_upside"] = reports["target_price_krw"] / reports["report_current_price_krw"] - 1.0

    symbols = sorted(set(reports["symbol"]) & set(prices["symbol"]))
    prices = prices[prices["symbol"].isin(symbols)].dropna(subset=["split_adjusted_close"])
    close_frame = (
        prices.pivot_table(index="date", columns="symbol", values="split_adjusted_close", aggfunc="last")
        .sort_index()
        .ffill(limit=3)
        .dropna(how="all")
    )
    columns = list(close_frame.columns)
    dates = close_frame.index
    n_days = len(dates)
    n_symbols = len(columns)
    close = close_frame.to_numpy(float)
    returns = np.nan_to_num(
        close_frame.pct_change(fill_method=None).to_numpy(float), nan=0.0, posinf=0.0, neginf=0.0
    )

    ordinal_dates = dates.values.astype("datetime64[D]").astype(np.int64)
    target = np.full((n_days, n_symbols), np.nan)
    static_upside = np.full((n_days, n_symbols), np.nan)
    report_age = np.full((n_days, n_symbols), np.nan)
    for col_idx, symbol in enumerate(columns):
        group = reports[reports["symbol"] == symbol].sort_values("publication_date")
        if group.empty:
            continue
        pub_ord = group["publication_date"].values.astype("datetime64[D]").astype(np.int64)
        idx = np.searchsorted(pub_ord, ordinal_dates, side="right") - 1
        ok = idx >= 0
        target[ok, col_idx] = group["target_price_krw"].to_numpy(float)[idx[ok]]
        static_upside[ok, col_idx] = group["static_upside"].to_numpy(float)[idx[ok]]
        report_age[ok, col_idx] = ordinal_dates[ok] - pub_ord[idx[ok]]

    ma_windows = [5, 10, 20, 30, 50, 60, 100, 120, 200]
    moving_averages = {
        window: close_frame.rolling(window, min_periods=max(3, window // 2)).mean().to_numpy(float)
        for window in ma_windows
    }
    rebalance_indices: dict[str, np.ndarray] = {"D": np.arange(n_days)}
    for key, freq in [("W", "W-FRI"), ("M", "ME")]:
        idxs: list[int] = []
        for _, group in close_frame.groupby(pd.Grouper(freq=freq)):
            if len(group):
                idxs.append(close_frame.index.get_loc(group.index[-1]))
        rebalance_indices[key] = np.array(idxs, dtype=int)

    def evaluate(
        fast: int,
        slow: int,
        min_age: int,
        max_age: int,
        rebalance: str,
        top_pool: int,
        hold_top: int,
        weight_mode: str,
        score_mode: str,
    ) -> dict[str, object] | None:
        trend = (close > moving_averages[fast]) & (moving_averages[fast] > moving_averages[slow])
        dynamic_upside = target / close - 1.0
        momentum = close / moving_averages[slow] - 1.0
        if score_mode == "dynamic_upside":
            score = dynamic_upside
        elif score_mode == "blend":
            score = 0.7 * dynamic_upside + 0.3 * static_upside + 0.2 * momentum
        elif score_mode == "momentum_blend":
            score = 0.5 * dynamic_upside + 0.2 * static_upside + 0.6 * momentum
        else:
            raise ValueError(score_mode)
        valid = trend & (report_age >= min_age) & (report_age <= max_age) & np.isfinite(score) & (score > 0)
        rebalance_rows: list[np.ndarray] = []
        idxs = rebalance_indices[rebalance]
        for day_idx in idxs:
            day_score = np.where(valid[day_idx], score[day_idx], np.nan)
            ok = np.flatnonzero(np.isfinite(day_score))
            weights = np.zeros(n_symbols)
            if ok.size:
                selected = ok[np.argsort(day_score[ok])[::-1]][:top_pool][:hold_top]
                if selected.size:
                    if weight_mode == "equal":
                        values = np.repeat(1.0 / selected.size, selected.size)
                    elif weight_mode == "rank_linear":
                        values = np.arange(selected.size, 0, -1, dtype=float)
                        values = values / values.sum()
                    elif weight_mode == "winner_compress":
                        values = np.repeat((1.0 - 0.55) / max(selected.size - 1, 1), selected.size)
                        values[0] = 1.0 if selected.size == 1 else 0.55
                    else:
                        raise ValueError(weight_mode)
                    weights[selected] = values
            rebalance_rows.append(weights)
        rebalance_weights = np.vstack(rebalance_rows)
        daily_weights = np.zeros((n_days, n_symbols))
        cursor = 0
        current = np.zeros(n_symbols)
        for day_idx in range(n_days):
            while cursor < len(idxs) and idxs[cursor] == day_idx:
                current = rebalance_weights[cursor]
                cursor += 1
            if day_idx + 1 < n_days:
                daily_weights[day_idx + 1] = current
        portfolio_returns = np.sum(daily_weights * returns, axis=1)[idxs[0] + 1 :]
        metrics = _metrics(portfolio_returns)
        active = np.sum(daily_weights, axis=1) > 0
        if int(active.sum()) < 60 or float(active.mean()) < 0.10:
            return None
        last_weights = rebalance_weights[-1]
        return {
            "candidate_id": (
                f"w1_ma{fast}_{slow}_{rebalance}_age{min_age}-{max_age}_"
                f"pool{top_pool}_hold{hold_top}_{weight_mode}_{score_mode}"
            ),
            "family": "moving_average_crossover_top_pool_compression",
            "params": {
                "fast_ma_days": fast,
                "slow_ma_days": slow,
                "min_report_age_days": min_age,
                "max_report_age_days": max_age,
                "rebalance": rebalance,
                "top_pool": top_pool,
                "hold_top": hold_top,
                "weight_mode": weight_mode,
                "score_mode": score_mode,
                "decision_lag": "one trading day; rebalance close signal earns next trading-day return",
            },
            "metrics": {
                **metrics,
                "active_days": int(active.sum()),
                "noncash_fraction": float(active.mean()),
                "avg_positions": float(np.mean(np.sum(daily_weights > 0, axis=1))),
                "avg_turnover_per_rebalance": float(
                    np.mean(np.sum(np.abs(np.diff(rebalance_weights, axis=0)), axis=1))
                )
                if len(rebalance_weights) > 1
                else 0.0,
            },
            "current_holdings": {
                columns[j]: float(last_weights[j])
                for j in np.argsort(last_weights)[::-1]
                if last_weights[j] > 0
            },
            "highlight": bool(metrics["annualized_sharpe"] >= 2.0 or metrics["annualized_sortino"] >= 2.0),
        }

    param_grid: list[tuple[int, int, int, int, str, int, int, str, str]] = []
    for fast, slow in [(5, 20), (10, 30), (20, 60), (50, 200)]:
        for min_age, max_age in [(0, 60), (3, 90), (7, 120), (14, 180), (30, 365)]:
            for rebalance in ["D", "W", "M"]:
                for top_pool, hold_choices in [(3, [1, 2, 3]), (5, [1, 3]), (10, [3, 5])]:
                    for hold_top in hold_choices:
                        for weight_mode in ["equal", "winner_compress"]:
                            for score_mode in ["dynamic_upside", "blend"]:
                                param_grid.append(
                                    (
                                        fast,
                                        slow,
                                        min_age,
                                        max_age,
                                        rebalance,
                                        top_pool,
                                        hold_top,
                                        weight_mode,
                                        score_mode,
                                    )
                                )
    candidates = [candidate for params in param_grid if (candidate := evaluate(*params)) is not None]
    candidates.sort(
        key=lambda row: (
            max(row["metrics"]["annualized_sharpe"], row["metrics"]["annualized_sortino"]),
            row["metrics"]["annualized_return"],
        ),
        reverse=True,
    )
    return {
        "schema_version": 1,
        "worker": "worker-1",
        "task_id": "1",
        "generated_at": datetime.now(UTC).isoformat(),
        "data_sources": ["data/warehouse/daily_prices.csv", "data/warehouse/reports.csv"],
        "methodology": "Long-only report-upside ranking gated by fast>slow moving-average crossover; top-pool compression selects/weights top candidates and shifts weights one trading day before returns.",
        "success_threshold": "annualized_sharpe >= 2.0 OR annualized_sortino >= 2.0",
        "metric_definitions": {
            "annualized_return": "geometric CAGR from daily portfolio returns with 252 trading-day annualization",
            "annualized_sharpe": "annualized_return / annualized_volatility; zero-return cash days included",
            "annualized_sortino": "annualized_return / annualized downside standard deviation; zero-return cash days included",
            "max_drawdown": "minimum cumulative-equity drawdown, negative number",
        },
        "searched_grid_size": len(param_grid),
        "candidate_count": len(candidates),
        "goal_hit_count": sum(1 for candidate in candidates if candidate["highlight"]),
        "best_metrics": candidates[0]["metrics"] if candidates else None,
        "top_candidates": candidates[:25],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    result = run_search(args.repo.resolve())
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "out": str(args.out),
                "candidate_count": result["candidate_count"],
                "goal_hit_count": result["goal_hit_count"],
                "best_metrics": result["best_metrics"],
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
