from __future__ import annotations

import pandas as pd

from snusmic_pipeline.sim.account_path_audit import _episode_symbol_pnl


def test_episode_symbol_pnl_combines_realized_and_unrealized():
    episodes = pd.DataFrame(
        [
            {
                "account_id": "a",
                "symbol": "AAA",
                "company": "AAA",
                "realized_pnl_krw": "100",
                "unrealized_pnl_krw": "",
            },
            {
                "account_id": "a",
                "symbol": "AAA",
                "company": "AAA",
                "realized_pnl_krw": "25",
                "unrealized_pnl_krw": "10",
            },
            {
                "account_id": "b",
                "symbol": "AAA",
                "company": "AAA",
                "realized_pnl_krw": "-5",
                "unrealized_pnl_krw": "0",
            },
        ]
    )

    result = _episode_symbol_pnl(episodes, ["a", "b"]).set_index(["account_id", "symbol"])

    assert result.loc[("a", "AAA"), "pnl"] == 135
    assert result.loc[("b", "AAA"), "pnl"] == -5
