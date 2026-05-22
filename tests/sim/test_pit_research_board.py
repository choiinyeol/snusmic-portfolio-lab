from __future__ import annotations

from datetime import date

import pandas as pd
import pytest

from snusmic_pipeline.sim.brokerage import Account
from snusmic_pipeline.sim.contracts import BrokerageFees, PitResearchBoardConfig, SavingsPlan
from snusmic_pipeline.sim.market import PriceBoard
from snusmic_pipeline.sim.pit_research_board import (
    PitResearchBoardRow,
    PitSelection,
    _rebalance_to_selection,
    build_pit_research_board,
    select_pit_research_board,
    simulate_pit_research_board,
    snapshot_rows_for_config,
)
from snusmic_pipeline.sim.savings import build_cash_flow_schedule


def _board() -> PriceBoard:
    dates = pd.bdate_range("2024-01-02", "2024-01-12")
    close = pd.DataFrame(
        {
            "AAA": [100, 101, 102, 103, 104, 105, 106, 107, 108],
            "BBB": [90, 90, 90, 90, 90, 90, 91, 92, 93],
            "HIT": [100, 101, 102, 130, 131, 132, 133, 134, 135],
        },
        index=dates,
        dtype=float,
    )
    return PriceBoard(close=close, open=close.copy(), high=close.copy(), low=close.copy())


def _reports() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "report_id": "r-aaa",
                "symbol": "AAA",
                "company": "A Alpha",
                "publication_date": pd.Timestamp("2024-01-03"),
                "report_current_price_krw": 100.0,
                "target_price_krw": 150.0,
            },
            {
                "report_id": "r-bbb-future",
                "symbol": "BBB",
                "company": "B Beta",
                "publication_date": pd.Timestamp("2024-01-09"),
                "report_current_price_krw": 90.0,
                "target_price_krw": 300.0,
            },
            {
                "report_id": "r-hit",
                "symbol": "HIT",
                "company": "Hit Target",
                "publication_date": pd.Timestamp("2024-01-03"),
                "report_current_price_krw": 100.0,
                "target_price_krw": 120.0,
            },
        ]
    )


def test_pit_board_uses_only_reports_and_prices_known_as_of_date() -> None:
    rows = build_pit_research_board(_reports(), _board(), date(2024, 1, 5), max_report_age_days=3650)

    symbols = {row.symbol for row in rows}

    assert "BBB" not in symbols
    assert {"r-aaa", "r-hit"}.issubset({row.report_id for row in rows})
    assert all(row.publication_date <= date(2024, 1, 5) for row in rows)
    assert all(row.price_date <= date(2024, 1, 5) for row in rows)


def test_target_hit_filter_is_point_in_time_not_full_future_window() -> None:
    config = PitResearchBoardConfig(
        persona_name="pit_research_board_score_top5",
        label="PIT Board",
        top_n=5,
        max_report_age_days=3650,
    )

    before_hit = select_pit_research_board(_reports(), _board(), date(2024, 1, 4), config)
    after_hit = select_pit_research_board(_reports(), _board(), date(2024, 1, 8), config)

    assert "HIT" in {row.symbol for row in before_hit.rows}
    assert "HIT" not in {row.symbol for row in after_hit.rows}


def test_pit_strategy_trades_next_session_after_snapshot_and_never_before_publication() -> None:
    board = _board()
    trading_dates = board.trading_dates(date(2024, 1, 2), date(2024, 1, 12))
    config = PitResearchBoardConfig(
        persona_name="pit_research_board_score_top5",
        label="PIT Board",
        top_n=1,
        rebalance="D",
        max_report_age_days=3650,
    )
    plan = SavingsPlan(initial_capital_krw=1_000_000, monthly_contribution_krw=0)
    output = simulate_pit_research_board(
        config,
        plan,
        BrokerageFees(commission_bps=0, sell_tax_bps=0, slippage_bps=0),
        board,
        _reports(),
        build_cash_flow_schedule(trading_dates, plan),
        trading_dates,
    )

    buy_dates_by_symbol = {
        trade.symbol: trade.date
        for trade in output.account.trades
        if trade.side == "buy" and trade.symbol == "BBB"
    }
    snapshots = snapshot_rows_for_config(config, _reports(), board, trading_dates)
    bbb_snapshots = [row for row in snapshots if row["symbol"] == "BBB" and row["trade_date"]]

    assert buy_dates_by_symbol["BBB"] > date(2024, 1, 9)
    assert bbb_snapshots
    assert all(
        pd.Timestamp(row["trade_date"]).date() > pd.Timestamp(row["as_of_date"]).date()
        for row in bbb_snapshots
    )
    assert all(
        pd.Timestamp(row["as_of_date"]).date() >= pd.Timestamp(row["publication_date"]).date()
        for row in bbb_snapshots
    )


