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
        "pit_trend_top5",
        "pit_fresh_top5",
        "pit_trend_top7",
        "pit_trend_stop_top5",
        "pit_trend_stop_top7",
        "pit_trend_rotate_top5",
        "pit_trend_rotate_fast_top5",
        "pit_trend_rotate_stop_top5",
        "pit_trend_persist20_top5",
        "pit_trend_persist30_top5",
        "pit_trend_persist20_hold90_top5",
        "pit_trend_persist20_top3",
        "pit_trend_persist20_top7",
        "pit_trend_persist20_52w10_top5",
        "pit_trend_persist20_domestic_top5",
        "pit_trend_persist20_score_top5",
        "pit_trend_persist20_scorecap_top5",
        "pit_trend_persist20_invvol_top5",
        "pit_trend_persist20_invvolcap_top5",
        "pit_trend_persist20_semimonthly_top5",
        "pit_trend_persist20_quarterly_top5",
        "pit_trend_persist30_quarterly_top5",
        "pit_trend_persist20_quarterly_risk_top5",
        "pit_trend_persist30_quarterly_risk_top5",
        "pit_trend_persist20_quarterly_hold120_top5",
        "pit_trend_quarterly_ret3_top5",
        "pit_trend_quarterly_ret6_top5",
        "pit_trend_quarterly_ret36_top5",
        "pit_trend_quarterly_fresh365_top5",
        "pit_trend_quarterly_fresh540_top5",
        "pit_trend_persist20_fresh540_top5",
        "pit_trend_persist20_fresh540_top3",
        "pit_trend_persist20_fresh540_top7",
        "pit_trend_quarterly_fresh540_top3",
        "pit_trend_quarterly_fresh540_top7",
        "pit_trend_quarterly_fresh540_gross_top5",
        "pit_trend_quarterly_fresh540_slip25_top5",
        "pit_trend_quarterly_fresh540_slip50_top5",
        "pit_trend_quarterly_fresh540_feb_top5",
        "pit_trend_quarterly_fresh540_mar_top5",
        "pit_trend_quarterly_fresh540_cash90_top5",
        "pit_trend_quarterly_fresh540_cash80_top5",
        "pit_trend_quarterly_fresh540_vol35_top5",
        "pit_trend_quarterly_fresh540_vol40_top5",
        "pit_trend_quarterly_fresh540_vol45_top5",
        "pit_trend_quarterly_fresh540_vol50_top5",
        "pit_trend_quarterly_fresh540_vol55_top5",
        "pit_trend_quarterly_fresh540_mar_vol45_top5",
        "pit_trend_quarterly_fresh540_entry270_top5",
        "pit_trend_quarterly_fresh540_entry270_vol50_top5",
        "pit_trend_quarterly_fresh540_entry270_mar_top5",
        "pit_trend_quarterly_fresh540_entry365_top5",
        "pit_trend_quarterly_fresh540_entry450_top5",
        "pit_trend_quarterly_fresh540_entry365_vol50_top5",
        "pit_trend_quarterly_fresh540_rank15_top5",
        "pit_trend_quarterly_fresh540_rank25_top5",
        "pit_trend_quarterly_fresh540_runwinners_top5",
        "pit_trend_quarterly_fresh540_runwinners_vol50_top5",
        "pit_trend_quarterly_fresh540_runwinners_top3",
        "pit_trend_quarterly_fresh540_runwinners_top7",
        "pit_trend_quarterly_fresh540_runwinners_feb_top5",
        "pit_trend_quarterly_fresh540_runwinners_mar_top5",
        "pit_trend_quarterly_fresh540_runwinners_slip25_top5",
        "pit_trend_quarterly_fresh540_runwinners_slip50_top5",
        "pit_trend_quarterly_fresh540_runwinners_cap40_top5",
        "pit_trend_quarterly_fresh540_runwinners_cap35_top5",
        "pit_trend_quarterly_fresh540_runwinners_soft45_top5",
        "pit_trend_quarterly_fresh540_runwinners_vol50_cap40_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5",
        "pit_trend_quarterly_fresh540_runwinners_dailycap45_top5",
        "pit_trend_quarterly_fresh540_runwinners_vol50_weeklycap45_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap50_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit10_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit40_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_slip25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_slip50_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_dualrank_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_mixedentry_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_delay1_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_confirm5_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_confirm10_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_ret3m20_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_high10_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trail25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trail35_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim35_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim20_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_vol45_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_vol50_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_vol55_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_rank15_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_rank25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_rank30_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_cool20_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap15_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap18_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap22_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploy_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash15_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim120dd25cap20_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim150dd25cap20_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap30_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim20cap25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim30cap25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap35_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_slip25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_slip50_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_midcontrib_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_lastcontrib_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top3",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top7",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit70_mixedentry_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top3",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top7",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip50_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_midcontrib_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_lastcontrib_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_momentum_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_midcontrib_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_lastcontrib_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_slip25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_slip50_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top3",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top7",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit75_top5",
        "pit_trend_quarterly_fresh540_runwinners_dailycap45_profit25_top5",
        "pit_trend_quarterly_fresh540_confirm5_top5",
        "pit_trend_quarterly_fresh540_confirm10_top5",
        "pit_trend_quarterly_fresh540_confirm10_vol50_top5",
        "pit_trend_persist20_kodex50_top5",
        "pit_trend_persist20_kodex200_top5",
    ]


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
