from __future__ import annotations

from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from snusmic_pipeline.sim.broker_strategy_search import find_top_broker_strategy_configs
from snusmic_pipeline.sim.contracts import BrokerageFees, SavingsPlan


@pytest.fixture
def broker_search_warehouse(tmp_path: Path) -> Path:
    warehouse = tmp_path / "wh"
    warehouse.mkdir()
    dates = pd.bdate_range("2024-01-02", "2025-12-31")
    rng = np.random.default_rng(11)
    rows = []
    for symbol, series in {
        "WIN.KS": np.linspace(100.0, 220.0, len(dates)) + rng.normal(0, 1.0, len(dates)),
        "MID.KS": np.linspace(100.0, 105.0, len(dates)) + rng.normal(0, 1.0, len(dates)),
        "LOW.KS": np.linspace(100.0, 70.0, len(dates)) + rng.normal(0, 1.0, len(dates)),
    }.items():
        for day, close in zip(dates, series, strict=True):
            value = max(1.0, float(close))
            rows.append(
                {
                    "date": day.date().isoformat(),
                    "symbol": symbol,
                    "open": value,
                    "high": value,
                    "low": value,
                    "close": value,
                    "volume": 0,
                    "source_currency": "KRW",
                    "display_currency": "KRW",
                    "krw_per_unit": 1.0,
                }
            )
    pd.DataFrame(rows).to_csv(warehouse / "daily_prices.csv", index=False)
    pd.DataFrame(
        [
            {
                "report_id": f"r-{symbol.lower()}",
                "page": 1,
                "ordinal": ordinal,
                "publication_date": "2024-01-02",
                "title": symbol,
                "company": symbol,
                "ticker": symbol,
                "exchange": "KRX",
                "symbol": f"{symbol}.KS",
                "target_price": target,
                "target_price_krw": target,
            }
            for ordinal, symbol, target in [
                (1, "WIN", 200.0),
                (2, "MID", 110.0),
                (3, "LOW", 130.0),
            ]
        ]
    ).to_csv(warehouse / "reports.csv", index=False)
    return warehouse


def test_broker_strategy_search_records_benchmark_lag_without_hard_rejection(
    broker_search_warehouse: Path,
) -> None:
    result = find_top_broker_strategy_configs(
        warehouse_dir=broker_search_warehouse,
        start_date=date(2024, 1, 2),
        end_date=date(2025, 12, 31),
        train_start=date(2024, 1, 2),
        train_end=date(2024, 12, 31),
        plan=SavingsPlan(initial_capital_krw=1_000_000, monthly_contribution_krw=0),
        fees=BrokerageFees(commission_bps=0, sell_tax_bps=0, slippage_bps=0),
        benchmark_money_weighted_return=999.0,
        trials=5,
        top_n=5,
        seed=7,
    )

    assert result.configs
    assert not result.trial_rows.empty
    assert "below_benchmark" not in set(result.trial_rows["admission_status"])
    assert (result.trial_rows["excess_return_vs_best_benchmark"] < 0).any()
