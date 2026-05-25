"""PIT score Top-N account.

This account is a real ledger strategy: on each rebalance date it ranks the
report universe using the point-in-time research board and rolls into the
highest-scoring names at equal weight.
"""

from __future__ import annotations

import math
from datetime import date, timedelta

import pandas as pd

from ..brokerage import Account
from ..contracts import BrokerageFees, PitScoreTopNConfig, PitSignalRuleConfig, SavingsPlan
from ..market import PriceBoard
from ..pit_research_board import PitResearchBoardCache
from ..savings import CashFlowEvent
from .base import (
    AccountRunOutput,
    accrue_cash_yield_since_previous,
    build_summary,
    cumulative_contributions,
    record_equity_point,
)


def simulate_pit_score_top_n(
    config: PitScoreTopNConfig,
    plan: SavingsPlan,
    fees: BrokerageFees,
    board: PriceBoard,
    reports: pd.DataFrame,
    cashflows: list[CashFlowEvent],
    trading_dates: list[date],
    *,
    cache: PitResearchBoardCache | None = None,
) -> AccountRunOutput:
    account = Account(account_id=config.account_id, fees=fees)
    if not trading_dates:
        return AccountRunOutput(
            account=account,
            equity_points=[],
            summary=build_summary(
                config.account_id, config.label, account, [], cashflows, plan.initial_capital_krw
            ),
        )

    cache = cache or PitResearchBoardCache(reports, board)
    cashflow_by_date = {event.date: event.amount_krw for event in cashflows}
    contributions = cumulative_contributions(cashflows, trading_dates)
    rebalance_days = _rebalance_days(trading_dates, config.rebalance)
    equity_points = []
    previous_day: date | None = None

    for day in trading_dates:
        accrue_cash_yield_since_previous(account, day, previous_day, plan)
        deposit_today = cashflow_by_date.get(day, 0.0)
        if deposit_today > 0:
            account.deposit(day, deposit_today)

        prices_today = board.close_on(day)
        if day in rebalance_days:
            weights = _top_n_weights(config, cache, board, day, prices_today)
            prices = _mark_prices(board, day, prices_today, account, weights)
            account.rebalance_to_weights(day, weights, prices)

        equity_points.append(
            record_equity_point(
                account,
                config.account_id,
                day,
                prices_today,
                contributions[day],
                board=board,
            )
        )
        previous_day = day

    summary = build_summary(
        config.account_id, config.label, account, equity_points, cashflows, plan.initial_capital_krw
    )
    return AccountRunOutput(account=account, equity_points=equity_points, summary=summary)


