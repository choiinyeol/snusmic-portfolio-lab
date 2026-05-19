"""Stock-rule personas promoted from IS search and OOS admission."""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

import numpy as np
import pandas as pd

from ..brokerage import Account
from ..contracts import BrokerageFees, SavingsPlan, StockRulePersonaConfig
from ..market import PriceBoard
from ..savings import CashFlowEvent
from .base import (
    PersonaRunOutput,
    accrue_cash_yield_since_previous,
    build_summary,
    cumulative_contributions,
    record_equity_point,
)

if TYPE_CHECKING:
    from ..stock_rule_search import StockRuleConfig


def simulate_stock_rule_persona(
    config: StockRulePersonaConfig,
    plan: SavingsPlan,
    fees: BrokerageFees,
    board: PriceBoard,
    reports: pd.DataFrame,
    cashflows: list[CashFlowEvent],
    trading_dates: list[date],
) -> PersonaRunOutput:
    """Replay a frozen stock-rule config through the real share ledger."""

    from ..stock_rule_search import _prepare_stock_reports, _report_state_matrices, _weights_for_config

    persona = config.persona_name
    account = Account(persona=persona, fees=fees)
    if not trading_dates:
        return PersonaRunOutput(
            account=account,
            equity_points=[],
            summary=build_summary(persona, config.label, account, [], cashflows, plan.initial_capital_krw),
        )

    rule = _stock_rule_config(config)
    close = board.close.loc[
        (board.close.index >= pd.Timestamp(trading_dates[0]))
        & (board.close.index <= pd.Timestamp(trading_dates[-1]))
    ].copy()
    close = close.ffill(limit=3).dropna(how="all")
    if close.empty:
        return PersonaRunOutput(
            account=account,
            equity_points=[],
            summary=build_summary(persona, config.label, account, [], cashflows, plan.initial_capital_krw),
        )

    prepared_reports = _prepare_stock_reports(reports, board)
    report_state = _report_state_matrices(
        pd.DatetimeIndex(close.index), list(close.columns), prepared_reports
    )
    weights, _ = _weights_for_config(close, report_state, rule)
    weights_by_day = {
        ts.date(): _weight_row(list(close.columns), weights[idx]) for idx, ts in enumerate(close.index)
    }

    cashflow_by_date: dict[date, float] = {event.date: event.amount_krw for event in cashflows}
    contributions = cumulative_contributions(cashflows, trading_dates)
    daily_closes = {day: board.close_on(day) for day in trading_dates}
    equity_points = []
    previous_day: date | None = None
    previous_weights: dict[str, float] = {}

    for day in trading_dates:
        accrue_cash_yield_since_previous(account, day, previous_day, plan)
        deposit_today = cashflow_by_date.get(day, 0.0)
        if deposit_today > 0:
            account.deposit(day, deposit_today)

        weights_today = weights_by_day.get(day, previous_weights)
        if _should_rebalance(weights_today, previous_weights, deposit_today):
            account.rebalance_to_weights(day, weights_today, daily_closes[day])
        previous_weights = weights_today

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

    return PersonaRunOutput(
        account=account,
        equity_points=equity_points,
        summary=build_summary(
            persona, config.label, account, equity_points, cashflows, plan.initial_capital_krw
        ),
    )


def _stock_rule_config(config: StockRulePersonaConfig) -> StockRuleConfig:
    from ..stock_rule_search import StockRuleConfig

    return StockRuleConfig(
        rule_id=config.rule_id,
        family=config.family,
        fast_ma_days=config.fast_ma_days,
        slow_ma_days=config.slow_ma_days,
        min_report_age_days=config.min_report_age_days,
        max_report_age_days=config.max_report_age_days,
        rebalance=config.rebalance,
        top_pool=config.top_pool,
        hold_top=config.hold_top,
        weight_mode=config.weight_mode,
        score_mode=config.score_mode,
        min_dynamic_upside=config.min_dynamic_upside,
        min_momentum_return=config.min_momentum_return,
        min_pullback_pct=config.min_pullback_pct,
    )


def _weight_row(columns: list[str], row: np.ndarray) -> dict[str, float]:
    out: dict[str, float] = {}
    for idx, value in enumerate(row):
        weight = float(value)
        if np.isfinite(weight) and weight > 0:
            out[columns[idx]] = weight
    return out


def _should_rebalance(
    weights_today: dict[str, float],
    previous_weights: dict[str, float],
    deposit_today: float,
) -> bool:
    if weights_today != previous_weights:
        return True
    return deposit_today > 0 and bool(weights_today)
