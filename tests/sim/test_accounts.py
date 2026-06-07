"""Per-account_id behavior on the synthetic three-symbol universe."""

from __future__ import annotations

from datetime import date
from types import SimpleNamespace

import pandas as pd

from snusmic_pipeline.sim.accounts import (
    simulate_pit_score_top_n,
    simulate_pit_signal_rule,
    simulate_prophet,
    simulate_smic_follower,
    simulate_smic_follower_v2,
    simulate_weak_prophet,
)
from snusmic_pipeline.sim.accounts.base import sharpe_ratio, sortino_ratio
from snusmic_pipeline.sim.accounts.pit_score import (
    _passes_signal_rule,
    _signal_rule_weights,
    _sort_signal_rows,
)
from snusmic_pipeline.sim.brokerage import Account
from snusmic_pipeline.sim.contracts import (
    BrokerageFees,
    EquityPoint,
    PitScoreTopNConfig,
    PitSignalRuleConfig,
    ProphetConfig,
    SavingsPlan,
    SmicFollowerConfig,
    SmicFollowerV2Config,
    WeakProphetConfig,
)
from snusmic_pipeline.sim.market import PriceBoard
from snusmic_pipeline.sim.savings import build_cash_flow_schedule


def test_pit_signal_rule_filters_one_month_and_one_year_momentum() -> None:
    cfg = PitSignalRuleConfig(
        account_id="pit_momentum_strict_top5",
        label="Strict momentum",
        min_return_1m=0.0,
        min_return_3m=0.0,
        min_return_6m=0.0,
        min_return_1y=0.0,
        min_sma200_return_150d=0.0,
        min_distance_from_52w_low=0.30,
        min_relative_strength_percentile=0.90,
        require_above_50ma=True,
        require_ma_stack=True,
        require_above_150ma=True,
        require_mtt_template=True,
        require_macd_bullish=True,
    )
    passing = SimpleNamespace(
        report_age_days=30,
        above_50ma=True,
        above_200ma=True,
        above_150ma=True,
        ma_stack=True,
        mtt_template=True,
        macd_bullish=True,
        return_1m=0.01,
        return_3m=0.02,
        return_6m=0.03,
        return_1y=0.04,
        sma200_return_1m=0.01,
        sma200_return_120d=0.02,
        sma200_return_150d=0.03,
        distance_from_52w_high=-0.05,
        distance_from_52w_low=0.35,
        relative_strength_percentile=0.92,
    )
    failing = SimpleNamespace(**{**passing.__dict__, "return_1y": -0.01})
    below_150ma = SimpleNamespace(**{**passing.__dict__, "above_150ma": False})
    below_50ma = SimpleNamespace(**{**passing.__dict__, "above_50ma": False})
    broken_mtt_template = SimpleNamespace(**{**passing.__dict__, "mtt_template": False})
    falling_sma200 = SimpleNamespace(**{**passing.__dict__, "sma200_return_150d": -0.01})
    below_52w_low = SimpleNamespace(**{**passing.__dict__, "distance_from_52w_low": 0.25})
    weak_relative_strength = SimpleNamespace(**{**passing.__dict__, "relative_strength_percentile": 0.89})

    assert _passes_signal_rule(cfg, passing)
    assert not _passes_signal_rule(cfg, failing)
    assert not _passes_signal_rule(cfg, below_150ma)
    assert not _passes_signal_rule(cfg, below_50ma)
    assert not _passes_signal_rule(cfg, broken_mtt_template)
    assert not _passes_signal_rule(cfg, falling_sma200)
    assert not _passes_signal_rule(cfg, below_52w_low)
    assert not _passes_signal_rule(cfg, weak_relative_strength)


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


def test_pit_score_top_n_rolls_into_point_in_time_ranked_names(
    synthetic_board, synthetic_reports, synthetic_dates
):
    plan, fees, cashflows = _common_inputs(synthetic_dates)
    cfg = PitScoreTopNConfig(account_id="pit_score_top3", label="PIT score Top 3", top_n=3)
    out = simulate_pit_score_top_n(
        cfg, plan, fees, synthetic_board, synthetic_reports, cashflows, synthetic_dates
    )

    buys = [trade for trade in out.account.trades if trade.side == "buy"]
    assert buys
    assert {trade.symbol for trade in buys}.issubset({"WIN", "LOSS", "FLAT"})
    assert out.summary.trade_count > 0
    assert out.summary.open_positions <= 3


