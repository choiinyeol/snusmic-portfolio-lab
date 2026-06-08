from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from snusmic_pipeline.web.artifacts import _build_account_catalog


def test_account_catalog_selectability_comes_from_shortlist_ids(tmp_path: Path) -> None:
    sim_config = tmp_path / "account-configs.json"
    sim_config.write_text(
        json.dumps(
            {
                "accounts": [
                    {
                        "account_id": "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5",
                        "label": "Partial 75",
                    },
                    {"account_id": "pit_score_top3", "label": "PIT Score Top 3"},
                    {"account_id": "benchmark_kodex200", "label": "KODEX 200"},
                ]
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    summary = pd.DataFrame(
        [
            {
                "account_id": "benchmark_kodex200",
                "label": "KODEX 200",
                "money_weighted_return": 0.4,
                "max_drawdown": 0.19,
                "sharpe": 1.0,
                "sortino": 1.2,
                "trade_count": 60,
                "final_equity_krw": 1,
                "final_cash_krw": 0,
                "final_holdings_value_krw": 1,
                "cagr": 0.2,
                "open_positions": 1,
            },
            {
                "account_id": "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5",
                "label": "Partial 75",
                "money_weighted_return": 0.5,
                "max_drawdown": 0.12,
                "sharpe": 1.2,
                "sortino": 1.4,
                "trade_count": 80,
                "final_equity_krw": 1,
                "final_cash_krw": 0,
                "final_holdings_value_krw": 1,
                "cagr": 0.25,
                "open_positions": 5,
            },
            {
                "account_id": "pit_score_top3",
                "label": "PIT Score Top 3",
                "money_weighted_return": 0.1,
                "max_drawdown": 0.3,
                "sharpe": 0.3,
                "sortino": 0.4,
                "trade_count": 120,
                "final_equity_krw": 1,
                "final_cash_krw": 0,
                "final_holdings_value_krw": 1,
                "cagr": 0.05,
                "open_positions": 3,
            },
        ]
    )

    rows = _build_account_catalog(summary, sim_config)
    rows_by_id = {row["account_id"]: row for row in rows}

    assert rows_by_id["pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5"]["is_selectable"] is True
    assert rows_by_id["pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5"]["shortlist_priority"] == 0
    assert rows_by_id["pit_score_top3"]["is_selectable"] is False
    assert rows_by_id["pit_score_top3"]["shortlist_priority"] is None
