"""Daily-forward checkpoint runner for the core investable accounts."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Annotated, Literal

import pandas as pd
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from .accounts import AccountRunOutput
from .accounts.all_weather import (
    AllWeatherStateSnapshot,
    build_all_weather_runtime,
    step_all_weather_day,
)
from .accounts.base import build_summary
from .accounts.smic_follower import (
    FollowerState,
    FollowerStateSnapshot,
    build_smic_follower_runtime,
    step_smic_follower_day,
)
from .accounts.smic_follower_v2 import make_smic_follower_v2_stop_loss_hook
from .artifacts import write_simulation_artifacts
from .brokerage import Account, AccountSnapshot
from .contracts import (
    AccountConfig,
    AllWeatherConfig,
    EquityPoint,
    SimulationConfig,
    SimulationResult,
    SmicFollowerConfig,
    SmicFollowerV2Config,
)
from .market import PriceBoard, load_benchmark_prices
from .runner import _prepare_reports, finalize_simulation_outputs, run_simulation
from .savings import build_cash_flow_schedule
from .target_adjustment import align_report_targets_to_market_scale
from .warehouse import read_table

CHECKPOINT_SCHEMA_VERSION = "1.0.0"
CHECKPOINT_FILE = "daily-forward-latest.json"
METADATA_FILE = "daily-forward-metadata.json"


class _CheckpointModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class FollowerAccountCheckpoint(_CheckpointModel):
    kind: Literal["follower"]
    account_id: str
    account: AccountSnapshot
    state: FollowerStateSnapshot
    previous_day: date | None
    equity_points: tuple[EquityPoint, ...]


class AllWeatherAccountCheckpoint(_CheckpointModel):
    kind: Literal["all_weather"]
    account_id: str
    account: AccountSnapshot
    state: AllWeatherStateSnapshot
    equity_points: tuple[EquityPoint, ...]


AccountCheckpoint = Annotated[
    FollowerAccountCheckpoint | AllWeatherAccountCheckpoint,
    Field(discriminator="kind"),
]


class ForwardCheckpoint(_CheckpointModel):
    schema_version: str
    latest_date: date
    start_date: date
    end_date: date
    config_digest: str
    source_fingerprint: dict[str, str]
    accounts: dict[str, AccountCheckpoint]


@dataclass(frozen=True)
class ForwardRunReport:
    mode: Literal["forward", "full_replay", "noop"]
    latest_date: date
    checkpoint_path: Path
    metadata_path: Path
    full_replay_reason: str | None
    result: SimulationResult


def run_daily_forward(
    config: SimulationConfig,
    warehouse_dir: Path,
    out_dir: Path,
    *,
    refresh_benchmark: bool = False,
) -> ForwardRunReport:
    """Run core accounts from the latest checkpoint and write sim artifacts."""

    out_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_dir = out_dir / "checkpoints"
    checkpoint_path = checkpoint_dir / CHECKPOINT_FILE
    metadata_path = out_dir / METADATA_FILE

    core_config = config.model_copy(update={"accounts": _core_accounts(config.accounts)})
    if not core_config.accounts:
        raise RuntimeError("daily-forward requires at least one core account_id")

    board = PriceBoard.from_warehouse(warehouse_dir)
    trading_dates = board.trading_dates(start=core_config.start_date, end=core_config.end_date)
    if not trading_dates:
        raise RuntimeError("No trading dates available for daily-forward")

    reports = read_table(warehouse_dir, "reports")
    reports = _prepare_reports(reports, core_config.start_date, core_config.end_date)
    reports = align_report_targets_to_market_scale(reports, board, core_config.end_date)
    benchmark_board = _load_benchmark_board(core_config, warehouse_dir, refresh_benchmark)
    config_digest = _config_digest(core_config)

    checkpoint, full_replay_reason = _load_usable_checkpoint(
        checkpoint_path,
        warehouse_dir,
        config_digest,
        core_config,
    )
    latest_available = trading_dates[-1]
    if checkpoint is not None and checkpoint.latest_date > latest_available:
        checkpoint = None
        full_replay_reason = "checkpoint_after_requested_end"

    if checkpoint is not None and checkpoint.latest_date == latest_available:
        mode: Literal["forward", "full_replay", "noop"] = "noop"
        start_after = checkpoint.latest_date
    elif checkpoint is not None:
        mode = "forward"
        start_after = checkpoint.latest_date
    else:
        mode = "full_replay"
        start_after = None

    outputs, new_checkpoint = _run_core_accounts(
        config=core_config,
        reports=reports,
        board=board,
        benchmark_board=benchmark_board,
        trading_dates=trading_dates,
        checkpoint=checkpoint if mode in {"forward", "noop"} else None,
        start_after=start_after,
        source_fingerprint=_source_fingerprint(warehouse_dir, latest_available),
        config_digest=config_digest,
    )
    result = finalize_simulation_outputs(core_config, reports, board, benchmark_board, trading_dates, outputs)
    write_simulation_artifacts(result, out_dir)

    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_path.write_text(new_checkpoint.model_dump_json(indent=2), encoding="utf-8")
    full_replay_reason_value = full_replay_reason if mode == "full_replay" else None
    metadata = {
        "schema_version": "1.0.0",
        "run_mode": mode,
        "latest_date": latest_available.isoformat(),
        "checkpoint_date": new_checkpoint.latest_date.isoformat(),
        "checkpoint_schema_version": CHECKPOINT_SCHEMA_VERSION,
        "full_replay_reason": full_replay_reason_value,
        "source_fingerprint": new_checkpoint.source_fingerprint,
        "config_digest": config_digest,
    }
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return ForwardRunReport(
        mode=mode,
        latest_date=latest_available,
        checkpoint_path=checkpoint_path,
        metadata_path=metadata_path,
        full_replay_reason=full_replay_reason_value,
        result=result,
    )


def load_config_from_account_artifact(path: Path, *, start: date, end: date) -> SimulationConfig | None:
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    raw_accounts = data.get("accounts") if isinstance(data, dict) else None
    if not isinstance(raw_accounts, list):
        return None
    adapter: TypeAdapter[AccountConfig] = TypeAdapter(AccountConfig)
    accounts = tuple(adapter.validate_python(item) for item in raw_accounts)
    return SimulationConfig(start_date=start, end_date=end, accounts=accounts)


def _core_accounts(accounts: tuple[AccountConfig, ...]) -> tuple[AccountConfig, ...]:
    core: list[AccountConfig] = []
    for account_id in accounts:
        if isinstance(account_id, AllWeatherConfig | SmicFollowerConfig | SmicFollowerV2Config):
            core.append(account_id)
    return tuple(core)


def _load_benchmark_board(
    config: SimulationConfig,
    warehouse_dir: Path,
    refresh_benchmark: bool,
) -> PriceBoard | None:
    symbols: set[str] = set()
    for account_id in config.accounts:
        if isinstance(account_id, AllWeatherConfig):
            symbols.update(asset.symbol for asset in account_id.assets)
    if not symbols:
        return None
    return load_benchmark_prices(
        warehouse_dir,
        symbols,
        config.start_date,
        config.end_date,
        refresh=refresh_benchmark,
    )


def _run_core_accounts(
    *,
    config: SimulationConfig,
    reports: pd.DataFrame,
    board: PriceBoard,
    benchmark_board: PriceBoard | None,
    trading_dates: list[date],
    checkpoint: ForwardCheckpoint | None,
    start_after: date | None,
    source_fingerprint: dict[str, str],
    config_digest: str,
) -> tuple[list[AccountRunOutput], ForwardCheckpoint]:
    cashflows = build_cash_flow_schedule(trading_dates, config.savings_plan)
    tail_dates = [day for day in trading_dates if start_after is None or day > start_after]
    outputs: list[AccountRunOutput] = []
    account_checkpoints: dict[str, AccountCheckpoint] = {}

    for account_id in config.accounts:
        prior = checkpoint.accounts.get(account_id.account_id) if checkpoint else None
        if isinstance(account_id, AllWeatherConfig):
            if benchmark_board is None:
                raise RuntimeError("All Weather daily-forward requires benchmark prices")
            account = (
                Account.from_snapshot(prior.account)
                if isinstance(prior, AllWeatherAccountCheckpoint)
                else Account(account_id=account_id.account_id, fees=config.fees)
            )
            state_snapshot = prior.state if isinstance(prior, AllWeatherAccountCheckpoint) else None
            equity_points = (
                list(prior.equity_points) if isinstance(prior, AllWeatherAccountCheckpoint) else []
            )
            all_weather_runtime = build_all_weather_runtime(
                config=account_id,
                label=account_id.label,
                plan=config.savings_plan,
                benchmark_board=benchmark_board,
                cashflows=cashflows,
                trading_dates=trading_dates,
                account=account,
                state_snapshot=state_snapshot,
                equity_points=equity_points,
            )
            for day in tail_dates:
                step_all_weather_day(all_weather_runtime, day)
            outputs.append(
                AccountRunOutput(
                    account=all_weather_runtime.account,
                    equity_points=all_weather_runtime.equity_points,
                    summary=build_summary(
                        account_id.account_id,
                        account_id.label,
                        all_weather_runtime.account,
                        all_weather_runtime.equity_points,
                        cashflows,
                        config.savings_plan.initial_capital_krw,
                    ),
                )
            )
            account_checkpoints[account_id.account_id] = AllWeatherAccountCheckpoint(
                kind="all_weather",
                account_id=account_id.account_id,
                account=all_weather_runtime.account.to_snapshot(),
                state=all_weather_runtime.to_state_snapshot(),
                equity_points=tuple(all_weather_runtime.equity_points),
            )
            continue

        if isinstance(account_id, SmicFollowerConfig | SmicFollowerV2Config):
            account = (
                Account.from_snapshot(prior.account)
                if isinstance(prior, FollowerAccountCheckpoint)
                else Account(account_id=account_id.account_id, fees=config.fees)
            )
            state = (
                FollowerState.from_snapshot(prior.state)
                if isinstance(prior, FollowerAccountCheckpoint)
                else None
            )
            previous_day = prior.previous_day if isinstance(prior, FollowerAccountCheckpoint) else None
            equity_points = list(prior.equity_points) if isinstance(prior, FollowerAccountCheckpoint) else []
            stop_loss_hook = (
                make_smic_follower_v2_stop_loss_hook(account_id)
                if isinstance(account_id, SmicFollowerV2Config)
                else None
            )
            follower_runtime = build_smic_follower_runtime(
                account_id=account_id.account_id,
                label=account_id.label,
                rebalance_cadence=account_id.rebalance,
                target_hit_multiplier=account_id.target_hit_multiplier,
                plan=config.savings_plan,
                reports=reports,
                board=board,
                cashflows=cashflows,
                trading_dates=trading_dates,
                account=account,
                stop_loss_hook=stop_loss_hook,
                expiry_days=config.report_expiry_days,
                allow_rebalance_sells=False,
                state=state,
                previous_day=previous_day,
                equity_points=equity_points,
            )
            for day in tail_dates:
                step_smic_follower_day(follower_runtime, day)
            outputs.append(
                AccountRunOutput(
                    account=follower_runtime.account,
                    equity_points=follower_runtime.equity_points,
                    summary=build_summary(
                        account_id.account_id,
                        account_id.label,
                        follower_runtime.account,
                        follower_runtime.equity_points,
                        cashflows,
                        config.savings_plan.initial_capital_krw,
                    ),
                )
            )
            account_checkpoints[account_id.account_id] = FollowerAccountCheckpoint(
                kind="follower",
                account_id=account_id.account_id,
                account=follower_runtime.account.to_snapshot(),
                state=follower_runtime.state.to_snapshot(),
                previous_day=follower_runtime.previous_day,
                equity_points=tuple(follower_runtime.equity_points),
            )
            continue

    latest = trading_dates[-1]
    return outputs, ForwardCheckpoint(
        schema_version=CHECKPOINT_SCHEMA_VERSION,
        latest_date=latest,
        start_date=config.start_date,
        end_date=config.end_date,
        config_digest=config_digest,
        source_fingerprint=source_fingerprint,
        accounts=account_checkpoints,
    )


def _load_usable_checkpoint(
    checkpoint_path: Path,
    warehouse_dir: Path,
    config_digest: str,
    config: SimulationConfig,
) -> tuple[ForwardCheckpoint | None, str | None]:
    if not checkpoint_path.exists():
        return None, "missing_checkpoint"
    try:
        checkpoint = ForwardCheckpoint.model_validate_json(checkpoint_path.read_text(encoding="utf-8"))
    except Exception as exc:
        return None, f"invalid_checkpoint:{type(exc).__name__}"
    if checkpoint.schema_version != CHECKPOINT_SCHEMA_VERSION:
        return None, "checkpoint_schema_mismatch"
    if checkpoint.config_digest != config_digest:
        return None, "config_mismatch"
    expected_accounts = {account_id.account_id for account_id in _core_accounts(config.accounts)}
    if set(checkpoint.accounts) != expected_accounts:
        return None, "account_set_mismatch"
    current_historical = _source_fingerprint(warehouse_dir, checkpoint.latest_date)
    if current_historical != checkpoint.source_fingerprint:
        return None, "historical_source_changed"
    return checkpoint, None


def _config_digest(config: SimulationConfig) -> str:
    payload = config.model_dump(mode="json")
    payload.pop("end_date", None)
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def _source_fingerprint(warehouse_dir: Path, through_date: date) -> dict[str, str]:
    files = ("reports.csv", "daily_prices.csv", "benchmark_prices.csv", "fx_rates.csv")
    return {name: _fingerprint_csv(warehouse_dir / name, through_date) for name in files}


def _fingerprint_csv(path: Path, through_date: date) -> str:
    if not path.exists():
        return "missing"
    frame = pd.read_csv(path)
    if "date" in frame.columns:
        dates = pd.to_datetime(frame["date"], errors="coerce").dt.date
        frame = frame.loc[dates <= through_date].copy()
    elif "publication_date" in frame.columns:
        dates = pd.to_datetime(frame["publication_date"], errors="coerce").dt.date
        frame = frame.loc[dates <= through_date].copy()
    columns = sorted(frame.columns)
    if columns:
        frame = frame[columns].sort_values(columns, kind="mergesort")
    payload = frame.fillna("").to_csv(index=False)
    return hashlib.sha256(payload.encode()).hexdigest()


def full_replay_core(
    config: SimulationConfig,
    warehouse_dir: Path,
    *,
    refresh_benchmark: bool = False,
) -> SimulationResult:
    """Explicit full replay helper for tests and checkpoint comparisons."""

    return run_simulation(
        config.model_copy(update={"accounts": _core_accounts(config.accounts)}),
        warehouse_dir,
        refresh_benchmark=refresh_benchmark,
    )