def simulate_pit_signal_rule(
    config: PitSignalRuleConfig,
    plan: SavingsPlan,
    fees: BrokerageFees,
    board: PriceBoard,
    reports: pd.DataFrame,
    cashflows: list[CashFlowEvent],
    trading_dates: list[date],
    *,
    cache: PitResearchBoardCache | None = None,
    market_board: PriceBoard | None = None,
) -> AccountRunOutput:
    account = Account(account_id=config.account_id, fees=fees)
    if not trading_dates:
        return AccountRunOutput(
            account=account,
            equity_points=[],
            summary=build_summary(
                config.account_id, config.label, account, [], cashflows, plan.initial_capital_krw
            ),
        )

    cache = cache or PitResearchBoardCache(reports, board)
    cashflow_by_date = {event.date: event.amount_krw for event in cashflows}
    contributions = cumulative_contributions(cashflows, trading_dates)
    rebalance_days = _rebalance_days(
        trading_dates,
        config.rebalance,
        quarter_offset_months=config.quarter_offset_months,
    )
    retained_cap_monitor_days = _retained_cap_monitor_days(trading_dates, config.retained_weight_cap_cadence)
    equity_points = []
    previous_day: date | None = None
    confirmation_history: list[set[str]] = []
    trailing_highs: dict[str, float] = {}
    trail_trim_indices: dict[str, int] = {}

    for trading_day_index, day in enumerate(trading_dates):
        accrue_cash_yield_since_previous(account, day, previous_day, plan)
        deposit_today = cashflow_by_date.get(day, 0.0)
        if deposit_today > 0:
            account.deposit(day, deposit_today)

        prices_today = board.close_on(day)
        exited = _apply_trailing_profit_stops(config, board, account, day, prices_today, trailing_highs)
        trimmed = _apply_trailing_profit_trims(
            config,
            board,
            account,
            day,
            prices_today,
            trailing_highs,
            trail_trim_indices,
            trading_day_index,
        )
        exited |= _apply_signal_exits(config, cache, board, account, day, prices_today)
        for symbol in exited:
            trailing_highs.pop(symbol, None)
            trail_trim_indices.pop(symbol, None)
        should_redeploy_after_trim = _should_redeploy_after_trailing_trim(
            config, board, account, day, prices_today, trimmed
        )
        should_rebalance = (
            day in rebalance_days or (config.rotate_on_exit and bool(exited)) or should_redeploy_after_trim
        )
        if should_rebalance:
            entry_confirmed_symbols = _entry_confirmed_symbols(
                config,
                cache,
                board,
                day,
                prices_today,
                confirmation_history,
            )
            weights = _signal_rule_weights(
                config,
                cache,
                board,
                day,
                prices_today,
                account=account,
                excluded_symbols=exited,
                market_board=market_board,
                entry_confirmed_symbols=entry_confirmed_symbols,
            )
            prices = _mark_prices(board, day, prices_today, account, weights)
            if config.allow_rebalance_sell_down:
                account.rebalance_to_weights(day, weights, prices)
            else:
                _sell_unselected_holdings(account, day, weights, prices)
                _cap_retained_holdings(account, day, config, prices)
                buy_fraction = (
                    float(config.redeploy_after_trailing_trim_buy_fraction)
                    if should_redeploy_after_trim
                    else 1.0
                )
                _buy_to_target_weights(account, day, weights, prices, buy_fraction=buy_fraction)
            _sync_trailing_highs(account, prices, trailing_highs, trail_trim_indices)
            _record_confirmation_snapshot(config, cache, board, day, prices_today, confirmation_history)
        elif day in retained_cap_monitor_days:
            prices = _mark_prices(board, day, prices_today, account, {})
            _cap_retained_holdings(account, day, config, prices)
            _sync_trailing_highs(account, prices, trailing_highs, trail_trim_indices)
        else:
            _sync_trailing_highs(account, prices_today, trailing_highs, trail_trim_indices)

        equity_points.append(
            record_equity_point(
                account,
                config.account_id,
                day,
                prices_today,
                contributions[day],
                board=board,
            )
        )
        previous_day = day

    summary = build_summary(
        config.account_id, config.label, account, equity_points, cashflows, plan.initial_capital_krw
    )
    return AccountRunOutput(account=account, equity_points=equity_points, summary=summary)


def _top_n_weights(
    config: PitScoreTopNConfig,
    cache: PitResearchBoardCache,
    board: PriceBoard,
    day: date,
    prices_today: dict[str, float],
) -> dict[str, float]:
    selected: list[str] = []
    for row in cache.rows(day, max_report_age_days=config.max_report_age_days, universe=config.universe):
        # The PIT score ledger follows the score board exactly. Target-hit and
        # age-expired flags are audit labels, not portfolio eligibility gates.
        if not math.isfinite(row.board_score):
            continue
        price = prices_today.get(row.symbol) or board.asof(day, row.symbol)
        if price is None or price <= 0:
            continue
        selected.append(row.symbol)
        if len(selected) >= config.top_n:
            break
    if not selected:
        return {}
    weight = 1.0 / len(selected)
    return {symbol: weight for symbol in selected}


