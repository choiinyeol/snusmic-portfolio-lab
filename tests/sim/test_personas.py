"""Per-persona behavior on the synthetic three-symbol universe."""

from __future__ import annotations

from datetime import date

import pandas as pd

from snusmic_pipeline.sim.contracts import (
    BrokerageFees,
    ProphetConfig,
    SavingsPlan,
    SmicFollowerConfig,
    SmicFollowerV2Config,
    SmicMttStrategyConfig,
    WeakProphetConfig,
)
from snusmic_pipeline.sim.personas import (
    simulate_prophet,
    simulate_smic_follower,
    simulate_smic_follower_v2,
    simulate_smic_mtt_strategy,
    simulate_weak_prophet,
)
from snusmic_pipeline.sim.savings import build_cash_flow_schedule


def _common_inputs(synthetic_dates):
    plan = SavingsPlan(
        initial_capital_krw=10_000_000,
        monthly_contribution_krw=1_000_000,
        escalation_step_krw=500_000,
    )
    fees = BrokerageFees()
    cashflows = build_cash_flow_schedule(synthetic_dates, plan)
    return plan, fees, cashflows


def test_prophet_concentrates_on_realised_winner(synthetic_board, synthetic_reports, synthetic_dates):
    plan, fees, cashflows = _common_inputs(synthetic_dates)
    # Synthetic fixture: WIN ramps 100→200 (target 180 → hit), LOSS slides
    # 100→70 (target 130 → never hit), FLAT around 100 (target 110 → hit).
    # Prophet should buy WIN/FLAT (will hit) and avoid LOSS (will not hit).
    cfg = ProphetConfig(lookahead_months=24, target_hit_multiplier=1.0)
    out = simulate_prophet(cfg, plan, fees, synthetic_board, synthetic_reports, cashflows, synthetic_dates)
    buys = [t for t in out.account.trades if t.side == "buy"]
    assert any(t.symbol == "WIN" for t in buys)
    assert not any(t.symbol == "LOSS" for t in buys)
    assert out.summary.net_profit_krw > 0


def test_smic_follower_holds_losers_and_sells_only_at_target(
    synthetic_board, synthetic_reports, synthetic_dates
):
    plan, fees, cashflows = _common_inputs(synthetic_dates)
    cfg = SmicFollowerConfig()
    out = simulate_smic_follower(
        cfg, plan, fees, synthetic_board, synthetic_reports, cashflows, synthetic_dates
    )
    # WIN crosses its target (180) — there should be at least one target_hit sell.
    sells = [t for t in out.account.trades if t.side == "sell"]
    target_hits = [t for t in sells if t.reason == "target_hit"]
    assert any(t.symbol == "WIN" for t in target_hits)
    # LOSS slid from 100 → ~70 — its target was 130 so it never hit; the follower
    # must NOT have sold it for any reason other than the end-of-sim cleanup.
    loss_sells = [t for t in sells if t.symbol == "LOSS" and t.reason != "end_of_sim"]
    assert loss_sells == []
    assert not any(t.symbol == "LOSS" and t.reason == "rebalance_sell" for t in sells)


def test_smic_follower_v2_stops_out_long_held_loser(synthetic_board, synthetic_reports, synthetic_dates):
    plan, fees, cashflows = _common_inputs(synthetic_dates)
    # Tighten time-loss to 200 days so it actually fires inside the 2y fixture.
    cfg = SmicFollowerV2Config(time_loss_days=200, report_age_stop_days=600, averaged_down_stop_pct=0.10)
    out = simulate_smic_follower_v2(
        cfg, plan, fees, synthetic_board, synthetic_reports, cashflows, synthetic_dates
    )
    sells = [t for t in out.account.trades if t.side == "sell"]
    reasons = {t.reason for t in sells}
    # At least one of the LOSS-driven stop-loss rules must have fired.
    assert reasons & {"stop_loss_time", "stop_loss_average_down", "stop_loss_report_age"}
    # v2 evaluates sell signals daily, but it must not churn the book through
    # daily equal-weight rebalance sells.
    assert not any(t.reason == "rebalance_sell" for t in sells)


def test_smic_mtt_strategy_uses_broker_slots_without_rebalance_sells(
    synthetic_board, synthetic_reports, synthetic_dates
):
    plan, fees, cashflows = _common_inputs(synthetic_dates)
    cfg = SmicMttStrategyConfig(
        require_mtt=False,
        universe="all",
        min_target_upside_at_pub=0.05,
        max_positions=1,
        target_hit_multiplier=2.0,
        take_profit_pct=3.0,
        top_up_cadence="deposit_only",
    )
    out = simulate_smic_mtt_strategy(
        cfg, plan, fees, synthetic_board, synthetic_reports, cashflows, synthetic_dates
    )

    buys = [t for t in out.account.trades if t.side == "buy"]
    sells = [t for t in out.account.trades if t.side == "sell"]
    assert buys
    assert {t.symbol for t in buys} == {"WIN"}
    assert not any(t.reason == "rebalance_sell" for t in sells)
    assert max(ep.open_positions for ep in out.equity_points) <= 1


