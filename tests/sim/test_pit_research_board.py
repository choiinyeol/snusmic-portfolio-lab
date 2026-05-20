from __future__ import annotations

from datetime import date

import pandas as pd

from snusmic_pipeline.sim.contracts import BrokerageFees, PitResearchBoardConfig, SavingsPlan
from snusmic_pipeline.sim.market import PriceBoard
from snusmic_pipeline.sim.pit_research_board import (
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
