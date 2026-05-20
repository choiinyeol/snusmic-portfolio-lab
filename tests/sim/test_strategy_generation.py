from __future__ import annotations

from datetime import date

import pandas as pd
import pytest

from snusmic_pipeline.sim.contracts import (
    EquityPoint,
    PersonaSummary,
    SimulationConfig,
    SimulationResult,
)
from snusmic_pipeline.sim.strategy_generation import (
    annotate_stock_trial_gate,
    equity_return_series,
)


def _summary(persona: str, mwr: float) -> PersonaSummary:
    return PersonaSummary(
        persona=persona,
        label=persona,
        initial_capital_krw=1.0,
        total_contributed_krw=1.0,
        final_equity_krw=1.0 + mwr,
        final_cash_krw=0.0,
        final_holdings_value_krw=1.0 + mwr,
        net_profit_krw=mwr,
        money_weighted_return=mwr,
        time_weighted_return=mwr,
        cagr=mwr,
        max_drawdown=0.1,
        realized_pnl_krw=0.0,
        sharpe=1.0,
        sortino=1.0,
        trade_count=1,
        open_positions=1,
    )


def _equity(persona: str, values: list[float]) -> list[EquityPoint]:
    dates = pd.bdate_range("2024-01-02", periods=len(values))
    return [
        EquityPoint(
            persona=persona,
            date=day.date(),
            cash_krw=0.0,
            holdings_value_krw=value,
            equity_krw=value,
            contributed_capital_krw=1.0,
            net_profit_krw=value - 1.0,
            open_positions=1,
        )
        for day, value in zip(dates, values, strict=True)
    ]


def test_equity_return_series_uses_portfolio_equity_path() -> None:
    result = SimulationResult(
        config=SimulationConfig(start_date=date(2024, 1, 2), end_date=date(2024, 1, 5)),
        summaries=(_summary("rule_a", 0.2),),
        equity_points=tuple(_equity("rule_a", [100.0, 110.0, 121.0])),
        trades=(),
    )

    series = equity_return_series(result, ["rule_a"])["rule_a"]

    assert series.tolist() == pytest.approx([0.1, 0.1])


def test_annotate_stock_trial_gate_uses_correlation_not_benchmark_lag_for_rejection() -> None:
    from snusmic_pipeline.sim.strategy_generation import PortfolioGateResult

    frame = pd.DataFrame(
        [
            {"rule_id": "win", "accepted": True, "admission_status": "accepted"},
            {"rule_id": "lagged", "accepted": True, "admission_status": "accepted"},
            {"rule_id": "duplicate", "accepted": True, "admission_status": "accepted"},
        ]
    )
    updated = annotate_stock_trial_gate(
        frame,
        PortfolioGateResult(
            accepted_rule_ids=frozenset({"win", "lagged"}),
            rejected_by_benchmark=frozenset(),
            rejected_by_correlation=frozenset({"duplicate"}),
            correlation_peer={"duplicate": "win"},
            metrics_by_rule_id={
                "lagged": {
                    "portfolio_money_weighted_return": 0.1,
                    "portfolio_excess_vs_benchmark": -0.05,
                },
                "duplicate": {"portfolio_max_correlation": 0.96},
            },
        ),
    )

    assert updated.loc[updated["rule_id"] == "win", "accepted"].item() is True
    assert updated.loc[updated["rule_id"] == "lagged", "accepted"].item() is True
    assert updated.loc[updated["rule_id"] == "lagged", "portfolio_excess_vs_benchmark"].item() == -0.05
    assert updated.loc[updated["rule_id"] == "duplicate", "accepted"].item() is False
    assert (
        updated.loc[updated["rule_id"] == "duplicate", "admission_status"].item()
        == "portfolio_correlation_rejected"
    )
