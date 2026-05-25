from __future__ import annotations

from pathlib import Path

import pandas as pd

from snusmic_pipeline.sim.research_report import build_research_report


def test_build_research_report_emits_summary_delta_and_reasons(tmp_path: Path):
    sim_dir = tmp_path
    pd.DataFrame(
        [
            {
                "account_id": "base",
                "money_weighted_return": 0.1,
                "time_weighted_return": 0.2,
                "cagr": 0.03,
                "max_drawdown": 0.04,
                "sharpe": 1.0,
                "sortino": 1.2,
                "final_equity_krw": 110_000_000,
                "trade_count": 2,
            },
            {
                "account_id": "candidate",
                "money_weighted_return": 0.2,
                "time_weighted_return": 0.4,
                "cagr": 0.05,
                "max_drawdown": 0.06,
                "sharpe": 1.1,
                "sortino": 1.3,
                "final_equity_krw": 130_000_000,
                "trade_count": 3,
            },
        ]
    ).to_csv(sim_dir / "summary.csv", index=False)
    pd.DataFrame(
        [
            {"account_id": "base", "date": "2024-01-01", "equity_krw": 100_000_000},
            {"account_id": "base", "date": "2024-01-02", "equity_krw": 110_000_000},
            {"account_id": "candidate", "date": "2024-01-01", "equity_krw": 100_000_000},
            {"account_id": "candidate", "date": "2024-01-02", "equity_krw": 130_000_000},
        ]
    ).to_csv(sim_dir / "equity_daily.csv", index=False)
    pd.DataFrame(
        [
            {"account_id": "base", "reason": "rebalance_buy"},
            {"account_id": "candidate", "reason": "rebalance_buy"},
            {"account_id": "candidate", "reason": "retained_cap_trim"},
        ]
    ).to_csv(sim_dir / "trades.csv", index=False)

    report = build_research_report(
        sim_dir,
        ["base", "candidate"],
        baseline_id="base",
        title="Test Extract",
    )

    assert "# Test Extract" in report
    assert "`candidate` | 20.00% | 40.00% | 5.00%" in report
    assert "`candidate` | 20.0M | 50.00% | 0.0M | 20.0M" in report
    assert "`candidate` | 1 | 1 |" in report


def test_build_research_report_rejects_missing_accounts(tmp_path: Path):
    sim_dir = tmp_path
    pd.DataFrame(
        [
            {
                "account_id": "base",
                "money_weighted_return": 0.1,
                "time_weighted_return": 0.2,
                "cagr": 0.03,
                "max_drawdown": 0.04,
                "sharpe": 1.0,
                "sortino": 1.2,
                "final_equity_krw": 110_000_000,
                "trade_count": 2,
            }
        ]
    ).to_csv(sim_dir / "summary.csv", index=False)
    pd.DataFrame([{"account_id": "base", "date": "2024-01-01", "equity_krw": 100_000_000}]).to_csv(
        sim_dir / "equity_daily.csv", index=False
    )
    pd.DataFrame([{"account_id": "base", "reason": "rebalance_buy"}]).to_csv(
        sim_dir / "trades.csv", index=False
    )

    try:
        build_research_report(sim_dir, ["missing"])
    except ValueError as exc:
        assert "missing" in str(exc)
    else:
        raise AssertionError("missing account should fail")