def test_pit_strategy_applies_alpha_stop_take_profit_and_blocks_same_report_reentry() -> None:
    dates = pd.bdate_range("2024-01-02", "2024-01-12")
    close = pd.DataFrame(
        {
            "DROP": [100, 100, 100, 100, 90, 89, 88, 87, 86],
            "POP": [100, 100, 100, 100, 125, 126, 127, 128, 129],
        },
        index=dates,
        dtype=float,
    )
    high = close.copy()
    low = close.copy()
    high.loc[pd.Timestamp("2024-01-08"), "POP"] = 125
    low.loc[pd.Timestamp("2024-01-08"), "DROP"] = 88
    board = PriceBoard(close=close, open=close.copy(), high=high, low=low)
    reports = pd.DataFrame(
        [
            {
                "report_id": "r-drop",
                "symbol": "DROP",
                "company": "Drop Risk",
                "publication_date": pd.Timestamp("2024-01-03"),
                "report_current_price_krw": 100.0,
                "target_price_krw": 300.0,
            },
            {
                "report_id": "r-pop",
                "symbol": "POP",
                "company": "Pop Winner",
                "publication_date": pd.Timestamp("2024-01-03"),
                "report_current_price_krw": 100.0,
                "target_price_krw": 300.0,
            },
        ]
    )
    trading_dates = board.trading_dates(date(2024, 1, 2), date(2024, 1, 12))
    config = PitResearchBoardConfig(
        persona_name="pit_research_board_alpha_trial1",
        label="PIT Alpha",
        top_n=2,
        rebalance="D",
        max_report_age_days=3650,
        stop_loss_pct=0.10,
        take_profit_pct=0.20,
    )
    plan = SavingsPlan(initial_capital_krw=1_000_000, monthly_contribution_krw=0)
    output = simulate_pit_research_board(
        config,
        plan,
        BrokerageFees(commission_bps=0, sell_tax_bps=0, slippage_bps=0),
        board,
        reports,
        build_cash_flow_schedule(trading_dates, plan),
        trading_dates,
    )

    sells = [trade for trade in output.account.trades if trade.side == "sell"]
    buys_after_exit = [
        trade for trade in output.account.trades if trade.side == "buy" and trade.date > date(2024, 1, 5)
    ]

    assert any(trade.symbol == "DROP" and trade.reason == "stop_loss_price" for trade in sells)
    assert any(trade.symbol == "POP" and trade.reason == "target_hit" for trade in sells)
    assert buys_after_exit == []


def test_pit_strategy_can_hold_target_winner_after_target_touch() -> None:
    dates = pd.bdate_range("2024-01-02", "2024-01-12")
    close = pd.DataFrame(
        {
            "RUN": [100, 100, 110, 121, 130, 140, 150, 160, 170],
        },
        index=dates,
        dtype=float,
    )
    board = PriceBoard(close=close, open=close.copy(), high=close.copy(), low=close.copy())
    reports = pd.DataFrame(
        [
            {
                "report_id": "r-run",
                "symbol": "RUN",
                "company": "Runner",
                "publication_date": pd.Timestamp("2024-01-03"),
                "report_current_price_krw": 100.0,
                "target_price_krw": 120.0,
            },
        ]
    )
    trading_dates = board.trading_dates(date(2024, 1, 2), date(2024, 1, 12))
    plan = SavingsPlan(initial_capital_krw=1_000_000, monthly_contribution_krw=0)
    output = simulate_pit_research_board(
        PitResearchBoardConfig(
            persona_name="pit_research_board_alpha_trial1",
            label="PIT Runner",
            top_n=1,
            rebalance="D",
            max_report_age_days=3650,
            hold_target_winners=True,
        ),
        plan,
        BrokerageFees(commission_bps=0, sell_tax_bps=0, slippage_bps=0),
        board,
        reports,
        build_cash_flow_schedule(trading_dates, plan),
        trading_dates,
    )

    sells = [trade for trade in output.account.trades if trade.side == "sell"]

    assert not any(trade.reason == "target_hit" for trade in sells)
    assert any(trade.reason == "end_of_sim" and trade.fill_price_krw == 170.0 for trade in sells)


