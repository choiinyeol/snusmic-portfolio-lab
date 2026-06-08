"""Top-level simulation runner.

Reads :class:`SimulationConfig` + the warehouse on disk and produces a
:class:`SimulationResult` covering every requested account_id. Network I/O is
limited to the All-Weather benchmark loader (which caches on disk).
"""

from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

import pandas as pd

from .accounts import (
    AccountRunOutput,
    simulate_all_weather,
    simulate_pit_score_top_n,
    simulate_pit_signal_rule,
    simulate_prophet,
    simulate_smic_follower,
    simulate_smic_follower_v2,
    simulate_weak_prophet,
)
from .contracts import (
    AccountConfig,
    AllWeatherConfig,
    BrokerageFees,
    MonthlyHolding,
    PitScoreTopNConfig,
    PitSignalRuleConfig,
    ProphetConfig,
    SimulationConfig,
    SimulationResult,
    SmicFollowerConfig,
    SmicFollowerV2Config,
    WeakProphetConfig,
)
from .holdings import (
    compute_current_holdings,
    compute_monthly_holdings,
    compute_position_episodes,
    compute_symbol_stats,
)
from .market import PriceBoard, load_benchmark_prices
from .pit_research_board import PitResearchBoardCache
from .report_stats import (
    aggregate_report_stats,
    build_verification_cases,
    compute_report_performance,
    promote_alpha_hypotheses,
)
from .savings import CashFlowEvent, build_cash_flow_schedule
from .target_adjustment import align_report_targets_to_market_scale
from .warehouse import read_table


def run_simulation(
    config: SimulationConfig,
    warehouse_dir: Path,
    *,
    refresh_benchmark: bool = False,
) -> SimulationResult:
    """Run every account_id in ``config.accounts`` and return a result bundle."""
    board = PriceBoard.from_warehouse(warehouse_dir)
    if board.is_empty:
        raise RuntimeError(f"Warehouse {warehouse_dir} has no daily_prices rows; nothing to simulate.")

    trading_dates = board.trading_dates(start=config.start_date, end=config.end_date)
    if not trading_dates:
        raise RuntimeError(
            f"No trading dates in warehouse between {config.start_date} and {config.end_date}."
        )

    default_cashflows = build_cash_flow_schedule(trading_dates, config.savings_plan)
    reports = read_table(warehouse_dir, "reports")
    reports = _prepare_reports(reports, config.start_date, config.end_date)
    reports = align_report_targets_to_market_scale(reports, board, config.end_date)

    benchmark_symbols_needed: set[str] = set()
    for p in config.accounts:
        if isinstance(p, AllWeatherConfig):
            benchmark_symbols_needed.update(a.symbol for a in p.assets)
        if isinstance(p, PitSignalRuleConfig) and p.market_gate != "none":
            benchmark_symbols_needed.add(p.market_gate_symbol)

    benchmark_board: PriceBoard | None = None
    if benchmark_symbols_needed:
        benchmark_board = load_benchmark_prices(
            warehouse_dir,
            benchmark_symbols_needed,
            config.start_date,
            config.end_date,
            refresh=refresh_benchmark,
        )

    outputs = _run_accounts(
        config,
        board,
        benchmark_board,
        reports,
        default_cashflows,
        trading_dates,
    )

    return finalize_simulation_outputs(config, reports, board, benchmark_board, trading_dates, outputs)