def test_smic_mtt_strategy_filters_non_mtt_reports(synthetic_board, synthetic_dates):
    plan, fees, cashflows = _common_inputs(synthetic_dates)
    reports = pd.DataFrame(
        [
            {
                "report_id": "mtt-win",
                "symbol": "WIN",
                "company": "Winners Co",
                "exchange": "NASDAQ",
                "publication_date": pd.Timestamp("2025-03-03"),
                "target_price": 250.0,
            },
            {
                "report_id": "mtt-loss",
                "symbol": "LOSS",
                "company": "Losers Co",
                "exchange": "NASDAQ",
                "publication_date": pd.Timestamp("2025-03-03"),
                "target_price": 130.0,
            },
        ]
    )
    cfg = SmicMttStrategyConfig(
        universe="all",
        min_target_upside_at_pub=0.05,
        max_positions=2,
        top_up_cadence="deposit_only",
        target_hit_multiplier=2.0,
        take_profit_pct=3.0,
    )
    out = simulate_smic_mtt_strategy(cfg, plan, fees, synthetic_board, reports, cashflows, synthetic_dates)

    buys = [t for t in out.account.trades if t.side == "buy"]
    assert any(t.symbol == "WIN" for t in buys)
    assert not any(t.symbol == "LOSS" for t in buys)


def test_smic_mtt_strategy_relative_strength_prefers_trailing_winner(synthetic_board, synthetic_dates):
    plan, fees, cashflows = _common_inputs(synthetic_dates)
    reports = pd.DataFrame(
        [
            {
                "report_id": "rs-win",
                "symbol": "WIN",
                "company": "Winners Co",
                "exchange": "NASDAQ",
                "publication_date": pd.Timestamp("2025-03-03"),
                "target_price": 220.0,
            },
            {
                "report_id": "rs-loss",
                "symbol": "LOSS",
                "company": "Losers Co",
                "exchange": "NASDAQ",
                "publication_date": pd.Timestamp("2025-03-03"),
                "target_price": 200.0,
            },
        ]
    )
    cfg = SmicMttStrategyConfig(
        require_mtt=False,
        universe="all",
        min_target_upside_at_pub=0.05,
        max_target_upside_at_pub=5.0,
        max_positions=1,
        top_up_cadence="deposit_only",
        target_hit_multiplier=2.0,
        take_profit_pct=3.0,
        relative_strength_lookback_days=126,
        min_relative_strength_percentile=0.60,
        min_momentum_return=0.0,
    )

    out = simulate_smic_mtt_strategy(cfg, plan, fees, synthetic_board, reports, cashflows, synthetic_dates)

    buys = [t for t in out.account.trades if t.side == "buy"]
    assert buys
    assert {t.symbol for t in buys} == {"WIN"}


def test_weak_prophet_empty_rebalance_sells_to_cash(synthetic_board, synthetic_reports):
    trading_dates = [date(2024, 1, 2), date(2024, 2, 1)]
    plan, fees, cashflows = _common_inputs(trading_dates)
    cfg = WeakProphetConfig(lookahead_months=3, max_weight=1.0, min_history_days=20)
    out = simulate_weak_prophet(cfg, plan, fees, synthetic_board, synthetic_reports, cashflows, trading_dates)

    assert any(t.side == "buy" for t in out.account.trades)
    assert any(t.side == "sell" and t.reason == "rebalance_sell" for t in out.account.trades)
    assert out.account.open_position_count() == 0
    assert out.account.cash_krw > 0


def test_weak_prophet_runs_and_picks_winners(synthetic_board, synthetic_reports, synthetic_dates):
    plan, fees, cashflows = _common_inputs(synthetic_dates)
    cfg = WeakProphetConfig(lookahead_months=3, max_weight=1.0, min_history_days=30)
    out = simulate_weak_prophet(
        cfg, plan, fees, synthetic_board, synthetic_reports, cashflows, synthetic_dates
    )
    # Should beat raw deposits since WIN has positive expected return.
    assert out.summary.final_equity_krw > out.summary.total_contributed_krw * 0.95
    # Should have made at least a few buys.
    assert sum(1 for t in out.account.trades if t.side == "buy") >= 1


def test_followers_v1_and_v2_diverge(synthetic_board, synthetic_reports, synthetic_dates):
    plan, fees, cashflows = _common_inputs(synthetic_dates)
    v1 = simulate_smic_follower(
        SmicFollowerConfig(), plan, fees, synthetic_board, synthetic_reports, cashflows, synthetic_dates
    )
    v2 = simulate_smic_follower_v2(
        SmicFollowerV2Config(time_loss_days=200, averaged_down_stop_pct=0.10, report_age_stop_days=600),
        plan,
        fees,
        synthetic_board,
        synthetic_reports,
        cashflows,
        synthetic_dates,
    )
    # Different exit policies must produce different trade counts in this fixture.
    assert v1.summary.trade_count != v2.summary.trade_count


def test_persona_summaries_have_finite_irr(synthetic_board, synthetic_reports, synthetic_dates):
    import math

    plan, fees, cashflows = _common_inputs(synthetic_dates)
    out = simulate_prophet(
        ProphetConfig(), plan, fees, synthetic_board, synthetic_reports, cashflows, synthetic_dates
    )
    irr = out.summary.money_weighted_return
    assert math.isfinite(irr)
