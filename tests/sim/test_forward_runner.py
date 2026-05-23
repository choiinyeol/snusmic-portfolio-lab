from __future__ import annotations

from datetime import date
from pathlib import Path

import pandas as pd
import pytest

from snusmic_pipeline.sim.accounts.smic_follower import FollowerState
from snusmic_pipeline.sim.brokerage import Account
from snusmic_pipeline.sim.contracts import BrokerageFees, SimulationConfig
from snusmic_pipeline.sim.forward_runner import run_daily_forward

WAREHOUSE = Path("data/warehouse")


def test_account_snapshot_roundtrips_complete_brokerage_state() -> None:
    account = Account(
        account_id="p", fees=BrokerageFees(commission_bps=1.0, sell_tax_bps=2.0, slippage_bps=0.0)
    )
    account.deposit(date(2024, 1, 2), 1_000_000)
    account.buy_value(date(2024, 1, 2), "AAA", 10_000, 500_000, "deposit_buy", "r1")
    account.sell_qty(date(2024, 1, 3), "AAA", 11_000, 10, "target_hit", "r1")
    account.accrue_cash_yield(date(2024, 1, 4), 0.03, 1)

    restored = Account.from_snapshot(account.to_snapshot())

    assert restored.to_snapshot() == account.to_snapshot()


def test_account_state_snapshots_roundtrip_private_cursor_state() -> None:
    follower = FollowerState()
    follower.open_reports = {"AAA": [("r1", 12_000.0, date(2024, 1, 2))]}
    follower.stopped_out = {"BBB": date(2024, 1, 3)}
    follower._absorbed_ids = {"r1", "r2"}
    follower._cursor = 7

    follower_restored = FollowerState.from_snapshot(follower.to_snapshot())

    assert follower_restored.open_reports == follower.open_reports
    assert follower_restored.stopped_out == follower.stopped_out
    assert follower_restored._absorbed_ids == follower._absorbed_ids
    assert follower_restored._cursor == follower._cursor


@pytest.mark.slow
def test_checkpoint_tail_matches_full_replay_for_core_accounts(tmp_path: Path) -> None:
    config = _test_config(date(2021, 1, 4), date(2021, 2, 15))
    forward_out = tmp_path / "forward"
    full_out = tmp_path / "full"

    run_daily_forward(
        config.model_copy(update={"end_date": date(2021, 2, 10)}),
        WAREHOUSE,
        forward_out,
    )
    tail = run_daily_forward(config, WAREHOUSE, forward_out)
    full = run_daily_forward(config, WAREHOUSE, full_out)

    assert tail.mode == "forward"
    assert full.mode == "full_replay"
    for name in (
        "trades.csv",
        "equity_daily.csv",
        "daily_decisions.csv",
        "summary.csv",
        "current_holdings.csv",
    ):
        left = pd.read_csv(forward_out / name).fillna("")
        right = pd.read_csv(full_out / name).fillna("")
        assert left.equals(right), name


@pytest.mark.slow
def test_all_weather_checkpoint_crosses_new_rebalance_month(tmp_path: Path) -> None:
    config = _test_config(date(2021, 1, 4), date(2021, 3, 5))
    forward_out = tmp_path / "forward"
    full_out = tmp_path / "full"

    run_daily_forward(
        config.model_copy(update={"end_date": date(2021, 2, 26)}),
        WAREHOUSE,
        forward_out,
    )
    tail = run_daily_forward(config, WAREHOUSE, forward_out)
    full = run_daily_forward(config, WAREHOUSE, full_out)

    assert tail.mode == "forward"
    assert full.mode == "full_replay"
    for name in ("trades.csv", "equity_daily.csv", "daily_decisions.csv"):
        left = pd.read_csv(forward_out / name).fillna("")
        right = pd.read_csv(full_out / name).fillna("")
        assert left.equals(right), name


@pytest.mark.slow
def test_historical_source_change_uses_deterministic_replay(tmp_path: Path) -> None:
    config = _test_config(date(2021, 1, 4), date(2021, 2, 10))
    warehouse = tmp_path / "warehouse"
    _copy_minimal_warehouse(WAREHOUSE, warehouse)
    out = tmp_path / "out"

    run_daily_forward(config, warehouse, out)
    prices_path = warehouse / "daily_prices.csv"
    prices = pd.read_csv(prices_path)
    idx = prices.index[prices["date"].astype(str).eq("2021-01-04")][0]
    prices.loc[idx, "close"] = float(prices.loc[idx, "close"]) * 1.01
    prices.to_csv(prices_path, index=False)

    rerun = run_daily_forward(config.model_copy(update={"end_date": date(2021, 2, 15)}), warehouse, out)

    assert rerun.mode == "full_replay"
    assert rerun.full_replay_reason == "historical_source_changed"


@pytest.mark.slow
def test_checkpoint_after_requested_end_uses_deterministic_replay(tmp_path: Path) -> None:
    config = _test_config(date(2021, 1, 4), date(2021, 2, 15))
    out = tmp_path / "out"

    run_daily_forward(config, WAREHOUSE, out)
    rerun = run_daily_forward(config.model_copy(update={"end_date": date(2021, 2, 10)}), WAREHOUSE, out)

    assert rerun.mode == "full_replay"
    assert rerun.full_replay_reason == "checkpoint_after_requested_end"
    assert rerun.latest_date == date(2021, 2, 10)


def _test_config(start: date, end: date) -> SimulationConfig:
    return SimulationConfig(start_date=start, end_date=end)


def _copy_minimal_warehouse(src: Path, dst: Path) -> None:
    dst.mkdir(parents=True)
    for name in ("reports.csv", "daily_prices.csv", "benchmark_prices.csv", "fx_rates.csv"):
        source = src / name
        if source.exists():
            (dst / name).write_bytes(source.read_bytes())
