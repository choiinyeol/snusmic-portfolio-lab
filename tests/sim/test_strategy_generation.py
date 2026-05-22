from __future__ import annotations

from datetime import date
from pathlib import Path

import pandas as pd

from snusmic_pipeline.sim.contracts import (
    EquityPoint,
    PersonaSummary,
    PitResearchBoardConfig,
    SimulationConfig,
    SimulationResult,
)
from snusmic_pipeline.sim.strategy_generation import (
    PortfolioGateResult,
    StrategyGenerationConfig,
    _load_reusable_broker_strategy_search,
    annotate_stock_trial_gate,
    portfolio_gate_personas,
)


def test_portfolio_gate_records_benchmark_lag_without_hard_rejection(
    monkeypatch,
    tmp_path: Path,
) -> None:
    loser = PitResearchBoardConfig(
        persona_name="pit_research_board_score_top10",
        label="Score Top 10",
    )
    winner = PitResearchBoardConfig(
        persona_name="pit_research_board_trend_top10",
        label="Trend Top 10",
    )

    def fake_run_simulation_cached(
        config: StrategyGenerationConfig,
        sim_config: SimulationConfig,
        *,
        stage: str,
    ) -> SimulationResult:
        return SimulationResult(
            config=sim_config,
            summaries=(
                _summary(loser.persona_name, loser.label, money_weighted_return=0.12),
                _summary(winner.persona_name, winner.label, money_weighted_return=0.55),
            ),
            equity_points=(
                _equity(loser.persona_name, date(2024, 1, 2), 100.0),
                _equity(loser.persona_name, date(2024, 1, 3), 101.0),
                _equity(loser.persona_name, date(2024, 1, 4), 102.0),
                _equity(winner.persona_name, date(2024, 1, 2), 100.0),
                _equity(winner.persona_name, date(2024, 1, 3), 110.0),
                _equity(winner.persona_name, date(2024, 1, 4), 155.0),
            ),
            trades=(),
        )

    monkeypatch.setattr(
        "snusmic_pipeline.sim.strategy_generation.run_simulation_cached",
        fake_run_simulation_cached,
    )
    selected, gate = portfolio_gate_personas(
        config=StrategyGenerationConfig(
            warehouse_dir=tmp_path / "warehouse",
            out_dir=tmp_path / "sim",
            start_date=date(2024, 1, 2),
            end_date=date(2024, 1, 4),
        ),
        base_personas=(),
        candidates=(loser, winner),
        benchmark_persona="benchmark_kodex200",
        benchmark_money_weighted_return=0.30,
        max_correlation=0.95,
    )

    assert [candidate.persona_name for candidate in selected] == [winner.persona_name, loser.persona_name]
    assert gate.accepted_rule_ids == frozenset({winner.persona_name, loser.persona_name})
    assert gate.rejected_by_benchmark == frozenset()
    assert gate.metrics_by_rule_id[loser.persona_name]["portfolio_excess_vs_benchmark"] < 0


def test_stock_trial_annotation_marks_portfolio_benchmark_lag() -> None:
    frame = pd.DataFrame(
        [
            {"rule_id": "rule-a", "accepted": True, "admission_status": "accepted"},
            {"rule_id": "rule-b", "accepted": True, "admission_status": "accepted"},
        ]
    )
    gate = PortfolioGateResult(
        accepted_rule_ids=frozenset({"rule-b"}),
        rejected_by_benchmark=frozenset({"rule-a"}),
        rejected_by_correlation=frozenset(),
        correlation_peer={},
        metrics_by_rule_id={
            "rule-a": {"portfolio_money_weighted_return": 0.10, "portfolio_excess_vs_benchmark": -0.20},
            "rule-b": {"portfolio_money_weighted_return": 0.45, "portfolio_excess_vs_benchmark": 0.15},
        },
    )

    annotated = annotate_stock_trial_gate(frame, gate)

    by_rule = annotated.set_index("rule_id")
    assert not bool(by_rule.loc["rule-a", "accepted"])
    assert by_rule.loc["rule-a", "admission_status"] == "below_portfolio_benchmark"
    assert bool(by_rule.loc["rule-b", "accepted"])
    assert by_rule.loc["rule-b", "admission_status"] == "accepted"


def test_broker_strategy_reuse_rejects_legacy_full_window_admission_cache(tmp_path: Path) -> None:
    out_dir = tmp_path / "sim"
    out_dir.mkdir()
    pd.DataFrame(
        [
            {
                "train_rank": 1,
                "accepted": True,
                "admission_status": "accepted",
                "train_money_weighted_return": 0.1,
                "train_max_drawdown": 0.2,
                "train_sharpe": 1.0,
                "train_sortino": 1.0,
                "train_trade_count": 10,
                "train_open_positions": 1,
                "full_money_weighted_return": 9.0,
                "full_net_profit_krw": 9_000_000,
                "full_max_drawdown": 0.01,
                "full_trade_count": 2,
                "full_open_positions": 1,
            }
        ]
    ).to_csv(out_dir / "broker_strategy_trials.csv", index=False)

    result = _load_reusable_broker_strategy_search(
        StrategyGenerationConfig(
            warehouse_dir=tmp_path / "warehouse",
            out_dir=out_dir,
            start_date=date(2024, 1, 2),
            end_date=date(2024, 1, 4),
        )
    )

    assert result is None


def _summary(persona: str, label: str, *, money_weighted_return: float) -> PersonaSummary:
    return PersonaSummary(
        persona=persona,
        label=label,
        initial_capital_krw=100.0,
        total_contributed_krw=100.0,
        final_equity_krw=100.0 * (1.0 + money_weighted_return),
        final_cash_krw=0.0,
        final_holdings_value_krw=100.0 * (1.0 + money_weighted_return),
        net_profit_krw=100.0 * money_weighted_return,
        money_weighted_return=money_weighted_return,
        time_weighted_return=money_weighted_return,
        cagr=money_weighted_return,
        max_drawdown=0.10,
        realized_pnl_krw=100.0 * money_weighted_return,
        sharpe=1.0,
        sortino=1.0,
        trade_count=3,
        open_positions=1,
    )


def _equity(persona: str, day: date, equity: float) -> EquityPoint:
    return EquityPoint(
        persona=persona,
        date=day,
        cash_krw=0.0,
        holdings_value_krw=equity,
        equity_krw=equity,
        contributed_capital_krw=100.0,
        net_profit_krw=equity - 100.0,
        open_positions=1,
    )
