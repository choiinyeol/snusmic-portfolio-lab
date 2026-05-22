from __future__ import annotations

from datetime import date

import pandas as pd
import pytest

from snusmic_pipeline.sim import market


def test_benchmark_cache_rejects_stale_tail_without_silent_partial_comparison(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    warehouse = tmp_path
    pd.DataFrame(
        [
            {"date": "2021-01-04", "symbol": "QQQ", "open": 100.0, "close": 100.0},
            {"date": "2021-01-05", "symbol": "QQQ", "open": 101.0, "close": 101.0},
        ]
    ).to_csv(warehouse / "benchmark_prices.csv", index=False)

    monkeypatch.setattr(market, "download_history", lambda *args, **kwargs: pd.DataFrame())

    with pytest.raises(RuntimeError, match="incomplete date coverage"):
        market.load_benchmark_prices(
            warehouse,
            ["QQQ"],
            date(2021, 1, 4),
            date(2026, 5, 21),
            refresh=False,
        )