def finalize_simulation_outputs(
    config: SimulationConfig,
    reports: pd.DataFrame,
    board: PriceBoard,
    benchmark_board: PriceBoard | None,
    trading_dates: list[date],
    outputs: list[AccountRunOutput],
) -> SimulationResult:
    """Build the shared SimulationResult tables from completed account outputs."""

    summaries = tuple(o.summary for o in outputs)
    equity_points = tuple(p for o in outputs for p in o.equity_points)
    trades = tuple(t for o in outputs for t in o.account.trades)

    # Holdings reports — single source of truth is the trade ledger, which is
    # how a brokerage app reconstructs past positions from statements. Each
    # account's episodes are marked against its own price board (SNUSMIC
    # universe for the four research accounts; All-Weather basket for the
    # benchmark) so the unrealized PnL on still-open positions is correct.
    benchmark_accounts = {p.account_id for p in config.accounts if isinstance(p, AllWeatherConfig)}
    company_by_symbol = _company_lookup(reports)
    benchmark_company_by_symbol = _benchmark_company_lookup(config.accounts)
    last_day = trading_dates[-1]
    episodes = list(
        compute_position_episodes(
            (t for t in trades if t.account_id not in benchmark_accounts),
            board,
            last_day,
            company_by_symbol,
        )
    )
    if benchmark_board is not None:
        episodes.extend(
            compute_position_episodes(
                (t for t in trades if t.account_id in benchmark_accounts),
                benchmark_board,
                last_day,
                benchmark_company_by_symbol,
            )
        )
    episodes_tuple = tuple(episodes)
    current_holdings = tuple(compute_current_holdings(episodes_tuple, board=None, end_date=last_day))
    symbol_stats = tuple(compute_symbol_stats(episodes_tuple))

    # Month-end portfolio composition. Each account_id is marked against its
    # own price board; All-Weather goes to the benchmark board.
    boards_by_account: dict[str, PriceBoard] = {p.account_id: board for p in config.accounts}
    if benchmark_board is not None and not benchmark_board.is_empty:
        for account_id in benchmark_accounts:
            boards_by_account[account_id] = benchmark_board
    monthly_df = compute_monthly_holdings(trades, boards_by_account, last_day, company_by_symbol)
    monthly_holdings = (
        tuple(MonthlyHolding(**row) for row in monthly_df.to_dict("records")) if not monthly_df.empty else ()
    )

    # Account-agnostic SMIC report statistics.
    report_perf = tuple(
        compute_report_performance(reports, board, last_day, expiry_days=config.report_expiry_days)
    )
    verification_cases = tuple(build_verification_cases(report_perf))
    alpha_hypotheses = tuple(promote_alpha_hypotheses(verification_cases))
    report_stats_obj = aggregate_report_stats(report_perf) if report_perf else None

    return SimulationResult(
        config=config,
        summaries=tuple(summaries),
        equity_points=tuple(equity_points),
        trades=tuple(trades),
        position_episodes=episodes_tuple,
        current_holdings=current_holdings,
        symbol_stats=symbol_stats,
        monthly_holdings=monthly_holdings,
        report_performance=report_perf,
        verification_cases=verification_cases,
        alpha_hypotheses=alpha_hypotheses,
        report_stats=report_stats_obj,
    )


def _run_accounts(
    config: SimulationConfig,
    board: PriceBoard,
    benchmark_board: PriceBoard | None,
    reports: pd.DataFrame,
    cashflows,
    trading_dates: list[date],
) -> list[AccountRunOutput]:
    outputs: list[AccountRunOutput | None] = [None] * len(config.accounts)
    pit_cache = (
        PitResearchBoardCache(reports, board)
        if any(isinstance(account, PitScoreTopNConfig | PitSignalRuleConfig) for account in config.accounts)
        else None
    )
    pit_accounts: list[tuple[int, AccountConfig]] = []
    parallel_accounts: list[tuple[int, AccountConfig]] = []
    cashflows_by_timing = {"first": cashflows}
    for index, account in enumerate(config.accounts):
        if isinstance(account, PitScoreTopNConfig | PitSignalRuleConfig):
            pit_accounts.append((index, account))
        else:
            parallel_accounts.append((index, account))

    def run_isolated(item: tuple[int, AccountConfig]) -> tuple[int, AccountRunOutput]:
        index, account = item
        local_board = board.clone()
        local_benchmark_board = benchmark_board.clone() if benchmark_board is not None else None
        account_cashflows = _cashflows_for_account(account, config, trading_dates, cashflows_by_timing)
        return (
            index,
            _dispatch(
                account,
                config,
                local_board,
                local_benchmark_board,
                reports,
                account_cashflows,
                trading_dates,
            ),
        )

    if len(parallel_accounts) <= 1:
        for item in parallel_accounts:
            index, output = run_isolated(item)
            outputs[index] = output
    else:
        worker_count = min(len(parallel_accounts), max(1, os.cpu_count() or 1), 8)
        with ThreadPoolExecutor(max_workers=worker_count) as executor:
            for index, output in executor.map(run_isolated, parallel_accounts):
                outputs[index] = output

    for index, account in pit_accounts:
        account_cashflows = _cashflows_for_account(account, config, trading_dates, cashflows_by_timing)
        outputs[index] = _dispatch(
            account,
            config,
            board,
            benchmark_board,
            reports,
            account_cashflows,
            trading_dates,
            pit_board_cache=pit_cache,
        )

    if any(output is None for output in outputs):
        raise RuntimeError("simulation account dispatch did not produce every requested account output")
    return [output for output in outputs if output is not None]


