"""Shared writers for simulation artifacts.

This module is deliberately boring: it serializes a completed
``SimulationResult``. Older discovery code used to own this module, which made the
daily runner depend on the exploratory lane. Keep artifact writing independent
from research workflows.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from .contracts import SimulationConfig, SimulationResult
from .decision_ledger import build_daily_decision_ledger
from .visualize import (
    plot_drawdowns,
    plot_equity_curves,
    plot_net_profit_bars,
    plot_portfolio_composition,
)

ROUND_NDIGITS = 4


def write_simulation_artifacts(result: SimulationResult, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    (out / "accounts.json").write_text(
        json.dumps(_round_floats(_accounts_manifest(result)), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (out / "account-configs.json").write_text(
        json.dumps(_account_config_artifact(result.config), ensure_ascii=False, indent=2, sort_keys=True)
        + "\n",
        encoding="utf-8",
    )
    _to_csv_rounded(pd.DataFrame([s.model_dump() for s in result.summaries]), out / "summary.csv")
    _to_csv_rounded(pd.DataFrame([p.model_dump() for p in result.equity_points]), out / "equity_daily.csv")
    _to_csv_rounded(pd.DataFrame([t.model_dump() for t in result.trades]), out / "trades.csv")
    _to_csv_rounded(build_daily_decision_ledger(result), out / "daily_decisions.csv")
    _to_csv_rounded(
        pd.DataFrame([e.model_dump() for e in result.position_episodes]), out / "position_episodes.csv"
    )
    _to_csv_rounded(
        pd.DataFrame([h.model_dump() for h in result.current_holdings]), out / "current_holdings.csv"
    )
    _to_csv_rounded(pd.DataFrame([s.model_dump() for s in result.symbol_stats]), out / "symbol_stats.csv")
    _to_csv_rounded(
        pd.DataFrame([m.model_dump() for m in result.monthly_holdings]), out / "monthly_holdings.csv"
    )
    _to_csv_rounded(
        pd.DataFrame([p.model_dump() for p in result.report_performance]), out / "report_performance.csv"
    )
    (out / "verification_cases.json").write_text(
        json.dumps(_round_floats([case.model_dump(mode="json") for case in result.verification_cases]), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (out / "alpha_hypotheses.json").write_text(
        json.dumps(_round_floats([alpha.model_dump(mode="json") for alpha in result.alpha_hypotheses]), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    if result.report_stats is not None:
        (out / "report_stats.json").write_text(
            json.dumps(
                _round_floats(result.report_stats.model_dump(mode="json")), ensure_ascii=False, indent=2
            ),
            encoding="utf-8",
        )
    plot_equity_curves(result, out / "equity_curves.png")
    plot_net_profit_bars(result, out / "net_profit_bar.png")
    plot_drawdowns(result, out / "drawdowns.png")
    if result.monthly_holdings:
        plot_portfolio_composition(result, out / "portfolio_composition.png")


def _account_config_artifact(config: SimulationConfig) -> dict[str, object]:
    return {
        "schema_version": "1.0.0",
        "accounts": [_round_floats(account_id.model_dump(mode="json")) for account_id in config.accounts],
    }


def _accounts_manifest(result: SimulationResult) -> dict[str, object]:
    return {
        "schema_version": "1.0.0",
        "artifact": "simulation-accounts-manifest",
        "description": "Detailed simulation ledgers are stored in sibling CSV artifacts.",
        "account_count": len(result.summaries),
        "equity_point_count": len(result.equity_points),
        "trade_count": len(result.trades),
        "position_episode_count": len(result.position_episodes),
        "current_holding_count": len(result.current_holdings),
        "symbol_stat_count": len(result.symbol_stats),
        "monthly_holding_count": len(result.monthly_holdings),
        "report_performance_count": len(result.report_performance),
        "verification_case_count": len(result.verification_cases),
        "alpha_hypothesis_count": len(result.alpha_hypotheses),
        "accounts": [summary.model_dump(mode="json") for summary in result.summaries],
    }


def _to_csv_rounded(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if df.empty:
        df.to_csv(path, index=False)
        return
    rounded = df.copy()
    for col in rounded.select_dtypes(include="float").columns:
        rounded[col] = rounded[col].round(ROUND_NDIGITS)
    rounded.to_csv(path, index=False)


def _round_floats(value: Any) -> Any:
    if isinstance(value, float):
        return round(value, ROUND_NDIGITS)
    if isinstance(value, dict):
        return {k: _round_floats(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_round_floats(v) for v in value]
    if isinstance(value, tuple):
        return tuple(_round_floats(v) for v in value)
    return value
