from __future__ import annotations

from datetime import date

import pandas as pd

from snusmic_pipeline.sim.contracts import PitSignalRuleConfig
from snusmic_pipeline.sim.pit_research_board import PitResearchBoardRow
from snusmic_pipeline.sim.replacement_audit import (
    _bucket_high_gap,
    _bucket_rank,
    _symbols_by_side_and_reason,
)
from snusmic_pipeline.sim.selection_audit import (
    _first_buy_timing_rows,
    _mean_defined,
    _replay_account_state,
    candidate_score_components,
)


def test_candidate_score_components_match_pit_formula():
    row = PitResearchBoardRow(
        as_of_date=date(2026, 5, 1),
        price_date=date(2026, 5, 1),
        report_id="r1",
        symbol="ABC",
        company="ABC",
        publication_date=date(2026, 1, 1),
        report_age_days=120,
        entry_price_krw=100.0,
        entry_price_source="market",
        entry_price_scale_factor=None,
        price_quality_flag="ok",
        target_price_krw=200.0,
        last_close_krw=220.0,
        target_upside_at_pub=1.0,
        current_return=1.2,
        target_gap_pct=0.1,
        ytd_return=None,
        return_1m=None,
        return_3m=None,
        return_6m=None,
        return_1y=None,
        distance_from_52w_high=None,
        distance_from_52w_low=None,
        above_20ma=None,
        above_50ma=None,
        above_150ma=None,
        sma200_return_1m=None,
        sma200_return_120d=None,
        sma200_return_150d=None,
        above_200ma=None,
        ma_stack=None,
        ema_stack=None,
        macd_line=None,
        macd_signal=None,
        macd_hist=None,
        macd_bullish=None,
        target_hit=True,
        expired=False,
        bucket="active",
        rank_basis="active report",
        candidate_score=2.575,
        board_score=2.575,
        ta_momentum_score=0.0,
        relative_strength_score=None,
        relative_strength_percentile=None,
    )

    assert candidate_score_components(row) == {
        "target_upside_component": 1.4,
        "current_return_component": 1.2,
        "over_target_penalty": 0.025,
        "total": 2.575,
    }


def test_mean_defined_ignores_missing_returns():
    assert _mean_defined([None, 0.10, -0.05]) == 0.025
    assert _mean_defined([None]) is None


def test_first_buy_timing_rows_keep_only_different_entry_dates():
    trades = pd.DataFrame(
        [
            {"account_id": "candidate", "date": "2024-07-01", "symbol": "AAA", "side": "buy"},
            {"account_id": "baseline", "date": "2024-10-01", "symbol": "AAA", "side": "buy"},
            {"account_id": "candidate", "date": "2024-01-01", "symbol": "BBB", "side": "buy"},
            {"account_id": "baseline", "date": "2024-01-01", "symbol": "BBB", "side": "buy"},
            {"account_id": "candidate", "date": "2024-04-01", "symbol": "CCC", "side": "buy"},
            {"account_id": "baseline", "date": "2024-04-01", "symbol": "DDD", "side": "buy"},
            {"account_id": "candidate", "date": "2024-04-15", "symbol": "AAA", "side": "sell"},
        ]
    )

    rows = _first_buy_timing_rows(trades, "candidate", "baseline")

    assert [row.symbol for row in rows] == ["AAA", "CCC", "DDD"]
    assert rows[0].candidate_minus_baseline_days == -92
    assert rows[1].baseline_first_buy is None
    assert rows[2].candidate_first_buy is None


def test_replay_account_state_uses_pre_audit_holdings_and_cash():
    trades = pd.DataFrame(
        [
            {
                "account_id": "acct",
                "date": pd.Timestamp("2024-01-01").date(),
                "symbol": "AAA",
                "side": "buy",
                "qty": 10,
                "gross_krw": 1000.0,
                "commission_krw": 1.0,
                "realized_pnl_krw": None,
            },
            {
                "account_id": "acct",
                "date": pd.Timestamp("2024-02-01").date(),
                "symbol": "AAA",
                "side": "sell",
                "qty": 4,
                "gross_krw": 800.0,
                "commission_krw": 1.0,
                "realized_pnl_krw": 399.6,
            },
        ]
    )
    equity = pd.DataFrame(
        [
            {"account_id": "acct", "date": pd.Timestamp("2024-01-31").date(), "cash_krw": 500.0},
            {"account_id": "acct", "date": pd.Timestamp("2024-02-01").date(), "cash_krw": 1299.0},
        ]
    )

    before = _replay_account_state(
        trades,
        equity,
        "acct",
        pd.Timestamp("2024-02-01").date(),
        include_audit_date=False,
        config=PitSignalRuleConfig(account_id="pit_trend_top5", label="test"),
    )
    after = _replay_account_state(
        trades,
        equity,
        "acct",
        pd.Timestamp("2024-02-01").date(),
        include_audit_date=True,
        config=PitSignalRuleConfig(account_id="pit_trend_top5", label="test"),
    )

    assert before.cash_krw == 500.0
    assert before.holdings["AAA"].qty == 10
    assert after.cash_krw == 1299.0
    assert after.holdings["AAA"].qty == 6


def test_symbols_by_side_and_reason_filters_rebalance_replacements():
    trades = pd.DataFrame(
        [
            {"symbol": "AAA", "side": "sell", "reason": "rebalance_sell"},
            {"symbol": "BBB", "side": "sell", "reason": "retained_cap_trim"},
            {"symbol": "CCC", "side": "buy", "reason": "rebalance_buy"},
            {"symbol": "DDD", "side": "buy", "reason": "cashflow_buy"},
        ]
    )

    assert _symbols_by_side_and_reason(trades, side="sell", reason="rebalance_sell") == {"AAA"}
    assert _symbols_by_side_and_reason(trades, side="buy", reason="rebalance_buy") == {"CCC"}


def test_replacement_feature_bucket_boundaries_are_stable():
    assert _bucket_rank(None) == "missing"
    assert _bucket_rank(2) == "top 1-2"
    assert _bucket_rank(5) == "rank 3-5"
    assert _bucket_rank(10) == "rank 6-10"
    assert _bucket_rank(11) == ">10"

    assert _bucket_high_gap(None) == "missing"
    assert _bucket_high_gap(-0.03) == "within 5%"
    assert _bucket_high_gap(-0.08) == "5-10% below"
    assert _bucket_high_gap(-0.15) == "10-20% below"
    assert _bucket_high_gap(-0.21) == ">20% below"