def test_pit_score_top_n_keeps_target_hit_and_expired_rows_eligible() -> None:
    dates = [day.date() for day in pd.bdate_range("2024-01-02", "2024-03-04")]
    close = pd.DataFrame(
        {
            "HIT": [100.0 + i * 5.0 for i in range(len(dates))],
            "OPEN": [100.0 + i * 0.1 for i in range(len(dates))],
            "OLD": [90.0 + i * 0.1 for i in range(len(dates))],
        },
        index=pd.to_datetime(dates),
    )
    board = PriceBoard(close=close, open=close.copy(), high=close.copy(), low=close.copy())
    reports = pd.DataFrame(
        [
            {
                "report_id": "hit",
                "symbol": "HIT",
                "company": "Hit Co",
                "publication_date": pd.Timestamp("2024-01-02"),
                "report_current_price_krw": 100.0,
                "target_price_krw": 150.0,
            },
            {
                "report_id": "open",
                "symbol": "OPEN",
                "company": "Open Co",
                "publication_date": pd.Timestamp("2024-01-02"),
                "report_current_price_krw": 100.0,
                "target_price_krw": 110.0,
            },
            {
                "report_id": "old",
                "symbol": "OLD",
                "company": "Old Co",
                "publication_date": pd.Timestamp("2024-01-02"),
                "report_current_price_krw": 90.0,
                "target_price_krw": 100.0,
            },
        ]
    )
    plan, fees, cashflows = _common_inputs(dates)
    cfg = PitScoreTopNConfig(
        account_id="pit_score_top3",
        label="PIT score Top 3",
        top_n=3,
        max_report_age_days=30,
    )

    out = simulate_pit_score_top_n(cfg, plan, fees, board, reports, cashflows, dates)

    assert {symbol for symbol, lot in out.account.holdings.items() if lot.qty > 0} == {
        "HIT",
        "OPEN",
        "OLD",
    }


def test_pit_signal_weekly_retained_cap_trims_between_quarterly_rebalances() -> None:
    dates = [day.date() for day in pd.bdate_range("2024-01-02", "2024-02-02")]
    symbols = ["WIN", "A", "B", "C", "D"]
    close = pd.DataFrame(
        {
            "WIN": [100.0 if index < 4 else 1000.0 for index, _ in enumerate(dates)],
            "A": [100.0 for _ in dates],
            "B": [100.0 for _ in dates],
            "C": [100.0 for _ in dates],
            "D": [100.0 for _ in dates],
        },
        index=pd.to_datetime(dates),
    )
    board = PriceBoard(close=close, open=close.copy(), high=close.copy(), low=close.copy())
    reports = pd.DataFrame(
        [
            {
                "report_id": f"r-{symbol}",
                "symbol": symbol,
                "company": symbol,
                "publication_date": pd.Timestamp("2024-01-02"),
                "report_current_price_krw": 100.0,
                "target_price_krw": 200.0,
            }
            for symbol in symbols
        ]
    )
    plan, fees, cashflows = _common_inputs(dates)
    cfg = PitSignalRuleConfig(
        account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5",
        label="Weekly cap",
        top_n=5,
        rebalance="quarterly",
        allow_rebalance_sell_down=False,
        retained_weight_cap=0.40,
        retained_weight_cap_trigger=0.45,
        retained_weight_cap_cadence="weekly",
    )

    out = simulate_pit_signal_rule(cfg, plan, fees, board, reports, cashflows, dates)

    first_rebalance = date(2024, 1, 2)
    sells = [trade for trade in out.account.trades if trade.side == "sell" and trade.symbol == "WIN"]
    assert sells
    assert min(trade.date for trade in sells) > first_rebalance
    assert min(trade.date for trade in sells) < date(2024, 4, 1)
    assert {trade.reason for trade in sells} == {"retained_cap_trim"}


def test_pit_signal_dual_rank_prefers_best_rank_from_candidate_or_board() -> None:
    cfg = PitSignalRuleConfig(
        account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_dualrank_top5",
        label="Dual rank",
        score_field="candidate_score",
        rank_mode="dual_rank",
    )
    rows = [
        SimpleNamespace(
            symbol="CANDIDATE_ONLY",
            candidate_score=100.0,
            board_score=1.0,
            publication_date=date(2024, 1, 1),
        ),
        SimpleNamespace(
            symbol="BOARD_ONLY",
            candidate_score=1.0,
            board_score=100.0,
            publication_date=date(2024, 1, 1),
        ),
        SimpleNamespace(
            symbol="MIDDLE",
            candidate_score=50.0,
            board_score=50.0,
            publication_date=date(2024, 1, 1),
        ),
    ]

    ranked = _sort_signal_rows(cfg, rows)

    assert [row.symbol for row in ranked] == ["CANDIDATE_ONLY", "BOARD_ONLY", "MIDDLE"]