def _signal_rule_weights(
    config: PitSignalRuleConfig,
    cache: PitResearchBoardCache,
    board: PriceBoard,
    day: date,
    prices_today: dict[str, float],
    *,
    account: Account | None = None,
    excluded_symbols: set[str] | None = None,
    market_board: PriceBoard | None = None,
    entry_confirmed_symbols: set[str] | None = None,
) -> dict[str, float]:
    if config.market_gate != "none" and market_board is None:
        raise RuntimeError(f"{config.account_id} requires benchmark prices for {config.market_gate_symbol}")
    gate_board = market_board if config.market_gate != "none" else board
    assert gate_board is not None
    if not _passes_market_gate(config, gate_board, day):
        return {}

    selected: list[str] = []
    excluded = excluded_symbols or set()
    retention_ranked = _ranked_signal_rows(config, cache, day, score_field=config.retention_score_field)
    ranked = _ranked_signal_rows(config, cache, day, score_field=config.entry_score_field)
    replacement_delay_slots = 0

    if account is not None and config.rank_exit_threshold is not None:
        ranked_by_symbol = {row.symbol: (index, row) for index, row in enumerate(retention_ranked, start=1)}
        kept: list[tuple[int, str]] = []
        live_symbols: set[str] = set()
        for symbol, lot in account.holdings.items():
            if lot.qty <= 0 or symbol in excluded:
                continue
            live_symbols.add(symbol)
            ranked_entry = ranked_by_symbol.get(symbol)
            if ranked_entry is None:
                continue
            rank, _ = ranked_entry
            holding_age_days = _holding_age_days(lot, day)
            if rank <= config.rank_exit_threshold or holding_age_days < config.min_holding_days:
                price = prices_today.get(symbol) or board.asof(day, symbol)
                if price is not None and price > 0:
                    kept.append((rank, symbol))
        selected.extend(symbol for _, symbol in sorted(kept)[: config.top_n])
        if config.replacement_delay_rebalances == 1:
            replacement_delay_slots = len(live_symbols - set(selected))

    fill_limit = config.top_n
    if replacement_delay_slots:
        fill_limit = max(len(selected), config.top_n - replacement_delay_slots)

    selected_set = set(selected)
    if len(selected) < fill_limit:
        for row in ranked:
            if row.symbol in excluded or row.symbol in selected_set:
                continue
            if not _passes_entry_rule(config, row):
                continue
            if entry_confirmed_symbols is not None and row.symbol not in entry_confirmed_symbols:
                continue
            score = float(getattr(row, config.score_field))
            if not math.isfinite(score):
                continue
            price = prices_today.get(row.symbol) or board.asof(day, row.symbol)
            if price is None or price <= 0:
                continue
            selected.append(row.symbol)
            selected_set.add(row.symbol)
            if len(selected) >= fill_limit:
                break
    if not selected:
        return {}
    rows_by_symbol = {row.symbol: row for row in ranked}
    weights = _selected_signal_weights(config, board, day, selected, rows_by_symbol)
    if replacement_delay_slots and len(selected) < config.top_n:
        gross = len(selected) / config.top_n
        weights = {symbol: weight * gross for symbol, weight in weights.items()}
    return weights


def _entry_confirmed_symbols(
    config: PitSignalRuleConfig,
    cache: PitResearchBoardCache,
    board: PriceBoard,
    day: date,
    prices_today: dict[str, float],
    confirmation_history: list[set[str]],
) -> set[str] | None:
    if config.entry_confirmation_rank is None or config.entry_confirmation_rebalances <= 1:
        return None
    current = _confirmation_snapshot(config, cache, board, day, prices_today)
    required_prior = config.entry_confirmation_rebalances - 1
    if len(confirmation_history) < required_prior:
        return set()
    confirmed = set(current)
    for snapshot in confirmation_history[-required_prior:]:
        confirmed &= snapshot
    return confirmed


def _record_confirmation_snapshot(
    config: PitSignalRuleConfig,
    cache: PitResearchBoardCache,
    board: PriceBoard,
    day: date,
    prices_today: dict[str, float],
    confirmation_history: list[set[str]],
) -> None:
    if config.entry_confirmation_rank is None or config.entry_confirmation_rebalances <= 1:
        return
    confirmation_history.append(_confirmation_snapshot(config, cache, board, day, prices_today))
    max_history = config.entry_confirmation_rebalances - 1
    if len(confirmation_history) > max_history:
        del confirmation_history[:-max_history]


def _confirmation_snapshot(
    config: PitSignalRuleConfig,
    cache: PitResearchBoardCache,
    board: PriceBoard,
    day: date,
    prices_today: dict[str, float],
) -> set[str]:
    limit = config.entry_confirmation_rank or config.top_n
    symbols: list[str] = []
    for row in _ranked_signal_rows(config, cache, day, score_field=config.entry_score_field):
        if not _passes_entry_rule(config, row):
            continue
        score = float(getattr(row, config.score_field))
        if not math.isfinite(score):
            continue
        price = prices_today.get(row.symbol) or board.asof(day, row.symbol)
        if price is None or price <= 0:
            continue
        symbols.append(row.symbol)
        if len(symbols) >= limit:
            break
    return set(symbols)


