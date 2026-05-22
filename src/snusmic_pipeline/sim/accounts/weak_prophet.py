"""Weak prophet — bounded forward look-ahead, max-Sharpe portfolio.

The account_id "knows" only the next ``lookahead_months`` of returns. At each
rebalance date it computes realised daily returns over that window for the
candidate universe, then solves a long-only max-Sharpe problem (sum to 1,
optionally capped per name) and rebalances the book.

Solved with ``scipy.optimize.minimize`` (SLSQP). At a rebalance date, an
empty target portfolio is explicit: the book is rebalanced to cash rather
than carrying stale holdings.
"""

from __future__ import annotations

from datetime import date, timedelta

import pandas as pd

from ..brokerage import Account
from ..contracts import BrokerageFees, SavingsPlan, WeakProphetConfig
from ..market import PriceBoard
from ..savings import CashFlowEvent
from .base import (
    AccountRunOutput,
    accrue_cash_yield_since_previous,
    build_summary,
    cumulative_contributions,
    record_equity_point,
)
from .sharpe import solve_max_sharpe_weights


def simulate_weak_prophet(
    config: WeakProphetConfig,
    plan: SavingsPlan,
    fees: BrokerageFees,
    board: PriceBoard,
    reports: pd.DataFrame,
    cashflows: list[CashFlowEvent],
    trading_dates: list[date],
) -> AccountRunOutput:
    account_id = config.account_id
    account = Account(account_id=account_id, fees=fees)
    cashflow_by_date: dict[date, float] = {e.date: e.amount_krw for e in cashflows}

    if not trading_dates:
        return _empty_output(account_id, config.label, account, cashflows, plan.initial_capital_krw)

    daily_closes = {d: board.close_on(d) for d in trading_dates}
    rebalance_days = _rebalance_days(trading_dates, config.rebalance)
    contributions = cumulative_contributions(cashflows, trading_dates)
    pub_dates = pd.to_datetime(reports["publication_date"]).dt.date
    reports = reports.assign(_pub=pub_dates)
    equity_points: list = []
    previous_day: date | None = None

    for day in trading_dates:
        accrue_cash_yield_since_previous(account, day, previous_day, plan)
        deposit = cashflow_by_date.get(day, 0.0)
        if deposit > 0:
            account.deposit(day, deposit)
        if day in rebalance_days:
            weights = _solve_target_weights(
                config=config, board=board, reports=reports, day=day, end_date=trading_dates[-1]
            )
            prices = daily_closes[day]
            tradable = {sym: w for sym, w in weights.items() if sym in prices and prices[sym] > 0}
            s = sum(tradable.values())
            if s > 0:
                tradable = {sym: w / s for sym, w in tradable.items()}
                account.rebalance_to_weights(day, tradable, prices)
            else:
                for symbol in sorted(account.holdings):
                    mid = prices.get(symbol) or board.asof(day, symbol)
                    if mid is not None and mid > 0:
                        account.sell_all(day, symbol, mid, "rebalance_sell")
        equity_points.append(
            record_equity_point(account, account_id, day, daily_closes[day], contributions[day], board=board)
        )
        previous_day = day
    summary = build_summary(
        account_id, config.label, account, equity_points, cashflows, plan.initial_capital_krw
    )
    return AccountRunOutput(account=account, equity_points=equity_points, summary=summary)


def _rebalance_days(trading_dates: list[date], cadence: str) -> set[date]:
    if not trading_dates:
        return set()
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
    raise ValueError(f"unknown weak-prophet cadence: {cadence}")


def _solve_target_weights(
    *,
    config: WeakProphetConfig,
    board: PriceBoard,
    reports: pd.DataFrame,
    day: date,
    end_date: date,
) -> dict[str, float]:
    horizon_end = min(day + timedelta(days=int(config.lookahead_months * 30.5)), end_date)
    if horizon_end <= day:
        return {}
    active = reports[reports["_pub"] <= day]
    if active.empty:
        return {}
    candidates = sorted({str(s) for s in active["symbol"].dropna()})
    rets = board.returns_window(day, horizon_end, candidates)
    return solve_max_sharpe_weights(
        rets,
        risk_free_rate=config.risk_free_rate,
        max_weight=config.max_weight,
        min_history_days=config.min_history_days,
    )


def _empty_output(account_id, label, account, cashflows, initial_capital):
    summary = build_summary(account_id, label, account, [], cashflows, initial_capital)
    return AccountRunOutput(account=account, equity_points=[], summary=summary)