def test_pit_signal_rank_sort_can_use_entry_score_override() -> None:
    cfg = PitSignalRuleConfig(
        account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5",
        label="Mixed entry",
        score_field="board_score",
        entry_score_field="candidate_score",
    )
    rows = [
        SimpleNamespace(
            symbol="BOARD_FIRST",
            candidate_score=1.0,
            board_score=100.0,
            publication_date=date(2024, 1, 1),
        ),
        SimpleNamespace(
            symbol="CANDIDATE_FIRST",
            candidate_score=100.0,
            board_score=1.0,
            publication_date=date(2024, 1, 1),
        ),
    ]

    ranked = _sort_signal_rows(cfg, rows, score_field=cfg.entry_score_field)

    assert [row.symbol for row in ranked] == ["CANDIDATE_FIRST", "BOARD_FIRST"]


def test_pit_signal_replacement_delay_keeps_vacated_slot_in_cash() -> None:
    day = date(2024, 4, 1)
    symbols = ["H1", "H2", "H3", "H4", "DROP", "NEW"]
    close = pd.DataFrame({symbol: [100.0] for symbol in symbols}, index=pd.to_datetime([day]))
    board = PriceBoard(close=close, open=close.copy(), high=close.copy(), low=close.copy())
    rows = [
        SimpleNamespace(
            symbol=symbol,
            candidate_score=candidate_score,
            board_score=board_score,
            publication_date=day,
            report_age_days=30,
            above_200ma=True,
            ma_stack=True,
            macd_bullish=True,
            return_3m=0.1,
            return_6m=0.2,
            distance_from_52w_high=-0.05,
        )
        for symbol, candidate_score, board_score in [
            ("H1", 100.0, 100.0),
            ("H2", 99.0, 99.0),
            ("H3", 98.0, 98.0),
            ("H4", 97.0, 97.0),
            ("NEW", 200.0, 10.0),
            ("DROP", 1.0, 1.0),
        ]
    ]
    cache = SimpleNamespace(rows=lambda *_args, **_kwargs: rows)
    account = Account(
        account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_delay1_top5",
        fees=BrokerageFees(commission_bps=0.0, sell_tax_bps=0.0, slippage_bps=0.0),
    )
    account.deposit(day, 500_000.0)
    for symbol in ["H1", "H2", "H3", "H4", "DROP"]:
        account.buy_value(day, symbol, 100.0, 100_000.0, "rebalance_buy")
    prices_today = {symbol: 100.0 for symbol in symbols}
    delayed = PitSignalRuleConfig(
        account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_delay1_top5",
        label="Delay one replacement",
        score_field="candidate_score",
        retention_score_field="board_score",
        entry_score_field="candidate_score",
        top_n=5,
        rank_exit_threshold=5,
        replacement_delay_rebalances=1,
    )
    immediate = delayed.model_copy(
        update={
            "account_id": "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5",
            "replacement_delay_rebalances": 0,
        }
    )

    delayed_weights = _signal_rule_weights(delayed, cache, board, day, prices_today, account=account)
    immediate_weights = _signal_rule_weights(immediate, cache, board, day, prices_today, account=account)

    assert delayed_weights == {"H1": 0.2, "H2": 0.2, "H3": 0.2, "H4": 0.2}
    assert sum(delayed_weights.values()) == 0.8
    assert immediate_weights == {
        "NEW": 0.2,
        "H1": 0.2,
        "H2": 0.2,
        "H3": 0.2,
        "H4": 0.2,
    }


