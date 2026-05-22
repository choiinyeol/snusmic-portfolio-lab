from __future__ import annotations

from datetime import date

import pandas as pd

from snusmic_pipeline.sim.market import PriceBoard
from snusmic_pipeline.sim.target_adjustment import adjusted_target_price_krw, market_scale_factor


def test_weekend_publication_scales_target_from_first_actionable_close() -> None:
    close = pd.DataFrame(
        {"SPLT.KQ": [25_000.0]},
        index=pd.to_datetime(["2024-01-08"]),
    )
    board = PriceBoard(close=close, open=close.copy(), high=close.copy(), low=close.copy())
    record = {
        "symbol": "SPLT.KQ",
        "report_current_price_krw": 100_000.0,
        "target_price_krw": 160_000.0,
    }

    factor = market_scale_factor(record, board, date(2024, 1, 6), date(2024, 1, 8))

    assert factor == 0.25
    assert adjusted_target_price_krw(record, board, date(2024, 1, 6), date(2024, 1, 8)) == 40_000.0


def test_price_board_refreshes_when_same_shape_frames_are_replaced() -> None:
    close = pd.DataFrame(
        {"AAA": [100.0, 101.0]},
        index=pd.to_datetime(["2024-01-02", "2024-01-03"]),
    )
    board = PriceBoard(close=close, open=close.copy(), high=close.copy(), low=close.copy())

    assert board.open_on(date(2024, 1, 2)) == {"AAA": 100.0}
    board.open = pd.DataFrame(
        {"AAA": [95.0, 96.0]},
        index=pd.to_datetime(["2024-01-02", "2024-01-03"]),
    )
    board.high = pd.DataFrame(
        {"AAA": [100.0, 150.0]},
        index=pd.to_datetime(["2024-01-02", "2024-01-03"]),
    )

    assert board.open_on(date(2024, 1, 2)) == {"AAA": 95.0}
    assert board.first_touch_in_window(date(2024, 1, 2), date(2024, 1, 3), "AAA", 140.0) == date(2024, 1, 3)


def test_price_board_refresh_updates_in_place_value_edits() -> None:
    close = pd.DataFrame(
        {"AAA": [100.0, 101.0]},
        index=pd.to_datetime(["2024-01-02", "2024-01-03"]),
    )
    board = PriceBoard(close=close, open=close.copy(), high=close.copy(), low=close.copy())

    assert board.close_on(date(2024, 1, 2)) == {"AAA": 100.0}
    board.close.loc[pd.Timestamp("2024-01-02"), "AAA"] = 120.0
    board.high.loc[pd.Timestamp("2024-01-03"), "AAA"] = 150.0
    board.refresh()

    assert board.close_on(date(2024, 1, 2)) == {"AAA": 120.0}
    assert board.first_touch_in_window(date(2024, 1, 2), date(2024, 1, 3), "AAA", 140.0) == date(2024, 1, 3)