def _selected_signal_weights(
    config: PitSignalRuleConfig,
    board: PriceBoard,
    day: date,
    selected: list[str],
    rows_by_symbol,
) -> dict[str, float]:
    if config.weighting == "equal":
        raw = {symbol: 1.0 for symbol in selected}
    elif config.weighting == "score":
        raw = {
            symbol: max(0.0, float(getattr(rows_by_symbol[symbol], config.score_field)))
            for symbol in selected
        }
    elif config.weighting == "inverse_volatility":
        raw = _inverse_volatility_raw_weights(config, board, day, selected)
    else:
        raise ValueError(f"unknown PIT signal weighting: {config.weighting}")
    weights = _normalize_positive_weights(raw)
    if config.max_weight is not None:
        weights = _cap_weights(weights, float(config.max_weight))
    return _apply_exposure_controls(config, board, day, weights)


def _sell_unselected_holdings(
    account: Account,
    day: date,
    weights: dict[str, float],
    prices: dict[str, float],
) -> None:
    selected = set(weights)
    for symbol, lot in sorted(account.holdings.items()):
        if lot.qty <= 0 or symbol in selected:
            continue
        mid = prices.get(symbol)
        if mid is not None and mid > 0:
            account.sell_all(day, symbol, mid, "rebalance_sell")


def _cap_retained_holdings(
    account: Account,
    day: date,
    config: PitSignalRuleConfig,
    prices: dict[str, float],
) -> None:
    cap = config.retained_weight_cap
    if cap is None:
        return
    trigger = config.retained_weight_cap_trigger or cap
    equity = account.equity(prices)
    if equity <= 0:
        return
    for symbol, lot in sorted(account.holdings.items()):
        if lot.qty <= 0:
            continue
        mid = prices.get(symbol)
        if mid is None or mid <= 0:
            continue
        if not _passes_retained_cap_profit_cushion(config, lot, mid):
            continue
        current_value = lot.qty * mid
        if current_value <= equity * trigger:
            continue
        target_value = equity * cap
        excess_value = current_value - target_value
        sell_qty = math.floor(excess_value / mid)
        if sell_qty > 0:
            account.sell_qty(day, symbol, mid, sell_qty, "retained_cap_trim")


def _passes_retained_cap_profit_cushion(config: PitSignalRuleConfig, lot, mid: float) -> bool:
    min_return = config.retained_weight_cap_min_unrealized_return
    if min_return is None:
        return True
    if lot.avg_cost_krw <= 0:
        return False
    return mid / lot.avg_cost_krw - 1.0 >= min_return


def _apply_trailing_profit_stops(
    config: PitSignalRuleConfig,
    board: PriceBoard,
    account: Account,
    day: date,
    prices_today: dict[str, float],
    trailing_highs: dict[str, float],
) -> set[str]:
    if config.trail_stop_min_unrealized_return is None or config.trail_stop_drawdown_pct is None:
        return set()

    exited: set[str] = set()
    for symbol, lot in sorted(account.holdings.items()):
        if lot.qty <= 0 or lot.avg_cost_krw <= 0:
            trailing_highs.pop(symbol, None)
            continue
        price = prices_today.get(symbol) or board.asof(day, symbol)
        if price is None or price <= 0:
            continue
        high = max(trailing_highs.get(symbol, price), price)
        peak_return = high / lot.avg_cost_krw - 1.0
        drawdown_from_peak = price / high - 1.0
        trailing_highs[symbol] = high
        if (
            peak_return >= config.trail_stop_min_unrealized_return
            and drawdown_from_peak <= -config.trail_stop_drawdown_pct
        ):
            account.sell_all(day, symbol, price, "trailing_profit_stop")
            exited.add(symbol)
            trailing_highs.pop(symbol, None)
    return exited