def test_pit_signal_entry_confirmation_gates_new_entries_only() -> None:
    day = date(2024, 4, 1)
    symbols = ["H1", "H2", "H3", "H4", "NEW_BAD", "NEW_OK"]
    close = pd.DataFrame({symbol: [100.0] for symbol in symbols}, index=pd.to_datetime([day]))
    board = PriceBoard(close=close, open=close.copy(), high=close.copy(), low=close.copy())
    rows = [
        SimpleNamespace(
            symbol=symbol,
            candidate_score=candidate_score,
            board_score=board_score,
            publication_date=day,
            report_age_days=30,
            above_200ma=True,
            ma_stack=True,
            macd_bullish=True,
            return_3m=0.1,
            return_6m=0.2,
            distance_from_52w_high=-0.05,
        )
        for symbol, candidate_score, board_score in [
            ("H1", 10.0, 100.0),
            ("H2", 9.0, 99.0),
            ("H3", 8.0, 98.0),
            ("H4", 7.0, 97.0),
            ("NEW_BAD", 200.0, 1.0),
            ("NEW_OK", 150.0, 2.0),
        ]
    ]
    cache = SimpleNamespace(rows=lambda *_args, **_kwargs: rows)
    account = Account(
        account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_confirm10_top5",
        fees=BrokerageFees(commission_bps=0.0, sell_tax_bps=0.0, slippage_bps=0.0),
    )
    account.deposit(day, 400_000.0)
    for symbol in ["H1", "H2", "H3", "H4"]:
        account.buy_value(day, symbol, 100.0, 100_000.0, "rebalance_buy")
    prices_today = {symbol: 100.0 for symbol in symbols}
    cfg = PitSignalRuleConfig(
        account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_confirm10_top5",
        label="Confirmed mixed entry",
        score_field="candidate_score",
        retention_score_field="board_score",
        entry_score_field="candidate_score",
        top_n=5,
        rank_exit_threshold=20,
        entry_confirmation_rebalances=2,
        entry_confirmation_rank=10,
    )

    weights = _signal_rule_weights(
        cfg,
        cache,
        board,
        day,
        prices_today,
        account=account,
        entry_confirmed_symbols={"NEW_OK"},
    )

    assert weights == {"H1": 0.2, "H2": 0.2, "H3": 0.2, "H4": 0.2, "NEW_OK": 0.2}


def test_pit_signal_retained_cap_profit_cushion_can_delay_trimming() -> None:
    dates = [day.date() for day in pd.bdate_range("2024-01-02", "2024-02-02")]
    symbols = ["WIN", "A", "B", "C", "D"]
    close = pd.DataFrame(
        {
            "WIN": [100.0 if index < 4 else 1000.0 for index, _ in enumerate(dates)],
            "A": [100.0 for _ in dates],
            "B": [100.0 for _ in dates],
            "C": [100.0 for _ in dates],
            "D": [100.0 for _ in dates],
        },
        index=pd.to_datetime(dates),
    )
    board = PriceBoard(close=close, open=close.copy(), high=close.copy(), low=close.copy())
    reports = pd.DataFrame(
        [
            {
                "report_id": f"r-{symbol}",
                "symbol": symbol,
                "company": symbol,
                "publication_date": pd.Timestamp("2024-01-02"),
                "report_current_price_krw": 100.0,
                "target_price_krw": 200.0,
            }
            for symbol in symbols
        ]
    )
    plan, fees, cashflows = _common_inputs(dates)
    cfg = PitSignalRuleConfig(
        account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5",
        label="Weekly cap with profit cushion",
        top_n=5,
        rebalance="quarterly",
        allow_rebalance_sell_down=False,
        retained_weight_cap=0.40,
        retained_weight_cap_trigger=0.45,
        retained_weight_cap_cadence="weekly",
        retained_weight_cap_min_unrealized_return=10.0,
    )

    out = simulate_pit_signal_rule(cfg, plan, fees, board, reports, cashflows, dates)

    sells = [trade for trade in out.account.trades if trade.side == "sell" and trade.symbol == "WIN"]
    assert sells == []


def test_pit_signal_trailing_profit_stop_sells_after_winner_drawdown() -> None:
    dates = [day.date() for day in pd.bdate_range("2024-01-02", "2024-02-02")]
    prices = [100.0, 120.0, 160.0, 220.0, 210.0, 150.0] + [150.0 for _ in dates[6:]]
    close = pd.DataFrame({"WIN": prices}, index=pd.to_datetime(dates))
    board = PriceBoard(close=close, open=close.copy(), high=close.copy(), low=close.copy())
    reports = pd.DataFrame(
        [
            {
                "report_id": "r-WIN",
                "symbol": "WIN",
                "company": "WIN",
                "publication_date": pd.Timestamp("2024-01-02"),
                "report_current_price_krw": 100.0,
                "target_price_krw": 300.0,
            }
        ]
    )
    plan, fees, cashflows = _common_inputs(dates)
    cfg = PitSignalRuleConfig(
        account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trail25_top5",
        label="Trailing profit stop",
        top_n=1,
        rebalance="monthly",
        trail_stop_min_unrealized_return=1.0,
        trail_stop_drawdown_pct=0.25,
    )

    out = simulate_pit_signal_rule(cfg, plan, fees, board, reports, cashflows, dates)

    trailing_sells = [trade for trade in out.account.trades if trade.reason == "trailing_profit_stop"]
    assert len(trailing_sells) == 1
    assert trailing_sells[0].symbol == "WIN"
    assert trailing_sells[0].date == dates[5]