def _cashflows_for_account(
    account: AccountConfig,
    config: SimulationConfig,
    trading_dates: list[date],
    cache: dict[str, list[CashFlowEvent]],
) -> list[CashFlowEvent]:
    timing = account.contribution_timing
    if timing not in cache:
        cache[timing] = build_cash_flow_schedule(trading_dates, config.savings_plan, monthly_timing=timing)
    return cache[timing]


_ALL_WEATHER_LABELS: dict[str, str] = {
    "GLD": "Gold (GLD)",
    "QQQ": "NASDAQ-100 (QQQ)",
    "SPY": "S&P 500 (SPY)",
    "069500.KS": "KOSPI 200 (069500.KS)",
}


def _benchmark_company_lookup(accounts: tuple[AccountConfig, ...]) -> dict[str, str]:
    labels = dict(_ALL_WEATHER_LABELS)
    for account_id in accounts:
        if isinstance(account_id, AllWeatherConfig):
            for asset in account_id.assets:
                labels[asset.symbol] = asset.name
    return labels


def _company_lookup(reports: pd.DataFrame) -> dict[str, str]:
    if reports.empty or "symbol" not in reports.columns or "company" not in reports.columns:
        return {}
    out: dict[str, str] = {}
    for record in reports.to_dict("records"):
        symbol = str(record.get("symbol") or "").strip()
        company = str(record.get("company") or "").strip()
        if symbol and company and symbol not in out:
            out[symbol] = company
    return out


def _dispatch(
    account_id: AccountConfig,
    config: SimulationConfig,
    board: PriceBoard,
    benchmark_board: PriceBoard | None,
    reports: pd.DataFrame,
    cashflows,
    trading_dates: list[date],
    *,
    pit_board_cache: PitResearchBoardCache | None = None,
) -> AccountRunOutput:
    fees = _account_fees(account_id, config)
    if isinstance(account_id, ProphetConfig):
        return simulate_prophet(
            account_id, config.savings_plan, fees, board, reports, cashflows, trading_dates
        )
    if isinstance(account_id, WeakProphetConfig):
        return simulate_weak_prophet(
            account_id, config.savings_plan, fees, board, reports, cashflows, trading_dates
        )
    if isinstance(account_id, SmicFollowerConfig):
        return simulate_smic_follower(
            account_id,
            config.savings_plan,
            fees,
            board,
            reports,
            cashflows,
            trading_dates,
            expiry_days=config.report_expiry_days,
        )
    if isinstance(account_id, SmicFollowerV2Config):
        return simulate_smic_follower_v2(
            account_id,
            config.savings_plan,
            fees,
            board,
            reports,
            cashflows,
            trading_dates,
            expiry_days=config.report_expiry_days,
        )
    if isinstance(account_id, PitScoreTopNConfig):
        return simulate_pit_score_top_n(
            account_id,
            config.savings_plan,
            fees,
            board,
            reports,
            cashflows,
            trading_dates,
            cache=pit_board_cache,
        )
    if isinstance(account_id, PitSignalRuleConfig):
        return simulate_pit_signal_rule(
            account_id,
            config.savings_plan,
            fees,
            board,
            reports,
            cashflows,
            trading_dates,
            cache=pit_board_cache,
            market_board=benchmark_board,
        )
    if isinstance(account_id, AllWeatherConfig):
        if benchmark_board is None or benchmark_board.is_empty:
            raise RuntimeError("All-Weather account_id requested but benchmark prices unavailable.")
        return simulate_all_weather(
            account_id,
            config.savings_plan,
            fees,
            benchmark_board,
            cashflows,
            trading_dates,
        )
    raise TypeError(f"unknown account config: {type(account_id).__name__}")


def _account_fees(account: AccountConfig, config: SimulationConfig) -> BrokerageFees:
    account_fees = getattr(account, "fees", None)
    return account_fees if account_fees is not None else config.fees


def _prepare_reports(reports: pd.DataFrame, start: date, end: date) -> pd.DataFrame:
    if reports.empty:
        return reports
    frame = reports.copy()
    frame["publication_date"] = pd.to_datetime(frame["publication_date"], errors="coerce")
    frame = frame.dropna(subset=["symbol", "publication_date"])
    frame = frame[frame["symbol"].astype(str) != ""]
    # Drop reports past the sim window — they can't be acted on.
    frame = frame[frame["publication_date"] <= pd.Timestamp(end)]
    # Use the KRW target preferentially.
    if "target_price_krw" in frame.columns:
        frame["target_price"] = frame["target_price_krw"].combine_first(frame.get("target_price"))
    frame = frame.sort_values("publication_date").reset_index(drop=True)
    return frame