def _apply_trailing_profit_trims(
    config: PitSignalRuleConfig,
    board: PriceBoard,
    account: Account,
    day: date,
    prices_today: dict[str, float],
    trailing_highs: dict[str, float],
    trail_trim_indices: dict[str, int],
    trading_day_index: int,
) -> set[str]:
    if (
        config.trail_trim_min_unrealized_return is None
        or config.trail_trim_drawdown_pct is None
        or config.trail_trim_weight_cap is None
    ):
        return set()

    prices = _mark_prices(board, day, prices_today, account, {})
    equity = account.equity(prices)
    if equity <= 0:
        return set()

    trimmed: set[str] = set()
    for symbol, lot in sorted(account.holdings.items()):
        if lot.qty <= 0 or lot.avg_cost_krw <= 0:
            trailing_highs.pop(symbol, None)
            continue
        price = prices.get(symbol)
        if price is None or price <= 0:
            continue
        last_trim_index = trail_trim_indices.get(symbol)
        if (
            last_trim_index is not None
            and config.trail_trim_cooldown_days > 0
            and trading_day_index - last_trim_index <= config.trail_trim_cooldown_days
        ):
            continue
        high = max(trailing_highs.get(symbol, price), price)
        peak_return = high / lot.avg_cost_krw - 1.0
        drawdown_from_peak = price / high - 1.0
        trailing_highs[symbol] = high
        if (
            peak_return < config.trail_trim_min_unrealized_return
            or drawdown_from_peak > -config.trail_trim_drawdown_pct
        ):
            continue
        target_value = equity * config.trail_trim_weight_cap
        current_value = lot.qty * price
        if current_value <= target_value:
            continue
        sell_qty = math.floor((current_value - target_value) / price)
        if sell_qty > 0:
            account.sell_qty(day, symbol, price, sell_qty, "trailing_profit_trim")
            trail_trim_indices[symbol] = trading_day_index
            trimmed.add(symbol)
    return trimmed


def _should_redeploy_after_trailing_trim(
    config: PitSignalRuleConfig,
    board: PriceBoard,
    account: Account,
    day: date,
    prices_today: dict[str, float],
    trimmed: set[str],
) -> bool:
    if not config.redeploy_after_trailing_trim or not trimmed:
        return False
    min_cash_pct = config.redeploy_after_trailing_trim_min_cash_pct
    if min_cash_pct is None:
        return True
    prices = _mark_prices(board, day, prices_today, account, {})
    equity = account.equity(prices)
    return equity > 0 and account.cash_krw / equity >= min_cash_pct


def _sync_trailing_highs(
    account: Account,
    prices: dict[str, float],
    trailing_highs: dict[str, float],
    trail_trim_indices: dict[str, int] | None = None,
) -> None:
    live_symbols = {symbol for symbol, lot in account.holdings.items() if lot.qty > 0}
    for symbol in set(trailing_highs) - live_symbols:
        del trailing_highs[symbol]
    if trail_trim_indices is not None:
        for symbol in set(trail_trim_indices) - live_symbols:
            del trail_trim_indices[symbol]
    for symbol in live_symbols:
        price = prices.get(symbol)
        if price is not None and price > 0:
            trailing_highs[symbol] = max(trailing_highs.get(symbol, price), price)


def _buy_to_target_weights(
    account: Account,
    day: date,
    weights: dict[str, float],
    prices: dict[str, float],
    *,
    buy_fraction: float = 1.0,
) -> None:
    equity = account.equity(prices)
    buy_fraction = min(max(float(buy_fraction), 0.0), 1.0)
    for symbol in sorted(weights):
        mid = prices.get(symbol)
        if mid is None or mid <= 0:
            continue
        current_value = account.holdings.get(symbol, None)
        held_value = (current_value.qty * mid) if current_value is not None else 0.0
        target_value = equity * weights[symbol]
        if held_value < target_value:
            target_value = held_value + (target_value - held_value) * buy_fraction
            account.buy_value(day, symbol, mid, target_value - held_value, "rebalance_buy")


def _apply_exposure_controls(
    config: PitSignalRuleConfig,
    board: PriceBoard,
    day: date,
    weights: dict[str, float],
) -> dict[str, float]:
    if not weights:
        return weights
    exposure = float(config.target_gross_exposure)
    if config.volatility_target_annual is not None:
        realised_vol = _basket_annualized_volatility(config, board, day, weights)
        if realised_vol is not None and realised_vol > 0:
            exposure *= min(1.0, float(config.volatility_target_annual) / realised_vol)
    if exposure >= 0.999999:
        return weights
    return {symbol: weight * exposure for symbol, weight in weights.items()}


def _basket_annualized_volatility(
    config: PitSignalRuleConfig,
    board: PriceBoard,
    day: date,
    weights: dict[str, float],
) -> float | None:
    start = day - timedelta(days=config.volatility_lookback_days)
    returns = board.returns_window(start, day, weights)
    if returns.empty:
        return None
    aligned_weights = pd.Series(weights, dtype=float).reindex(returns.columns).fillna(0.0)
    total_weight = float(aligned_weights.sum())
    if total_weight <= 0:
        return None
    basket_returns = returns.mul(aligned_weights / total_weight, axis=1).sum(axis=1, skipna=True).dropna()
    if len(basket_returns) < 20:
        return None
    value = float(basket_returns.std(ddof=1) * math.sqrt(252.0))
    return value if math.isfinite(value) and value > 0 else None


