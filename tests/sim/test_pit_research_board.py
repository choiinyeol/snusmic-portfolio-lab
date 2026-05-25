from __future__ import annotations

from datetime import date

import pandas as pd
import pytest

from snusmic_pipeline.sim.market import PriceBoard
from snusmic_pipeline.sim.pit_research_board import (
    build_pit_research_board,
    build_pit_research_board_snapshots,
)


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


def test_target_hit_is_point_in_time_not_full_future_window() -> None:
    before_hit = build_pit_research_board(_reports(), _board(), date(2024, 1, 4), max_report_age_days=3650)
    after_hit = build_pit_research_board(_reports(), _board(), date(2024, 1, 8), max_report_age_days=3650)

    before = {row.symbol: row for row in before_hit}
    after = {row.symbol: row for row in after_hit}

    assert before["HIT"].target_hit is False
    assert after["HIT"].target_hit is True


def test_pit_snapshots_emit_ranked_rows_without_trade_instructions() -> None:
    board = _board()
    trading_dates = board.trading_dates(date(2024, 1, 2), date(2024, 1, 12))

    snapshots = build_pit_research_board_snapshots(
        _reports(),
        board,
        trading_dates,
        cadence="D",
        max_report_age_days=3650,
    )
    bbb_snapshots = [row for row in snapshots if row["symbol"] == "BBB"]

    assert bbb_snapshots
    assert all(pd.Timestamp(row["as_of_date"]).date() >= date(2024, 1, 9) for row in bbb_snapshots)
    assert "trade_date" not in snapshots[0]
    assert "weight" not in snapshots[0]


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
    assert row.price_quality_flag == "explicit_scale"


def test_pit_board_repairs_report_quote_unit_errors_against_market_price() -> None:
    close = pd.DataFrame(
        {"UNIT.KQ": [9_210.0, 9_500.0]},
        index=pd.to_datetime(["2023-10-19", "2023-10-20"]),
    )
    board = PriceBoard(close=close, open=close.copy(), high=close.copy(), low=close.copy())
    reports = pd.DataFrame(
        [
            {
                "report_id": "r-unit",
                "symbol": "UNIT.KQ",
                "company": "Unit Broken",
                "publication_date": pd.Timestamp("2023-10-19"),
                "report_current_price_krw": 9.6,
                "target_price_krw": 18_600.0,
                "target_price_scale_factor": 1.0,
            },
        ]
    )

    [row] = build_pit_research_board(reports, board, date(2023, 10, 20), max_report_age_days=3650)

    assert row.entry_price_krw == 9_210.0
    assert row.target_price_krw == 18_600.0
    assert row.target_upside_at_pub == pytest.approx(18_600.0 / 9_210.0 - 1.0)
    assert row.current_return == pytest.approx(9_500.0 / 9_210.0 - 1.0)
    assert row.price_quality_flag == "entry_unit_scaled"
    assert row.entry_price_source == "market_price"