def test_sub_target_multiplier_means_progress_not_discounted_target_price() -> None:
    dates = pd.bdate_range("2024-01-02", "2024-01-12")
    close = pd.DataFrame(
        {
            "RUN": [100, 100, 100, 110, 113, 115, 116, 117, 118],
        },
        index=dates,
        dtype=float,
    )
    board = PriceBoard(close=close, open=close.copy(), high=close.copy(), low=close.copy())
    reports = pd.DataFrame(
        [
            {
                "report_id": "r-run",
                "symbol": "RUN",
                "company": "Runner",
                "publication_date": pd.Timestamp("2024-01-03"),
                "report_current_price_krw": 100.0,
                "target_price_krw": 120.0,
            },
        ]
    )
    trading_dates = board.trading_dates(date(2024, 1, 2), date(2024, 1, 12))
    plan = SavingsPlan(initial_capital_krw=1_000_000, monthly_contribution_krw=0)
    output = simulate_pit_research_board(
        PitResearchBoardConfig(
            persona_name="pit_research_board_alpha_trial1",
            label="PIT Partial Target",
            top_n=1,
            rebalance="D",
            max_report_age_days=3650,
            target_hit_multiplier=0.70,
        ),
        plan,
        BrokerageFees(commission_bps=0, sell_tax_bps=0, slippage_bps=0),
        board,
        reports,
        build_cash_flow_schedule(trading_dates, plan),
        trading_dates,
    )

    target_sells = [
        trade for trade in output.account.trades if trade.side == "sell" and trade.reason == "target_hit"
    ]

    assert target_sells
    assert target_sells[0].fill_price_krw == 114.0
    assert target_sells[0].fill_price_krw > 100.0


def test_pit_board_uses_market_scale_entry_for_adjusted_targets() -> None:
    close = pd.DataFrame(
        {"SPLT.KQ": [25_000.0, 26_000.0]},
        index=pd.to_datetime(["2024-01-08", "2024-01-09"]),
    )
    board = PriceBoard(close=close, open=close.copy(), high=close.copy(), low=close.copy())
    reports = pd.DataFrame(
        [
            {
                "report_id": "r-split",
                "symbol": "SPLT.KQ",
                "company": "Split Co",
                "publication_date": pd.Timestamp("2024-01-06"),
                "report_current_price_krw": 100_000.0,
                "target_price_krw": 40_000.0,
                "target_price_scale_factor": 0.25,
            },
        ]
    )

    [row] = build_pit_research_board(reports, board, date(2024, 1, 9), max_report_age_days=3650)

    assert row.entry_price_krw == 25_000.0
    assert row.target_price_krw == 40_000.0
    assert row.target_upside_at_pub == pytest.approx(0.6)


def test_retained_winner_does_not_starve_new_candidate_sleeve() -> None:
    when = date(2024, 2, 1)
    fees = BrokerageFees(commission_bps=0, sell_tax_bps=0, slippage_bps=0)
    account = Account(persona="pit_research_board_alpha_trial1", fees=fees)
    account.deposit(when, 101_000)
    account.buy_value(when, "WIN", 1_000, 100_000, "rebalance_buy", "r-win")
    prices = {"WIN": 1_000.0, "ZZZ": 100.0, "AAA": 100.0}
    selection = PitSelection(
        as_of_date=when,
        rows=(
            _minimal_row("ZZZ", "r-zzz", 1.0),
            _minimal_row("AAA", "r-aaa", 0.5),
        ),
        weights={"ZZZ": 0.5, "AAA": 0.5},
        report_ids={"ZZZ": "r-zzz", "AAA": "r-aaa"},
    )

    _rebalance_to_selection(
        account,
        when,
        selection,
        prices,
        report_ids_by_symbol={"WIN": "r-win"},
        target_winner_report_ids={"r-win"},
        config=PitResearchBoardConfig(
            persona_name="pit_research_board_alpha_trial1",
            label="PIT Alpha",
            top_n=2,
            hold_target_winners=True,
        ),
    )

    buys = [trade.symbol for trade in account.trades if trade.side == "buy" and trade.symbol != "WIN"]

    assert buys == ["ZZZ", "AAA"]
    assert account.holdings["ZZZ"].qty == 5
    assert account.holdings["AAA"].qty == 5


def _minimal_row(symbol: str, report_id: str, score: float) -> PitResearchBoardRow:
    return PitResearchBoardRow(
        as_of_date=date(2024, 2, 1),
        price_date=date(2024, 2, 1),
        report_id=report_id,
        symbol=symbol,
        company=symbol,
        publication_date=date(2024, 1, 31),
        report_age_days=1,
        entry_price_krw=100.0,
        target_price_krw=200.0,
        last_close_krw=100.0,
        target_upside_at_pub=1.0,
        current_return=0.0,
        target_gap_pct=-0.5,
        ytd_return=None,
        return_1m=None,
        return_3m=None,
        return_6m=None,
        return_1y=None,
        distance_from_52w_high=None,
        above_20ma=None,
        above_50ma=None,
        above_200ma=None,
        ma_stack=None,
        ema_stack=None,
        macd_line=None,
        macd_signal=None,
        macd_hist=None,
        macd_bullish=None,
        target_hit=False,
        expired=False,
        bucket="fresh",
        rank_basis="test",
        candidate_score=score,
        board_score=score,
        ta_momentum_score=score,
    )