def _inverse_volatility_raw_weights(
    config: PitSignalRuleConfig,
    board: PriceBoard,
    day: date,
    selected: list[str],
) -> dict[str, float]:
    start = day - timedelta(days=config.volatility_lookback_days)
    returns = board.returns_window(start, day, selected)
    if returns.empty:
        return {symbol: 1.0 for symbol in selected}
    vol = returns.std(axis=0, skipna=True)
    weights: dict[str, float] = {}
    for symbol in selected:
        value = float(vol.get(symbol, math.nan))
        weights[symbol] = 1.0 / value if math.isfinite(value) and value > 0 else 0.0
    return weights


def _normalize_positive_weights(raw: dict[str, float]) -> dict[str, float]:
    positive = {symbol: value for symbol, value in raw.items() if math.isfinite(value) and value > 0}
    if not positive:
        return {}
    total = sum(positive.values())
    return {symbol: value / total for symbol, value in positive.items()}


def _cap_weights(weights: dict[str, float], cap: float) -> dict[str, float]:
    if not weights or cap * len(weights) < 1.0:
        return weights
    remaining = dict(weights)
    fixed: dict[str, float] = {}
    fixed_total = 0.0
    while remaining:
        remaining_budget = max(0.0, 1.0 - fixed_total)
        remaining_total = sum(remaining.values())
        scaled = {symbol: value / remaining_total * remaining_budget for symbol, value in remaining.items()}
        capped_symbols = [symbol for symbol, value in scaled.items() if value > cap]
        if not capped_symbols:
            fixed.update(scaled)
            break
        for symbol in capped_symbols:
            fixed[symbol] = cap
            fixed_total += cap
            del remaining[symbol]
    total = sum(fixed.values())
    return {symbol: value / total for symbol, value in fixed.items()} if total > 0 else weights


def _ranked_signal_rows(
    config: PitSignalRuleConfig,
    cache: PitResearchBoardCache,
    day: date,
    *,
    score_field: str | None = None,
):
    rows = cache.rows(day, max_report_age_days=config.max_report_age_days, universe=config.universe)
    return _sort_signal_rows(
        config,
        [row for row in rows if _passes_signal_rule(config, row)],
        score_field=score_field,
    )


def _sort_signal_rows(config: PitSignalRuleConfig, rows, *, score_field: str | None = None):
    if score_field is None and config.rank_mode == "dual_rank":
        candidate_ranked = sorted(
            rows,
            key=lambda row: (
                -row.candidate_score,
                -row.board_score,
                row.publication_date,
                row.symbol,
            ),
        )
        board_ranked = sorted(
            rows,
            key=lambda row: (
                -row.board_score,
                -row.candidate_score,
                row.publication_date,
                row.symbol,
            ),
        )
        candidate_rank = {row.symbol: index for index, row in enumerate(candidate_ranked, start=1)}
        board_rank = {row.symbol: index for index, row in enumerate(board_ranked, start=1)}
        return sorted(
            rows,
            key=lambda row: (
                min(candidate_rank[row.symbol], board_rank[row.symbol]),
                candidate_rank[row.symbol],
                board_rank[row.symbol],
                row.publication_date,
                row.symbol,
            ),
        )

    return sorted(
        rows,
        key=lambda row: (
            -float(getattr(row, score_field or config.score_field)),
            -row.board_score,
            -row.candidate_score,
            row.publication_date,
            row.symbol,
        ),
    )


def _passes_market_gate(config: PitSignalRuleConfig, board: PriceBoard, day: date) -> bool:
    if config.market_gate == "none":
        return True
    lookback = 50 if config.market_gate == "above_50ma" else 200
    price = board.asof(day, config.market_gate_symbol)
    moving_average = _moving_average_asof(board, day, config.market_gate_symbol, lookback)
    return price is not None and moving_average is not None and price > moving_average


def _moving_average_asof(board: PriceBoard, day: date, symbol: str, lookback: int) -> float | None:
    if symbol not in board.close.columns:
        return None
    series = board.close.loc[board.close.index <= pd.Timestamp(day), symbol].dropna().tail(lookback)
    if len(series) < lookback:
        return None
    value = float(series.mean())
    return value if math.isfinite(value) and value > 0 else None


