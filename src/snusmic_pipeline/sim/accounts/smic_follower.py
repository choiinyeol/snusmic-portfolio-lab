"""SMIC follower v1 — 1/N true believer.

Buys whatever the report says, equally weighted across active reports.
Sells **only** when the close hits the target price; in the absence of a
target hit, holds (and contributes more on the next deposit, rebalancing
back to 1/N).

Per the user spec: "1/n씩 사고, 현금이 생기면 비중 재조정.
목표가에 매도 후 다시 비중조정." Losers are never sold.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any, cast

import pandas as pd
from pydantic import BaseModel, ConfigDict

from ..brokerage import Account
from ..contracts import BrokerageFees, EquityPoint, SavingsPlan, SmicFollowerConfig
from ..market import PriceBoard
from ..savings import CashFlowEvent
from .base import (
    AccountRunOutput,
    accrue_cash_yield_since_previous,
    build_summary,
    cumulative_contributions,
    record_equity_point,
)


class _FollowerSnapshotModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class FollowerOpenReportSnapshot(_FollowerSnapshotModel):
    report_id: str
    target_price: float
    publication_date: date


class FollowerStateSnapshot(_FollowerSnapshotModel):
    open_reports: dict[str, tuple[FollowerOpenReportSnapshot, ...]]
    stopped_out: dict[str, date]
    absorbed_ids: tuple[str, ...]
    cursor: int


@dataclass
class FollowerRuntime:
    account_id: str
    label: str
    rebalance_cadence: str
    target_hit_multiplier: float
    plan: SavingsPlan
    board: PriceBoard
    reports: pd.DataFrame
    report_rows: list[dict[str, Any]]
    cashflow_by_date: dict[date, float]
    daily_closes: dict[date, dict[str, float]]
    contributions: dict[date, float]
    rebalance_days: set[date]
    account: Account
    state: FollowerState
    equity_points: list[EquityPoint] = field(default_factory=list)
    previous_day: date | None = None
    stop_loss_hook: Any = None
    expiry_days: int | None = None
    allow_rebalance_sells: bool = True


def simulate_smic_follower(
    config: SmicFollowerConfig,
    plan: SavingsPlan,
    fees: BrokerageFees,
    board: PriceBoard,
    reports: pd.DataFrame,
    cashflows: list[CashFlowEvent],
    trading_dates: list[date],
    *,
    expiry_days: int | None = None,
) -> AccountRunOutput:
    return _simulate_follower(
        account_id=config.account_id,
        label=config.label,
        rebalance_cadence=config.rebalance,
        target_hit_multiplier=config.target_hit_multiplier,
        plan=plan,
        fees=fees,
        board=board,
        reports=reports,
        cashflows=cashflows,
        trading_dates=trading_dates,
        stop_loss_hook=None,
        expiry_days=expiry_days,
        allow_rebalance_sells=False,
    )


# ---------------------------------------------------------------------------
# Shared with smic_follower_v2 — only the stop-loss hook differs.
# ---------------------------------------------------------------------------


def _simulate_follower(
    *,
    account_id: str,
    label: str,
    rebalance_cadence: str,
    target_hit_multiplier: float,
    plan: SavingsPlan,
    fees: BrokerageFees,
    board: PriceBoard,
    reports: pd.DataFrame,
    cashflows: list[CashFlowEvent],
    trading_dates: list[date],
    stop_loss_hook,
    expiry_days: int | None = None,
    allow_rebalance_sells: bool = True,
) -> AccountRunOutput:
    """Engine shared by SMIC followers v1 and v2.

    ``stop_loss_hook`` is ``None`` for the true believer; v2 supplies a
    callable taking ``(account, day, board, reports, follower_state)`` that
    sells positions matching its rules and updates state. ``expiry_days``
    triggers the engine-level expiry sweep (see ``_expire_stale_positions``).
    ``allow_rebalance_sells`` keeps v1 buy-only outside target hits while
    preserving v2's full rebalance behavior.
    """
    account = Account(account_id=account_id, fees=fees)

    if not trading_dates:
        return AccountRunOutput(
            account=account,
            equity_points=[],
            summary=build_summary(account_id, label, account, [], cashflows, plan.initial_capital_krw),
        )

    runtime = build_smic_follower_runtime(
        account_id=account_id,
        label=label,
        rebalance_cadence=rebalance_cadence,
        target_hit_multiplier=target_hit_multiplier,
        plan=plan,
        reports=reports,
        board=board,
        cashflows=cashflows,
        trading_dates=trading_dates,
        account=account,
        stop_loss_hook=stop_loss_hook,
        expiry_days=expiry_days,
        allow_rebalance_sells=allow_rebalance_sells,
    )
    for day in trading_dates:
        step_smic_follower_day(runtime, day)
    summary = build_summary(
        account_id, label, runtime.account, runtime.equity_points, cashflows, plan.initial_capital_krw
    )
    return AccountRunOutput(account=runtime.account, equity_points=runtime.equity_points, summary=summary)


def build_smic_follower_runtime(
    *,
    account_id: str,
    label: str,
    rebalance_cadence: str,
    target_hit_multiplier: float,
    plan: SavingsPlan,
    reports: pd.DataFrame,
    board: PriceBoard,
    cashflows: list[CashFlowEvent],
    trading_dates: list[date],
    account: Account,
    stop_loss_hook: Any = None,
    expiry_days: int | None = None,
    allow_rebalance_sells: bool = True,
    state: FollowerState | None = None,
    previous_day: date | None = None,
    equity_points: list[EquityPoint] | None = None,
) -> FollowerRuntime:
    pub = pd.to_datetime(reports["publication_date"]).dt.date
    prepared_reports = reports.assign(_pub=pub).sort_values("_pub").reset_index(drop=True)
    return FollowerRuntime(
        account_id=account_id,
        label=label,
        rebalance_cadence=rebalance_cadence,
        target_hit_multiplier=target_hit_multiplier,
        plan=plan,
        board=board,
        reports=prepared_reports,
        report_rows=cast(list[dict[str, Any]], prepared_reports.to_dict("records")),
        cashflow_by_date={e.date: e.amount_krw for e in cashflows},
        daily_closes={d: board.close_on(d) for d in trading_dates},
        contributions=cumulative_contributions(cashflows, trading_dates),
        rebalance_days=_rebalance_days(trading_dates, rebalance_cadence),
        account=account,
        state=state or FollowerState(),
        equity_points=equity_points or [],
        previous_day=previous_day,
        stop_loss_hook=stop_loss_hook,
        expiry_days=expiry_days,
        allow_rebalance_sells=allow_rebalance_sells,
    )


def step_smic_follower_day(runtime: FollowerRuntime, day: date) -> EquityPoint:
    accrue_cash_yield_since_previous(runtime.account, day, runtime.previous_day, runtime.plan)
    runtime.state.absorb_reports(runtime.report_rows, day, runtime.board)
    deposit_today = runtime.cashflow_by_date.get(day, 0.0)
    if deposit_today > 0:
        runtime.account.deposit(day, deposit_today)
    if runtime.expiry_days and runtime.expiry_days > 0:
        _expire_stale_positions(runtime.account, day, runtime.board, runtime.state, runtime.expiry_days)
    if runtime.stop_loss_hook is not None:
        runtime.stop_loss_hook(runtime.account, day, runtime.board, runtime.reports, runtime.state)
    _check_target_hits(runtime.account, day, runtime.board, runtime.target_hit_multiplier, runtime.state)
    if deposit_today > 0 or day in runtime.rebalance_days:
        _rebalance_to_one_n(
            runtime.account,
            day,
            runtime.board,
            runtime.daily_closes[day],
            runtime.state,
            allow_sells=runtime.allow_rebalance_sells,
        )
    point = record_equity_point(
        runtime.account,
        runtime.account_id,
        day,
        runtime.daily_closes[day],
        runtime.contributions[day],
        board=runtime.board,
    )
    runtime.equity_points.append(point)
    runtime.previous_day = day
    return point


class FollowerState:
    """Per-symbol report and target tracking for the follower accounts.

    ``open_reports[symbol]`` lists every (report_id, target_price, pub_date)
    that has not been resolved yet. ``stopped_out`` tracks symbols permanently
    excluded by stop-loss rules until a *strictly newer* report arrives.
    """

    def __init__(self) -> None:
        self.open_reports: dict[str, list[tuple[str, float, date]]] = {}
        self.stopped_out: dict[str, date] = {}  # symbol → last stop-out date
        self._absorbed_ids: set[str] = set()
        self._cursor = 0

    def absorb_reports(self, reports: list[dict[str, Any]], day: date, board: PriceBoard) -> None:
        if not reports:
            return
        while self._cursor < len(reports) and reports[self._cursor]["_pub"] <= day:
            record = reports[self._cursor]
            self._cursor += 1
            report_id = str(record.get("report_id") or "")
            if not report_id or report_id in self._absorbed_ids:
                continue
            target = (
                record.get("target_price") or record.get("target_price_krw") or record.get("base_target_krw")
            )
            try:
                target_value = float(target) if target is not None else None
            except (TypeError, ValueError):
                target_value = None
            symbol = str(record["symbol"])
            close = board.asof(day, symbol)
            if target_value is None or target_value <= 0 or (close is not None and target_value <= close):
                self._absorbed_ids.add(report_id)
                continue
            pub_date = record["_pub"]
            # If a previous stop-out was earlier than this report's publication,
            # the new report restores eligibility.
            stopped_when = self.stopped_out.get(symbol)
            if stopped_when is not None and pub_date > stopped_when:
                self.stopped_out.pop(symbol, None)
            self.open_reports.setdefault(symbol, []).append((report_id, target_value, pub_date))
            self._absorbed_ids.add(report_id)

    def active_symbols(self) -> list[str]:
        return sorted(
            sym for sym, items in self.open_reports.items() if items and sym not in self.stopped_out
        )

    def aggregate_target(self, symbol: str) -> float | None:
        items = self.open_reports.get(symbol)
        if not items:
            return None
        return max(t for _, t, _ in items)

    def earliest_publication(self, symbol: str) -> date | None:
        items = self.open_reports.get(symbol)
        if not items:
            return None
        return min(p for _, _, p in items)

    def close_reports(self, symbol: str) -> None:
        self.open_reports.pop(symbol, None)

    def to_snapshot(self) -> FollowerStateSnapshot:
        return FollowerStateSnapshot(
            open_reports={
                symbol: tuple(
                    FollowerOpenReportSnapshot(
                        report_id=report_id,
                        target_price=target_price,
                        publication_date=publication_date,
                    )
                    for report_id, target_price, publication_date in items
                )
                for symbol, items in self.open_reports.items()
            },
            stopped_out=dict(self.stopped_out),
            absorbed_ids=tuple(sorted(self._absorbed_ids)),
            cursor=self._cursor,
        )

    @classmethod
    def from_snapshot(cls, snapshot: FollowerStateSnapshot) -> FollowerState:
        state = cls()
        state.open_reports = {
            symbol: [(item.report_id, item.target_price, item.publication_date) for item in items]
            for symbol, items in snapshot.open_reports.items()
        }
        state.stopped_out = dict(snapshot.stopped_out)
        state._absorbed_ids = set(snapshot.absorbed_ids)
        state._cursor = snapshot.cursor
        return state


def _rebalance_days(trading_dates: list[date], cadence: str) -> set[date]:
    if cadence == "daily":
        return set(trading_dates)
    if cadence == "monthly":
        seen: dict[tuple[int, int], date] = {}
        for d in trading_dates:
            seen.setdefault((d.year, d.month), d)
        return set(seen.values())
    if cadence == "quarterly":
        seen_q: dict[tuple[int, int], date] = {}
        for d in trading_dates:
            seen_q.setdefault((d.year, (d.month - 1) // 3), d)
        return set(seen_q.values())
    raise ValueError(f"unknown follower cadence: {cadence}")


def _expire_stale_positions(
    account: Account,
    day: date,
    board: PriceBoard,
    state: FollowerState,
    expiry_days: int,
) -> None:
    """Sell holdings whose earliest open report is past expiry; mark stopped-out
    so a strictly newer report is required to re-enter (same as other stops).
    """
    for symbol in list(account.holdings):
        lot = account.holdings[symbol]
        if lot.qty <= 0:
            continue
        earliest_pub = state.earliest_publication(symbol)
        if earliest_pub is None:
            continue
        if (day - earliest_pub).days < expiry_days:
            continue
        close = board.asof(day, symbol)
        if close is None:
            continue
        account.sell_all(day, symbol, close, "stop_loss_report_age")
        state.close_reports(symbol)
        state.stopped_out[symbol] = day


def _check_target_hits(
    account: Account,
    day: date,
    board: PriceBoard,
    multiplier: float,
    state: FollowerState,
) -> None:
    for symbol in list(account.holdings):
        lot = account.holdings[symbol]
        if lot.qty <= 0:
            continue
        target = state.aggregate_target(symbol)
        if target is None:
            continue
        close = board.asof(day, symbol)
        threshold = target * multiplier
        if close is None:
            continue
        if board.target_touched_on(day, symbol, threshold, "upside"):
            account.sell_all(day, symbol, threshold, "target_hit")
            state.close_reports(symbol)


def _rebalance_to_one_n(
    account: Account,
    day: date,
    board: PriceBoard,
    prices_today: dict[str, float],
    state: FollowerState,
    *,
    allow_sells: bool = True,
) -> None:
    """Allocate the entire book equally across currently-active reports.

    True 1/N: every symbol the follower would still buy gets the same
    target weight. When ``allow_sells`` is false (v1), cash is allocated
    toward underweight active symbols without selling any non-target-hit
    position. When true (v2), overweight and inactive holdings may be sold
    by the rebalance before buying back to target weights.
    """
    active = [s for s in state.active_symbols() if s in prices_today and prices_today[s] > 0]
    if not active:
        return
    n = len(active)
    weights = {sym: 1.0 / n for sym in active}
    # Build the price view used by the brokerage. Include held symbols too so
    # rebalance_to_weights knows their current value when computing equity.
    prices = dict(prices_today)
    for sym, lot in account.holdings.items():
        if lot.qty > 0 and sym not in prices:
            mid = board.asof(day, sym)
            if mid is not None:
                prices[sym] = mid
    if allow_sells:
        account.rebalance_to_weights(day, weights, prices)
        return

    equity = account.equity(prices)
    target_value = equity / n
    for sym in active:
        mid = prices.get(sym)
        if mid is None or mid <= 0:
            continue
        current_value = 0.0
        held_lot = account.holdings.get(sym)
        if held_lot is not None and held_lot.qty > 0:
            current_value = held_lot.qty * mid
        if current_value >= target_value:
            continue
        account.buy_value(day, sym, mid, target_value - current_value, "rebalance_buy")
