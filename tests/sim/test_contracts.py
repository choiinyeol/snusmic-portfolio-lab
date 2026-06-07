"""SSOT contract guarantees: roundtrip, frozen-ness, validators."""

from __future__ import annotations

from datetime import date

import pytest
from pydantic import ValidationError

from snusmic_pipeline.sim.contracts import (
    AllWeatherConfig,
    BenchmarkAsset,
    BrokerageFees,
    EquityPoint,
    PitScoreTopNConfig,
    PitSignalRuleConfig,
    ProphetConfig,
    SavingsPlan,
    SimulationConfig,
    SmicFollowerConfig,
    Trade,
)


def test_savings_plan_defaults_match_brief():
    plan = SavingsPlan()
    assert plan.initial_capital_krw == 10_000_000
    assert plan.monthly_contribution_krw == 1_000_000
    assert plan.escalation_step_krw == 500_000
    assert plan.escalation_period_years == 2


def test_brokerage_fees_validate_bps_range():
    fees = BrokerageFees()
    assert 0 <= fees.commission_bps <= 200
    with pytest.raises(ValidationError):
        BrokerageFees(commission_bps=-1.0)
    with pytest.raises(ValidationError):
        BrokerageFees(sell_tax_bps=10_000.0)


def test_pit_signal_redeploy_after_trim_requires_trailing_trim_settings():
    with pytest.raises(ValidationError, match="redeploy_after_trailing_trim"):
        PitSignalRuleConfig(
            account_id="pit_trend_top5",
            label="Invalid redeploy",
            redeploy_after_trailing_trim=True,
        )


def test_pit_signal_redeploy_cash_gate_requires_redeploy():
    with pytest.raises(ValidationError, match="redeploy_after_trailing_trim_min_cash_pct"):
        PitSignalRuleConfig(
            account_id="pit_trend_top5",
            label="Invalid redeploy cash gate",
            redeploy_after_trailing_trim_min_cash_pct=0.15,
        )


def test_pit_signal_partial_redeploy_requires_redeploy():
    with pytest.raises(ValidationError, match="redeploy_after_trailing_trim_buy_fraction"):
        PitSignalRuleConfig(
            account_id="pit_trend_top5",
            label="Invalid partial redeploy",
            redeploy_after_trailing_trim_buy_fraction=0.75,
        )


def test_simulation_config_roundtrip():
    cfg = SimulationConfig(start_date=date(2021, 1, 4), end_date=date(2026, 4, 1))
    rebuilt = SimulationConfig.model_validate_json(cfg.model_dump_json())
    assert rebuilt == cfg


def test_default_accounts_are_benchmarks_plus_pit_baselines():
    cfg = SimulationConfig(start_date=date(2021, 1, 4), end_date=date(2026, 4, 1))
    names = [account_id.account_id for account_id in cfg.accounts]
    assert names == [
        "all_weather",
        "benchmark_qqq",
        "benchmark_spy",
        "benchmark_kodex200",
        "benchmark_gld",
        "smic_follower",
        "smic_follower_v2",
        "pit_score_top3",
        "pit_score_top5",
        "pit_score_top10",
        "pit_momentum_top5",
        "pit_momentum_1m3m_top5",
        "pit_momentum_3m6m_top5",
        "pit_momentum_6m12m_top5",
        "pit_mtt_rs70_top5",
        "pit_mtt_rs80_top5",
        "pit_mtt_rs90_top5",
        "pit_mtt_low100_top5",
        "pit_mtt_low300_top5",
        "pit_trend_top5",
        "pit_fresh_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5",
    ]


def test_new_momentum_accounts_use_market_200ma_gate() -> None:
    cfg = SimulationConfig(start_date=date(2021, 1, 4), end_date=date(2026, 4, 1))
    gates = {
        account.account_id: account.market_gate
        for account in cfg.accounts
        if isinstance(account, PitSignalRuleConfig)
        and account.account_id
        in {
            "pit_momentum_1m3m_top5",
            "pit_momentum_3m6m_top5",
            "pit_momentum_6m12m_top5",
            "pit_mtt_rs70_top5",
            "pit_mtt_rs80_top5",
            "pit_mtt_rs90_top5",
            "pit_mtt_low100_top5",
            "pit_mtt_low300_top5",
        }
    }

    assert gates == {
        "pit_momentum_1m3m_top5": "above_200ma",
        "pit_momentum_3m6m_top5": "above_200ma",
        "pit_momentum_6m12m_top5": "above_200ma",
        "pit_mtt_rs70_top5": "above_200ma",
        "pit_mtt_rs80_top5": "above_200ma",
        "pit_mtt_rs90_top5": "above_200ma",
        "pit_mtt_low100_top5": "above_200ma",
        "pit_mtt_low300_top5": "above_200ma",
    }


def test_simulation_config_rejects_inverted_dates():
    with pytest.raises(ValidationError):
        SimulationConfig(start_date=date(2026, 1, 1), end_date=date(2025, 1, 1))


def test_simulation_config_rejects_duplicate_account_ids():
    with pytest.raises(ValidationError):
        SimulationConfig(
            start_date=date(2021, 1, 4),
            end_date=date(2026, 4, 1),
            accounts=(ProphetConfig(), ProphetConfig()),
        )


def test_pit_score_account_id_must_match_top_n():
    with pytest.raises(ValidationError):
        PitScoreTopNConfig(account_id="pit_score_top3", top_n=5)


def test_all_weather_weights_must_sum_to_one():
    with pytest.raises(ValidationError):
        AllWeatherConfig(
            assets=(
                BenchmarkAsset(name="Gold", symbol="GLD", weight=0.4),
                BenchmarkAsset(name="QQQ", symbol="QQQ", weight=0.3),
            )
        )


def test_all_weather_rejects_duplicate_symbols():
    with pytest.raises(ValidationError):
        AllWeatherConfig(
            assets=(
                BenchmarkAsset(name="Gold", symbol="GLD", weight=0.5),
                BenchmarkAsset(name="Gold copy", symbol="GLD", weight=0.5),
            )
        )


def test_account_configs_are_frozen():
    cfg = SmicFollowerConfig()
    with pytest.raises(ValidationError):
        cfg.target_hit_multiplier = 1.5  # type: ignore[misc]


def test_trade_record_rejects_negative_qty():
    with pytest.raises(ValidationError):
        Trade(
            account_id="x",
            date=date(2024, 1, 1),
            symbol="A",
            side="buy",
            qty=-1,
            fill_price_krw=100.0,
            gross_krw=0.0,
            commission_krw=0.0,
            tax_krw=0.0,
            cash_after_krw=0.0,
            reason="deposit_buy",
        )


def test_equity_point_serializes_to_json():
    p = EquityPoint(
        account_id="oracle",
        date=date(2024, 1, 1),
        cash_krw=1.0,
        holdings_value_krw=2.0,
        equity_krw=3.0,
        contributed_capital_krw=10.0,
        net_profit_krw=-7.0,
        open_positions=0,
    )
    js = p.model_dump_json()
    rebuilt = EquityPoint.model_validate_json(js)
    assert rebuilt == p


def test_simulation_config_extras_forbidden():
    with pytest.raises(ValidationError):
        SimulationConfig.model_validate({"start_date": "2021-01-04", "end_date": "2026-04-01", "unknown": 1})
