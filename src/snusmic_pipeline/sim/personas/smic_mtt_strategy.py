"""SMIC MTT strategy — actual broker-ledger trading.

This persona is deliberately different from the candidate-search report chart:
it owns integer shares, cash, fees, taxes, average cost, and realised fills.
The strategy screens each newly-published report with target-upside and
Minervini trend-template gates, then buys only within a capped slot count.
It never sells merely to restore weights; exits are target, take-profit,
price stop, and stale-report stop.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from math import isfinite
from typing import Any, cast

import pandas as pd

from ..brokerage import Account
from ..contracts import BrokerageFees, SavingsPlan, SmicMttStrategyConfig, TradeReason
from ..market import PriceBoard
from ..savings import CashFlowEvent
from .base import (
    PersonaRunOutput,
    build_summary,
    cumulative_contributions,
    record_equity_point,
)


@dataclass(frozen=True)
class ActiveCandidate:
    report_id: str
    symbol: str
    publication_date: date
    target_price_krw: float
    target_upside_at_pub: float


class MttStrategyState:
    """Latest eligible report per symbol plus re-entry guards."""

    def __init__(self) -> None:
        self.active: dict[str, ActiveCandidate] = {}
        self.stopped_out: dict[str, date] = {}
        self._absorbed_ids: set[str] = set()

    def absorb_reports(
        self,
        report_rows: list[dict[str, Any]],
        cursor: int,
        day: date,
        board: PriceBoard,
        config: SmicMttStrategyConfig,
    ) -> tuple[int, bool]:
        added = False
        while cursor < len(report_rows) and report_rows[cursor]["_pub"] <= day:
            record = report_rows[cursor]
            cursor += 1
            candidate = _candidate_from_report(record, day, board, config)
            report_id = str(record["report_id"])
            self._absorbed_ids.add(report_id)
            if candidate is None:
                continue
            stopped_when = self.stopped_out.get(candidate.symbol)
            if stopped_when is not None:
                if candidate.publication_date <= stopped_when:
                    continue
                self.stopped_out.pop(candidate.symbol, None)
            self.active[candidate.symbol] = candidate
            added = True
        return cursor, added

    def close_symbol(self, symbol: str, day: date, *, stopped: bool) -> None:
        self.active.pop(symbol, None)
        if stopped:
            self.stopped_out[symbol] = day


def simulate_smic_mtt_strategy(
    config: SmicMttStrategyConfig,
    plan: SavingsPlan,
    fees: BrokerageFees,
    board: PriceBoard,
    reports: pd.DataFrame,
    cashflows: list[CashFlowEvent],
    trading_dates: list[date],
) -> PersonaRunOutput:
    persona = config.persona_name
    account = Account(persona=persona, fees=fees)
    cashflow_by_date: dict[date, float] = {e.date: e.amount_krw for e in cashflows}

    if not trading_dates:
        return PersonaRunOutput(
            account=account,
            equity_points=[],
            summary=build_summary(persona, config.label, account, [], cashflows, plan.initial_capital_krw),
        )

    reports = _prepare_reports(reports)
    report_rows = cast(list[dict[str, Any]], reports.to_dict("records"))
    daily_closes = {d: board.close_on(d) for d in trading_dates}
    contributions = cumulative_contributions(cashflows, trading_dates)
    top_up_days = _top_up_days(trading_dates, config.top_up_cadence)
    state = MttStrategyState()
    equity_points: list = []
    cursor = 0

    for day in trading_dates:
        cursor, has_new_signal = state.absorb_reports(report_rows, cursor, day, board, config)

        deposit_today = cashflow_by_date.get(day, 0.0)
        if deposit_today > 0:
            account.deposit(day, deposit_today)

        _apply_sell_rules(account, day, board, state, config)

        should_top_up = deposit_today > 0 or has_new_signal or day in top_up_days
        if should_top_up:
            _buy_or_top_up_slots(account, day, board, state, config, deposit_today > 0)

        equity_points.append(
            record_equity_point(
                account,
                persona,
                day,
                daily_closes[day],
                contributions[day],
                board=board,
            )
        )

    summary = build_summary(
        persona, config.label, account, equity_points, cashflows, plan.initial_capital_krw
    )
    return PersonaRunOutput(account=account, equity_points=equity_points, summary=summary)


def _prepare_reports(reports: pd.DataFrame) -> pd.DataFrame:
    if reports.empty:
        return pd.DataFrame(columns=[*reports.columns, "_pub"])
    required = {"report_id", "symbol", "publication_date"}
    missing = sorted(required - set(reports.columns))
    if missing:
        raise ValueError(f"SMIC MTT strategy requires report columns {missing}")
    frame = reports.copy()
    frame["_pub"] = pd.to_datetime(frame["publication_date"], errors="raise").dt.date
    frame["symbol"] = frame["symbol"].astype(str)
    frame["report_id"] = frame["report_id"].astype(str)
    if frame["report_id"].eq("").any():
        raise ValueError("SMIC MTT strategy requires non-empty report_id")
    return frame.sort_values(["_pub", "report_id"]).reset_index(drop=True)


def _candidate_from_report(
    record: dict[str, Any],
    day: date,
    board: PriceBoard,
    config: SmicMttStrategyConfig,
) -> ActiveCandidate | None:
    symbol = str(record["symbol"]).strip()
    if not symbol or not _passes_universe(record, config.universe):
        return None
    target = _target_price(record)
    if target is None:
        return None
    entry = board.asof(day, symbol)
    if entry is None or entry <= 0:
        return None
    target_upside = target / entry - 1.0
    if target_upside < config.min_target_upside_at_pub or target_upside > config.max_target_upside_at_pub:
        return None
    if config.require_mtt and not _passes_mtt(board, day, symbol, config):
        return None
    return ActiveCandidate(
        report_id=str(record["report_id"]),
        symbol=symbol,
        publication_date=record["_pub"],
        target_price_krw=target,
        target_upside_at_pub=target_upside,
    )


def _target_price(record: dict[str, Any]) -> float | None:
    for key in ("target_price", "target_price_krw", "base_target_krw"):
        raw = record.get(key)
        if raw is None or pd.isna(raw):
            continue
        value = float(raw)
        if value > 0 and isfinite(value):
            return value
    return None


def _passes_universe(record: dict[str, Any], universe: str) -> bool:
    if universe == "all":
        return True
    symbol = str(record.get("symbol") or "").upper()
    exchange_raw = record.get("exchange")
    exchange = "" if exchange_raw is None or pd.isna(exchange_raw) else str(exchange_raw).upper()
    domestic = (
        symbol.endswith(".KS") or symbol.endswith(".KQ") or exchange in {"KRX", "KOSPI", "KOSDAQ", "KONEX"}
    )
    if universe == "domestic":
        return domestic
    if universe == "overseas":
        return not domestic
    raise ValueError(f"unknown SMIC MTT universe: {universe}")


def _passes_mtt(
    board: PriceBoard,
    day: date,
    symbol: str,
    config: SmicMttStrategyConfig,
) -> bool:
    if board.close.empty or symbol not in board.close.columns:
        return False
    series = board.close[symbol].loc[board.close.index <= pd.Timestamp(day)].dropna()
    if len(series) < 252:
        return False
    current = float(series.iloc[-1])
    if current <= 0:
        return False
    ma50 = float(series.tail(50).mean())
    ma150 = float(series.tail(150).mean())
    ma200 = float(series.tail(200).mean())
    if not (current > ma50 > ma150 > ma200 and current > ma200):
        return False
    ma200_series = series.rolling(200).mean().dropna()
    if len(ma200_series) < 22:
        return False
    ma200_1m_return = float(ma200_series.iloc[-1] / ma200_series.iloc[-22] - 1.0)
    if ma200_1m_return < config.min_ma200_1m_return:
        return False
    recent = series.tail(252)
    low_52w = float(recent.min())
    high_52w = float(recent.max())
    if low_52w <= 0 or high_52w <= 0:
        return False
    if current / low_52w - 1.0 < config.min_price_vs_52w_low:
        return False
    pct_below_high = high_52w / current - 1.0
    return pct_below_high <= config.max_pct_below_52w_high


def _top_up_days(trading_dates: list[date], cadence: str) -> set[date]:
    if cadence == "deposit_only":
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
    raise ValueError(f"unknown SMIC MTT top-up cadence: {cadence}")


def _apply_sell_rules(
    account: Account,
    day: date,
    board: PriceBoard,
    state: MttStrategyState,
    config: SmicMttStrategyConfig,
) -> None:
    for symbol in list(account.holdings):
        lot = account.holdings[symbol]
        if lot.qty <= 0:
            continue
        candidate = state.active.get(symbol)
        close = board.asof(day, symbol)
        if close is None or close <= 0:
            continue

        stop_price = lot.avg_cost_krw * (1.0 - config.stop_loss_pct)
        if board.target_touched_on(day, symbol, stop_price, "downside"):
            account.sell_all(
                day, symbol, stop_price, "stop_loss_price", candidate.report_id if candidate else None
            )
            state.close_symbol(symbol, day, stopped=True)
            continue

        if candidate is not None:
            target_threshold = candidate.target_price_krw * config.target_hit_multiplier
            profit_cap = lot.avg_cost_krw * (1.0 + config.take_profit_pct)
            sell_threshold = min(target_threshold, profit_cap)
            if board.target_touched_on(day, symbol, sell_threshold, "upside"):
                account.sell_all(day, symbol, sell_threshold, "target_hit", candidate.report_id)
                state.close_symbol(symbol, day, stopped=False)
                continue

            if (day - candidate.publication_date).days >= config.report_age_stop_days:
                account.sell_all(day, symbol, close, "stop_loss_report_age", candidate.report_id)
                state.close_symbol(symbol, day, stopped=True)


def _buy_or_top_up_slots(
    account: Account,
    day: date,
    board: PriceBoard,
    state: MttStrategyState,
    config: SmicMttStrategyConfig,
    deposit_today: bool,
) -> None:
    prices = _price_view(account, day, board)
    if not prices:
        return
    candidates = [
        c
        for c in state.active.values()
        if c.symbol in prices
        and c.symbol not in state.stopped_out
        and (not config.require_mtt or _passes_mtt(board, day, c.symbol, config))
    ]
    candidates.sort(key=lambda c: (-c.target_upside_at_pub, c.publication_date, c.symbol))
    candidates = candidates[: config.max_positions]
    if not candidates:
        return

    equity = account.equity(prices)
    if equity <= 0:
        return
    slot_value = equity / float(len(candidates))
    reason: TradeReason = "deposit_buy" if deposit_today else "rebalance_buy"

    for candidate in candidates:
        if account.open_position_count() >= config.max_positions:
            break
        lot = account.holdings.get(candidate.symbol)
        if lot is not None and lot.qty > 0:
            continue
        mid = prices[candidate.symbol]
        account.buy_value(day, candidate.symbol, mid, slot_value, reason, candidate.report_id)

    for candidate in candidates:
        lot = account.holdings.get(candidate.symbol)
        if lot is None or lot.qty <= 0:
            continue
        top_up_mid = prices.get(candidate.symbol)
        if top_up_mid is None or top_up_mid <= 0:
            continue
        current_value = lot.qty * top_up_mid
        if current_value >= slot_value:
            continue
        account.buy_value(
            day,
            candidate.symbol,
            top_up_mid,
            slot_value - current_value,
            reason,
            candidate.report_id,
        )


def _price_view(account: Account, day: date, board: PriceBoard) -> dict[str, float]:
    prices = board.close_on(day)
    for symbol, lot in account.holdings.items():
        if lot.qty <= 0 or symbol in prices:
            continue
        mid = board.asof(day, symbol)
        if mid is not None and mid > 0:
            prices[symbol] = mid
    return prices