def test_pit_signal_trailing_profit_trim_keeps_core_position() -> None:
    dates = [day.date() for day in pd.bdate_range("2024-01-02", "2024-02-02")]
    prices = [100.0, 120.0, 160.0, 220.0, 210.0, 150.0] + [150.0 for _ in dates[6:]]
    close = pd.DataFrame({"WIN": prices}, index=pd.to_datetime(dates))
    board = PriceBoard(close=close, open=close.copy(), high=close.copy(), low=close.copy())
    reports = pd.DataFrame(
        [
            {
                "report_id": "r-WIN",
                "symbol": "WIN",
                "company": "WIN",
                "publication_date": pd.Timestamp("2024-01-02"),
                "report_current_price_krw": 100.0,
                "target_price_krw": 300.0,
            }
        ]
    )
    plan, fees, cashflows = _common_inputs(dates)
    cfg = PitSignalRuleConfig(
        account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25_top5",
        label="Trailing profit trim",
        top_n=1,
        rebalance="monthly",
        trail_trim_min_unrealized_return=1.0,
        trail_trim_drawdown_pct=0.25,
        trail_trim_weight_cap=0.40,
    )

    out = simulate_pit_signal_rule(cfg, plan, fees, board, reports, cashflows, dates)

    buys = [trade for trade in out.account.trades if trade.side == "buy" and trade.symbol == "WIN"]
    trims = [trade for trade in out.account.trades if trade.reason == "trailing_profit_trim"]
    assert buys
    assert trims
    assert trims[0].date == dates[5]
    assert trims[0].qty < buys[0].qty


def test_pit_signal_trailing_profit_trim_cooldown_suppresses_repeated_trims() -> None:
    dates = [day.date() for day in pd.bdate_range("2024-01-02", "2024-01-19")]
    prices = [100.0, 180.0, 240.0, 150.0, 420.0, 300.0] + [300.0 for _ in dates[6:]]
    close = pd.DataFrame({"WIN": prices}, index=pd.to_datetime(dates))
    board = PriceBoard(close=close, open=close.copy(), high=close.copy(), low=close.copy())
    reports = pd.DataFrame(
        [
            {
                "report_id": "r-WIN",
                "symbol": "WIN",
                "company": "WIN",
                "publication_date": pd.Timestamp("2024-01-02"),
                "report_current_price_krw": 100.0,
                "target_price_krw": 300.0,
            }
        ]
    )
    plan, fees, cashflows = _common_inputs(dates)
    base_cfg = PitSignalRuleConfig(
        account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25_top5",
        label="Trailing profit trim",
        top_n=1,
        rebalance="monthly",
        trail_trim_min_unrealized_return=1.0,
        trail_trim_drawdown_pct=0.25,
        trail_trim_weight_cap=0.40,
    )
    cool_cfg = base_cfg.model_copy(
        update={
            "account_id": "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_cool20_top5",
            "label": "Trailing profit trim cooldown",
            "trail_trim_cooldown_days": 20,
        }
    )

    no_cool = simulate_pit_signal_rule(base_cfg, plan, fees, board, reports, cashflows, dates)
    cool = simulate_pit_signal_rule(cool_cfg, plan, fees, board, reports, cashflows, dates)

    no_cool_trims = [trade for trade in no_cool.account.trades if trade.reason == "trailing_profit_trim"]
    cool_trims = [trade for trade in cool.account.trades if trade.reason == "trailing_profit_trim"]
    assert [trade.date for trade in no_cool_trims[:2]] == [dates[3], dates[5]]
    assert len(no_cool_trims) > len(cool_trims)
    assert [trade.date for trade in cool_trims] == [dates[3]]


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


def test_account_summaries_have_finite_irr(synthetic_board, synthetic_reports, synthetic_dates):
    import math

    plan, fees, cashflows = _common_inputs(synthetic_dates)
    out = simulate_prophet(
        ProphetConfig(), plan, fees, synthetic_board, synthetic_reports, cashflows, synthetic_dates
    )
    irr = out.summary.money_weighted_return
    assert math.isfinite(irr)


def test_risk_metrics_from_equity_points():
    points = [
        EquityPoint(
            account_id="x",
            date=date(2024, 1, i),
            cash_krw=1000.0,
            holdings_value_krw=0.0,
            equity_krw=1000.0 + i * 10.0,
            contributed_capital_krw=1000.0,
            net_profit_krw=i * 10.0,
            open_positions=0,
        )
        for i in range(1, 6)
    ]
    sharpe = sharpe_ratio(points)
    sortino = sortino_ratio(points)
    assert sharpe is not None and sharpe > 0
    # Monotone uptrend has only positive returns; Sortino is undefined with zero downside.
    assert sortino is None
