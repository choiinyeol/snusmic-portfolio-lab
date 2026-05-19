"""SMIC RSI reversal strategy — short-term broker-ledger pullback buys."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from math import isfinite
from typing import Any, cast

import pandas as pd

from ..brokerage import Account
from ..contracts import BrokerageFees, SavingsPlan, SmicRsiReversalConfig, TradeReason
from ..market import PriceBoard
from ..savings import CashFlowEvent
from .base import (
    PersonaRunOutput,
    accrue_cash_yield_since_previous,
    build_summary,
    cumulative_contributions,
    record_equity_point,
)
from .smic_mtt_strategy import _passes_universe, _target_price


@dataclass(frozen=True)
class ActiveReversalCandidate:
    report_id: str
    symbol: str
    publication_date: date
    target_price_krw: float
    target_upside_at_pub: float


@dataclass(frozen=True)
class ReversalSignal:
    candidate: ActiveReversalCandidate
    rsi: float
    pullback_pct: float


class RsiReversalState:
    """Latest target-upside-qualified report per symbol."""

    def __init__(self) -> None:
        self.active: dict[str, ActiveReversalCandidate] = {}

    def absorb_reports(
        self,
        report_rows: list[dict[str, Any]],
        cursor: int,
        day: date,
        board: PriceBoard,
        config: SmicRsiReversalConfig,
    ) -> tuple[int, bool]:
        added = False
        while cursor < len(report_rows) and report_rows[cursor]["_pub"] <= day:
            record = report_rows[cursor]
            cursor += 1
            candidate = _candidate_from_report(record, day, board, config)
            if candidate is None:
                continue
            self.active[candidate.symbol] = candidate
            added = True
        return cursor, added

    def close_symbol(self, symbol: str) -> None:
        self.active.pop(symbol, None)

    def valid_candidates(self, day: date, config: SmicRsiReversalConfig) -> list[ActiveReversalCandidate]:
        out: list[ActiveReversalCandidate] = []
        for symbol, candidate in list(self.active.items()):
            if (day - candidate.publication_date).days > config.signal_valid_days:
                self.active.pop(symbol, None)
                continue
            out.append(candidate)
        return out


def simulate_smic_rsi_reversal(
    config: SmicRsiReversalConfig,
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
    state = RsiReversalState()
    equity_points: list = []
    previous_day: date | None = None
    cursor = 0

    for day in trading_dates:
        accrue_cash_yield_since_previous(account, day, previous_day, plan)
        cursor, has_new_signal = state.absorb_reports(report_rows, cursor, day, board, config)

        deposit_today = cashflow_by_date.get(day, 0.0)
        if deposit_today > 0:
            account.deposit(day, deposit_today)

        _apply_sell_rules(account, day, board, state, config)

        _buy_short_term_reversals(
            account, day, board, state, config, deposit_today > 0 or has_new_signal
        )

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
        previous_day = day

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
        raise ValueError(f"SMIC RSI reversal strategy requires report columns {missing}")
    frame = reports.copy()
    frame["_pub"] = pd.to_datetime(frame["publication_date"], errors="raise").dt.date
    frame["symbol"] = frame["symbol"].astype(str)
    frame["report_id"] = frame["report_id"].astype(str)
    if frame["report_id"].eq("").any():
        raise ValueError("SMIC RSI reversal strategy requires non-empty report_id")
    return frame.sort_values(["_pub", "report_id"]).reset_index(drop=True)


def _candidate_from_report(
    record: dict[str, Any],
    day: date,
    board: PriceBoard,
    config: SmicRsiReversalConfig,
) -> ActiveReversalCandidate | None:
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
    return ActiveReversalCandidate(
        report_id=str(record["report_id"]),
        symbol=symbol,
        publication_date=record["_pub"],
        target_price_krw=target,
        target_upside_at_pub=target_upside,
    )


def _apply_sell_rules(
    account: Account,
    day: date,
    board: PriceBoard,
    state: RsiReversalState,
    config: SmicRsiReversalConfig,
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
            state.close_symbol(symbol)
            continue

        if candidate is not None:
            target_threshold = candidate.target_price_krw * config.target_hit_multiplier
            profit_cap = lot.avg_cost_krw * (1.0 + config.take_profit_pct)
            sell_threshold = min(target_threshold, profit_cap)
            if board.target_touched_on(day, symbol, sell_threshold, "upside"):
                account.sell_all(day, symbol, sell_threshold, "target_hit", candidate.report_id)
                state.close_symbol(symbol)
                continue

        rsi = _rsi(board, day, symbol, config.rsi_window)
        if rsi is not None and rsi >= config.rebound_exit_rsi:
            account.sell_all(day, symbol, close, "rebound_exit", candidate.report_id if candidate else None)
            state.close_symbol(symbol)
            continue

        if lot.first_buy_date is not None and (day - lot.first_buy_date).days >= config.max_holding_days:
            account.sell_all(
                day, symbol, close, "stop_loss_max_hold", candidate.report_id if candidate else None
            )
            state.close_symbol(symbol)


def _buy_short_term_reversals(
    account: Account,
    day: date,
    board: PriceBoard,
    state: RsiReversalState,
    config: SmicRsiReversalConfig,
    deposit_today: bool,
) -> None:
    prices = _price_view(account, day, board)
    if not prices:
        return
    signals = [
        signal
        for candidate in state.valid_candidates(day, config)
        if candidate.symbol in prices and not _has_open_position(account, candidate.symbol)
        for signal in [_reversal_signal(board, day, candidate, config)]
        if signal is not None
    ]
    signals.sort(key=lambda signal: (signal.rsi, -signal.pullback_pct, -signal.candidate.target_upside_at_pub))

    slots_available = max(0, config.max_positions - account.open_position_count())
    if slots_available <= 0:
        return
    signals = signals[:slots_available]
    if not signals:
        return

    equity = account.equity(prices)
    if equity <= 0:
        return
    slot_value = equity / float(config.max_positions)
    reason: TradeReason = "deposit_buy" if deposit_today else "rebalance_buy"
    for signal in signals:
        mid = prices[signal.candidate.symbol]
        account.buy_value(day, signal.candidate.symbol, mid, slot_value, reason, signal.candidate.report_id)


def _reversal_signal(
    board: PriceBoard,
    day: date,
    candidate: ActiveReversalCandidate,
    config: SmicRsiReversalConfig,
) -> ReversalSignal | None:
    rsi = _rsi(board, day, candidate.symbol, config.rsi_window)
    if rsi is None or rsi > config.max_entry_rsi:
        return None
    pullback = _pullback_pct(board, day, candidate.symbol, config.pullback_lookback_days)
    if pullback is None or pullback < config.min_pullback_pct:
        return None
    return ReversalSignal(candidate=candidate, rsi=rsi, pullback_pct=pullback)


def _rsi(board: PriceBoard, day: date, symbol: str, window: int) -> float | None:
    if board.close.empty or symbol not in board.close.columns:
        return None
    series = board.close[symbol].loc[board.close.index <= pd.Timestamp(day)].dropna()
    if len(series) <= window:
        return None
    delta = series.diff().dropna().tail(window)
    if len(delta) < window:
        return None
    gains = delta.clip(lower=0.0)
    losses = -delta.clip(upper=0.0)
    avg_gain = float(gains.mean())
    avg_loss = float(losses.mean())
    if avg_loss <= 0:
        return 100.0 if avg_gain > 0 else 50.0
    rs = avg_gain / avg_loss
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return rsi if isfinite(rsi) else None


def _pullback_pct(board: PriceBoard, day: date, symbol: str, lookback_days: int) -> float | None:
    if board.close.empty or symbol not in board.close.columns:
        return None
    series = board.close[symbol].loc[board.close.index <= pd.Timestamp(day)].dropna().tail(
        lookback_days + 1
    )
    if len(series) < 2:
        return None
    current = float(series.iloc[-1])
    recent_high = float(series.max())
    if current <= 0 or recent_high <= 0:
        return None
    return max(0.0, recent_high / current - 1.0)


def _price_view(account: Account, day: date, board: PriceBoard) -> dict[str, float]:
    prices = board.close_on(day)
    for symbol, lot in account.holdings.items():
        if lot.qty <= 0 or symbol in prices:
            continue
        mid = board.asof(day, symbol)
        if mid is not None and mid > 0:
            prices[symbol] = mid
    return prices


def _has_open_position(account: Account, symbol: str) -> bool:
    lot = account.holdings.get(symbol)
    return lot is not None and lot.qty > 0