def _holding_age_days(lot, day: date) -> int:
    if lot.first_buy_date is None:
        return 0
    return max(0, (day - lot.first_buy_date).days)


def _apply_signal_exits(
    config: PitSignalRuleConfig,
    cache: PitResearchBoardCache,
    board: PriceBoard,
    account: Account,
    day: date,
    prices_today: dict[str, float],
) -> set[str]:
    if not config.exit_below_50ma and config.stop_loss_pct is None:
        return set()

    exited: set[str] = set()
    for symbol, lot in sorted(account.holdings.items()):
        if lot.qty <= 0:
            continue
        price = prices_today.get(symbol) or board.asof(day, symbol)
        if price is None or price <= 0:
            continue
        if config.stop_loss_pct is not None and lot.avg_cost_krw > 0:
            unrealized_return = price / lot.avg_cost_krw - 1.0
            if unrealized_return <= -float(config.stop_loss_pct):
                account.sell_all(day, symbol, price, "stop_loss_price")
                exited.add(symbol)
                continue
        if config.exit_below_50ma:
            technicals = cache.technicals(symbol, day, price)
            if technicals.get("above_50ma") is False:
                account.sell_all(day, symbol, price, "rebound_exit")
                exited.add(symbol)
    return exited


def _passes_signal_rule(config: PitSignalRuleConfig, row) -> bool:
    if row.report_age_days < config.min_report_age_days:
        return False
    if row.report_age_days > config.max_report_age_days:
        return False
    if config.require_above_200ma and row.above_200ma is not True:
        return False
    if config.require_ma_stack and row.ma_stack is not True:
        return False
    if config.require_macd_bullish and row.macd_bullish is not True:
        return False
    if config.min_return_3m is not None and (row.return_3m is None or row.return_3m < config.min_return_3m):
        return False
    if config.min_return_6m is not None and (row.return_6m is None or row.return_6m < config.min_return_6m):
        return False
    if config.min_distance_from_52w_high is not None:
        return (
            row.distance_from_52w_high is not None
            and row.distance_from_52w_high >= config.min_distance_from_52w_high
        )
    return True


def _passes_entry_rule(config: PitSignalRuleConfig, row) -> bool:
    return config.entry_max_report_age_days is None or row.report_age_days <= config.entry_max_report_age_days


def _mark_prices(
    board: PriceBoard,
    day: date,
    prices_today: dict[str, float],
    account: Account,
    weights: dict[str, float],
) -> dict[str, float]:
    prices = dict(prices_today)
    for symbol in set(account.holdings) | set(weights):
        price = prices.get(symbol)
        if price is None or price <= 0:
            price = board.asof(day, symbol)
        if price is not None and price > 0:
            prices[symbol] = price
    return prices


def _rebalance_days(
    trading_dates: list[date],
    cadence: str,
    *,
    quarter_offset_months: int = 0,
) -> set[date]:
    if cadence == "monthly":
        monthly_seen: dict[tuple[int, int], date] = {}
        for day in trading_dates:
            monthly_seen.setdefault((day.year, day.month), day)
        return set(monthly_seen.values())
    if cadence == "semimonthly":
        semimonthly_seen: dict[tuple[int, int, int], date] = {}
        for day in trading_dates:
            half = 0 if day.day < 15 else 1
            semimonthly_seen.setdefault((day.year, day.month, half), day)
        return set(semimonthly_seen.values())
    if cadence == "quarterly":
        quarterly_seen: dict[tuple[int, int], date] = {}
        for day in trading_dates:
            if (day.month - 1 - quarter_offset_months) % 3 != 0:
                continue
            quarterly_seen.setdefault((day.year, day.month), day)
        return set(quarterly_seen.values())
    raise ValueError(f"unknown PIT score rebalance cadence: {cadence}")


def _retained_cap_monitor_days(trading_dates: list[date], cadence: str) -> set[date]:
    if cadence == "rebalance":
        return set()
    if cadence == "daily":
        return set(trading_dates)
    if cadence == "weekly":
        weekly_seen: dict[tuple[int, int], date] = {}
        for day in trading_dates:
            year, week, _ = day.isocalendar()
            weekly_seen.setdefault((year, week), day)
        return set(weekly_seen.values())
    raise ValueError(f"unknown retained cap monitor cadence: {cadence}")
