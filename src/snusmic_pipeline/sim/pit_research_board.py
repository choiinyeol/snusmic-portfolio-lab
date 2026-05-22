"""Point-in-time research board rows and score-based portfolio persona.

This module intentionally does not reuse the present-day web screener rows.
Every row is rebuilt for one ``as_of`` date from reports published on or before
that date and price history observed on or before that date.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Literal

import numpy as np
import pandas as pd

from .brokerage import Account
from .contracts import BrokerageFees, PitResearchBoardConfig, SavingsPlan
from .market import PriceBoard
from .personas.base import (
    PersonaRunOutput,
    accrue_cash_yield_since_previous,
    build_summary,
    cumulative_contributions,
    record_equity_point,
)
from .savings import CashFlowEvent


@dataclass(frozen=True)
class PitResearchBoardRow:
    as_of_date: date
    price_date: date
    report_id: str
    symbol: str
    company: str
    publication_date: date
    report_age_days: int
    entry_price_krw: float
    target_price_krw: float
    last_close_krw: float
    target_upside_at_pub: float
    current_return: float
    target_gap_pct: float
    ytd_return: float | None
    return_1m: float | None
    return_3m: float | None
    return_6m: float | None
    return_1y: float | None
    distance_from_52w_high: float | None
    above_20ma: bool | None
    above_50ma: bool | None
    above_200ma: bool | None
    ma_stack: bool | None
    ema_stack: bool | None
    macd_line: float | None
    macd_signal: float | None
    macd_hist: float | None
    macd_bullish: bool | None
    target_hit: bool
    expired: bool
    bucket: str
    rank_basis: str
    candidate_score: float
    board_score: float
    ta_momentum_score: float

    def to_record(
        self, *, persona: str | None = None, rank: int | None = None, weight: float | None = None
    ) -> dict[str, object]:
        return {
            "persona": persona,
            "rank": rank,
            "weight": weight,
            "as_of_date": self.as_of_date.isoformat(),
            "price_date": self.price_date.isoformat(),
            "report_id": self.report_id,
            "symbol": self.symbol,
            "company": self.company,
            "publication_date": self.publication_date.isoformat(),
            "report_age_days": self.report_age_days,
            "entry_price_krw": self.entry_price_krw,
            "target_price_krw": self.target_price_krw,
            "last_close_krw": self.last_close_krw,
            "target_upside_at_pub": self.target_upside_at_pub,
            "current_return": self.current_return,
            "target_gap_pct": self.target_gap_pct,
            "ytd_return": self.ytd_return,
            "return_1m": self.return_1m,
            "return_3m": self.return_3m,
            "return_6m": self.return_6m,
            "return_1y": self.return_1y,
            "distance_from_52w_high": self.distance_from_52w_high,
            "above_20ma": self.above_20ma,
            "above_50ma": self.above_50ma,
            "above_200ma": self.above_200ma,
            "ma_stack": self.ma_stack,
            "ema_stack": self.ema_stack,
            "macd_line": self.macd_line,
            "macd_signal": self.macd_signal,
            "macd_hist": self.macd_hist,
            "macd_bullish": self.macd_bullish,
            "target_hit": self.target_hit,
            "expired": self.expired,
            "bucket": self.bucket,
            "rank_basis": self.rank_basis,
            "candidate_score": self.candidate_score,
            "board_score": self.board_score,
            "ta_momentum_score": self.ta_momentum_score,
        }


@dataclass(frozen=True)
class PitSelection:
    as_of_date: date
    rows: tuple[PitResearchBoardRow, ...]
    weights: dict[str, float]
    report_ids: dict[str, str]


@dataclass
class PitResearchBoardCache:
    """Reusable PIT board rows and as-of diagnostics for repeated simulations."""

    reports: pd.DataFrame
    board: PriceBoard
    _prepared_reports: pd.DataFrame = field(init=False, repr=False)
    _rows_by_key: dict[tuple[date, int, str], list[PitResearchBoardRow]] = field(
        default_factory=dict, init=False, repr=False
    )
    _technicals_by_key: dict[tuple[str, date], dict[str, float | bool | None]] = field(
        default_factory=dict, init=False, repr=False
    )
    _target_hit_by_key: dict[tuple[str, date, date, float], bool] = field(
        default_factory=dict, init=False, repr=False
    )
    _price_date_by_key: dict[tuple[str, date], date | None] = field(
        default_factory=dict, init=False, repr=False
    )

    def __post_init__(self) -> None:
        self._prepared_reports = _prepare_pit_reports(self.reports)

    def rows(
        self,
        as_of: date,
        *,
        max_report_age_days: int,
        universe: Literal["all", "domestic", "overseas"],
    ) -> list[PitResearchBoardRow]:
        key = (as_of, max_report_age_days, universe)
        cached = self._rows_by_key.get(key)
        if cached is None:
            cached = _build_pit_research_board_from_prepared(
                self._prepared_reports,
                self.board,
                as_of,
                max_report_age_days=max_report_age_days,
                universe=universe,
                cache=self,
            )
            self._rows_by_key[key] = cached
        return cached

    def technicals(
        self,
        symbol: str,
        as_of: date,
        current: float,
    ) -> dict[str, float | bool | None]:
        key = (symbol, as_of)
        cached = self._technicals_by_key.get(key)
        if cached is None:
            cached = _technicals_asof(self.board, symbol, as_of, current)
            self._technicals_by_key[key] = cached
        return cached

    def target_hit(self, symbol: str, start: date, end: date, target: float) -> bool:
        key = (symbol, start, end, float(target))
        if key not in self._target_hit_by_key:
            self._target_hit_by_key[key] = _target_hit_asof(self.board, symbol, start, end, target)
        return self._target_hit_by_key[key]

    def price_date(self, symbol: str, as_of: date) -> date | None:
        key = (symbol, as_of)
        if key not in self._price_date_by_key:
            self._price_date_by_key[key] = _price_date_asof(self.board, as_of, symbol)
        return self._price_date_by_key[key]


def default_pit_research_board_configs() -> tuple[PitResearchBoardConfig, ...]:
    """Small diverse family seeded from the product research-board concepts."""
    return (
        PitResearchBoardConfig(
            persona_name="pit_research_board_score_top5",
            label="PIT Research Board Score Top 5",
            top_n=5,
            score_mode="board_score",
            weight_mode="equal",
        ),
        PitResearchBoardConfig(
            persona_name="pit_research_board_score_top10",
            label="PIT Research Board Score Top 10",
            top_n=10,
            score_mode="board_score",
            weight_mode="score_proportional",
        ),
        PitResearchBoardConfig(
            persona_name="pit_research_board_large_upside_top10",
            label="PIT Large Upside Top 10",
            top_n=10,
            score_mode="candidate_score",
            bucket_filter="large-upside",
            weight_mode="equal",
        ),
        PitResearchBoardConfig(
            persona_name="pit_research_board_trend_top10",
            label="PIT Trend-Confirmed Top 10",
            top_n=10,
            score_mode="board_score",
            require_ma_stack=True,
            weight_mode="score_proportional",
        ),
        PitResearchBoardConfig(
            persona_name="pit_research_board_near_high_top10",
            label="PIT Near-High Top 10",
            top_n=10,
            score_mode="board_score",
            require_near_52w_high=True,
            weight_mode="equal",
        ),
    )


def build_pit_research_board(
    reports: pd.DataFrame,
    board: PriceBoard,
    as_of: date,
    *,
    max_report_age_days: int = 730,
    universe: Literal["all", "domestic", "overseas"] = "all",
    cache: PitResearchBoardCache | None = None,
) -> list[PitResearchBoardRow]:
    """Build one product-like research board using only data known by ``as_of``."""
    if cache is not None:
        return list(cache.rows(as_of, max_report_age_days=max_report_age_days, universe=universe))
    prepared = _prepare_pit_reports(reports)
    return _build_pit_research_board_from_prepared(
        prepared,
        board,
        as_of,
        max_report_age_days=max_report_age_days,
        universe=universe,
        cache=None,
    )


def _prepare_pit_reports(reports: pd.DataFrame) -> pd.DataFrame:
    if reports.empty:
        return reports
    prepared = reports.copy()
    prepared["publication_date"] = pd.to_datetime(prepared["publication_date"], errors="coerce")
    prepared = prepared.dropna(subset=["publication_date", "symbol"])
    return prepared.sort_values(["symbol", "publication_date", "report_id"])


def _build_pit_research_board_from_prepared(
    prepared: pd.DataFrame,
    board: PriceBoard,
    as_of: date,
    *,
    max_report_age_days: int,
    universe: Literal["all", "domestic", "overseas"],
    cache: PitResearchBoardCache | None,
) -> list[PitResearchBoardRow]:
    if prepared.empty or board.close.empty:
        return []
    current_reports = prepared[prepared["publication_date"] <= pd.Timestamp(as_of)]
    if current_reports.empty:
        return []
    latest = current_reports.groupby("symbol", as_index=False).tail(1)
    rows: list[PitResearchBoardRow] = []
    for raw_record in latest.to_dict("records"):
        record = {str(key): value for key, value in raw_record.items()}
        row = _row_from_report(
            record,
            board,
            as_of,
            max_report_age_days=max_report_age_days,
            universe=universe,
            cache=cache,
        )
        if row is not None:
            rows.append(row)
    return sorted(
        rows, key=lambda row: (-row.board_score, -row.candidate_score, row.publication_date, row.symbol)
    )


def select_pit_research_board(
    reports: pd.DataFrame,
    board: PriceBoard,
    as_of: date,
    config: PitResearchBoardConfig,
    cache: PitResearchBoardCache | None = None,
) -> PitSelection:
    rows = build_pit_research_board(
        reports,
        board,
        as_of,
        max_report_age_days=config.max_report_age_days,
        universe=config.universe,
        cache=cache,
    )
    eligible = [row for row in rows if _eligible(row, config)]
    score_attr = _score_attr(config)
    eligible.sort(key=lambda row: (-float(getattr(row, score_attr)), row.publication_date, row.symbol))
    selected = tuple(eligible[: config.top_n])
    weights = _weights(selected, config, score_attr)
    return PitSelection(
        as_of_date=as_of,
        rows=selected,
        weights=weights,
        report_ids={row.symbol: row.report_id for row in selected},
    )


def simulate_pit_research_board(
    config: PitResearchBoardConfig,
    plan: SavingsPlan,
    fees: BrokerageFees,
    board: PriceBoard,
    reports: pd.DataFrame,
    cashflows: list[CashFlowEvent],
    trading_dates: list[date],
    row_cache: PitResearchBoardCache | None = None,
) -> PersonaRunOutput:
    persona = config.persona_name
    account = Account(persona=persona, fees=fees)
    if not trading_dates:
        return PersonaRunOutput(
            account=account,
            equity_points=[],
            summary=build_summary(persona, config.label, account, [], cashflows, plan.initial_capital_krw),
        )

    cashflow_by_date = {event.date: event.amount_krw for event in cashflows}
    contributions = cumulative_contributions(cashflows, trading_dates)
    daily_closes = {day: board.close_on(day) for day in trading_dates}
    equity_points = []
    previous_day: date | None = None
    pending: PitSelection | None = None
    report_ids_by_symbol: dict[str, str] = {}
    closed_report_ids: set[str] = set()
    target_winner_report_ids: set[str] = set()
    target_winner_peaks: dict[str, float] = {}
    reports_by_id = {
        str(row.get("report_id") or ""): {str(key): value for key, value in row.items()}
        for row in reports.to_dict("records")
    }
    row_cache = row_cache or PitResearchBoardCache(reports, board)

    for day in trading_dates:
        accrue_cash_yield_since_previous(account, day, previous_day, plan)
        deposit_today = cashflow_by_date.get(day, 0.0)
        if deposit_today > 0:
            account.deposit(day, deposit_today)

        prices_today = daily_closes[day]
        _sell_positions_no_longer_valid(
            account,
            day,
            prices_today,
            reports_by_id,
            board,
            report_ids_by_symbol,
            closed_report_ids,
            target_winner_report_ids,
            target_winner_peaks,
            config,
        )
        if pending is not None:
            pending = _selection_without_report_ids(pending, closed_report_ids, config)
            _rebalance_to_selection(
                account,
                day,
                pending,
                prices_today,
                report_ids_by_symbol,
                target_winner_report_ids,
                config,
            )
            pending = None

        equity_points.append(
            record_equity_point(account, persona, day, prices_today, contributions[day], board=board)
        )

        if _decision_day(day, previous_day, config.rebalance) or deposit_today > 0:
            pending = select_pit_research_board(reports, board, day, config, cache=row_cache)
        previous_day = day

    for symbol in list(account.holdings):
        mid = board.asof(trading_dates[-1], symbol)
        if mid is not None:
            account.sell_all(trading_dates[-1], symbol, mid, "end_of_sim", report_ids_by_symbol.get(symbol))

    return PersonaRunOutput(
        account=account,
        equity_points=equity_points,
        summary=build_summary(
            persona, config.label, account, equity_points, cashflows, plan.initial_capital_krw
        ),
    )


def snapshot_rows_for_config(
    config: PitResearchBoardConfig,
    reports: pd.DataFrame,
    board: PriceBoard,
    trading_dates: list[date],
) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    previous_day: date | None = None
    row_cache = PitResearchBoardCache(reports, board)
    for idx, day in enumerate(trading_dates):
        if not _decision_day(day, previous_day, config.rebalance):
            previous_day = day
            continue
        selection = select_pit_research_board(reports, board, day, config, cache=row_cache)
        trade_date = trading_dates[idx + 1] if idx + 1 < len(trading_dates) else None
        for rank, row in enumerate(selection.rows, start=1):
            item = row.to_record(
                persona=config.persona_name, rank=rank, weight=selection.weights.get(row.symbol)
            )
            item["trade_date"] = trade_date.isoformat() if trade_date else None
            item["score_mode"] = config.score_mode
            item["rebalance"] = config.rebalance
            records.append(item)
        previous_day = day
    return records


def _row_from_report(
    record: dict[str, object],
    board: PriceBoard,
    as_of: date,
    *,
    max_report_age_days: int,
    universe: str,
    cache: PitResearchBoardCache | None = None,
) -> PitResearchBoardRow | None:
    symbol = str(record.get("symbol") or "").strip()
    if not symbol or not _passes_universe(symbol, universe):
        return None
    publication_date = _as_date(record.get("publication_date"))
    if publication_date is None or publication_date > as_of:
        return None
    target = _number(record.get("target_price_krw")) or _number(record.get("target_price"))
    if target is None or target <= 0:
        return None
    current = board.asof(as_of, symbol)
    price_date = (
        cache.price_date(symbol, as_of) if cache is not None else _price_date_asof(board, as_of, symbol)
    )
    if current is None or current <= 0 or price_date is None or price_date > as_of:
        return None
    entry = _number(record.get("report_current_price_krw")) or board.asof(publication_date, symbol)
    if entry is None or entry <= 0:
        return None
    target_upside = target / entry - 1.0
    if target_upside <= 0:
        return None
    age = (as_of - publication_date).days
    target_hit = (
        cache.target_hit(symbol, publication_date, as_of, target)
        if cache is not None
        else _target_hit_asof(board, symbol, publication_date, as_of, target)
    )
    expired = age > max_report_age_days
    current_return = current / entry - 1.0
    target_gap = current / target - 1.0
    tech = (
        cache.technicals(symbol, as_of, current)
        if cache is not None
        else _technicals_asof(board, symbol, as_of, current)
    )
    bucket, rank_basis = _bucket(age, target_upside, target_gap)
    candidate_score = (target_upside * 1.4) + max(0.0, current_return) - max(0.0, target_gap * 0.25)
    board_score = _board_score(candidate_score, tech)
    ta_momentum_score = _ta_momentum_score(target_upside, current_return, target_gap, tech)
    return PitResearchBoardRow(
        as_of_date=as_of,
        price_date=price_date,
        report_id=str(record.get("report_id") or ""),
        symbol=symbol,
        company=str(record.get("company") or symbol),
        publication_date=publication_date,
        report_age_days=age,
        entry_price_krw=float(entry),
        target_price_krw=float(target),
        last_close_krw=float(current),
        target_upside_at_pub=float(target_upside),
        current_return=float(current_return),
        target_gap_pct=float(target_gap),
        ytd_return=tech["ytd_return"],
        return_1m=tech["return_1m"],
        return_3m=tech["return_3m"],
        return_6m=tech["return_6m"],
        return_1y=tech["return_1y"],
        distance_from_52w_high=tech["distance_from_52w_high"],
        above_20ma=_bool_or_none(tech.get("above_20ma")),
        above_50ma=_bool_or_none(tech.get("above_50ma")),
        above_200ma=_bool_or_none(tech.get("above_200ma")),
        ma_stack=_bool_or_none(tech.get("ma_stack")),
        ema_stack=_bool_or_none(tech.get("ema_stack")),
        macd_line=_float_or_none(tech.get("macd_line")),
        macd_signal=_float_or_none(tech.get("macd_signal")),
        macd_hist=_float_or_none(tech.get("macd_hist")),
        macd_bullish=_bool_or_none(tech.get("macd_bullish")),
        target_hit=target_hit,
        expired=expired,
        bucket=bucket,
        rank_basis=rank_basis,
        candidate_score=round(float(candidate_score), 6),
        board_score=round(float(board_score), 6),
        ta_momentum_score=round(float(ta_momentum_score), 6),
    )


def _eligible(row: PitResearchBoardRow, config: PitResearchBoardConfig) -> bool:
    if row.target_hit or row.expired:
        return False
    if row.report_age_days < config.min_report_age_days:
        return False
    if row.target_upside_at_pub < config.min_target_upside_at_pub:
        return False
    if row.target_upside_at_pub > config.max_target_upside_at_pub:
        return False
    if row.current_return < config.min_current_return or row.current_return > config.max_current_return:
        return False
    if not _meets_optional_floor(row.return_1m, config.min_return_1m):
        return False
    if not _meets_optional_floor(row.return_3m, config.min_return_3m):
        return False
    if not _meets_optional_floor(row.return_6m, config.min_return_6m):
        return False
    if not _meets_optional_floor(row.return_1y, config.min_return_1y):
        return False
    if not _meets_optional_floor(row.distance_from_52w_high, config.min_distance_from_52w_high):
        return False
    score = getattr(row, _score_attr(config))
    if score < config.min_score:
        return False
    if config.bucket_filter != "all" and row.bucket != config.bucket_filter:
        return False
    if config.require_ma_stack and row.ma_stack is not True:
        return False
    if config.require_ema_stack and row.ema_stack is not True:
        return False
    if config.require_macd_bullish and row.macd_bullish is not True:
        return False
    return not (
        config.require_near_52w_high
        and (row.distance_from_52w_high is None or row.distance_from_52w_high < -0.10)
    )


def _weights(
    rows: tuple[PitResearchBoardRow, ...], config: PitResearchBoardConfig, score_attr: str
) -> dict[str, float]:
    if not rows:
        return {}
    if config.weight_mode == "winner_compress" and len(rows) > 1:
        rest = 0.45 / (len(rows) - 1)
        return {row.symbol: (0.55 if idx == 0 else rest) for idx, row in enumerate(rows)}
    if config.weight_mode == "score_proportional":
        raw = [max(0.0, float(getattr(row, score_attr))) for row in rows]
        total = sum(raw)
        if total > 0:
            return {row.symbol: value / total for row, value in zip(rows, raw, strict=True)}
    weight = 1.0 / len(rows)
    return {row.symbol: weight for row in rows}


def _meets_optional_floor(value: float | None, floor: float) -> bool:
    if floor <= -1.0:
        return True
    return value is not None and value >= floor


def _score_attr(config: PitResearchBoardConfig) -> str:
    if config.score_mode == "candidate_score":
        return "candidate_score"
    if config.score_mode == "ta_momentum_score":
        return "ta_momentum_score"
    return "board_score"


def _selection_without_report_ids(
    selection: PitSelection,
    report_ids: set[str],
    config: PitResearchBoardConfig,
) -> PitSelection:
    if not report_ids:
        return selection
    rows = tuple(row for row in selection.rows if row.report_id not in report_ids)
    if len(rows) == len(selection.rows):
        return selection
    score_attr = _score_attr(config)
    return PitSelection(
        as_of_date=selection.as_of_date,
        rows=rows,
        weights=_weights(rows, config, score_attr),
        report_ids={row.symbol: row.report_id for row in rows},
    )


def _rebalance_to_selection(
    account: Account,
    day: date,
    selection: PitSelection,
    prices: dict[str, float],
    report_ids_by_symbol: dict[str, str],
    target_winner_report_ids: set[str],
    config: PitResearchBoardConfig,
) -> None:
    weights = selection.weights
    equity = account.equity(prices)
    for symbol, report_id in selection.report_ids.items():
        if symbol in account.holdings and not _is_retained_winner(
            symbol, report_ids_by_symbol, target_winner_report_ids, config
        ):
            report_ids_by_symbol[symbol] = report_id

    retained_symbols = {
        symbol
        for symbol, lot in account.holdings.items()
        if lot.qty > 0 and _is_retained_winner(symbol, report_ids_by_symbol, target_winner_report_ids, config)
    }
    retained_value = sum(
        account.holdings[symbol].qty * prices.get(symbol, 0.0)
        for symbol in retained_symbols
        if symbol in account.holdings
    )
    deployable_equity = max(0.0, equity - retained_value)
    active_weights = {
        symbol: weight for symbol, weight in weights.items() if symbol not in retained_symbols and weight > 0
    }
    active_total = sum(active_weights.values())
    targets = (
        {symbol: deployable_equity * (weight / active_total) for symbol, weight in active_weights.items()}
        if active_total > 0
        else {}
    )
    live_symbols = set(account.holdings) | set(targets)
    for symbol in sorted(live_symbols):
        lot = account.holdings.get(symbol)
        if lot is None or lot.qty <= 0:
            continue
        mid = prices.get(symbol)
        if mid is None or mid <= 0:
            continue
        if _is_retained_winner(symbol, report_ids_by_symbol, target_winner_report_ids, config):
            continue
        target_value = targets.get(symbol, 0.0)
        current_value = lot.qty * mid
        if target_value <= 0:
            account.sell_all(day, symbol, mid, "rebalance_sell", report_ids_by_symbol.get(symbol))
            report_ids_by_symbol.pop(symbol, None)
        elif current_value > target_value * 1.05:
            qty = math.floor((current_value - target_value) / mid)
            if qty > 0:
                account.sell_qty(day, symbol, mid, qty, "rebalance_sell", report_ids_by_symbol.get(symbol))
    for row in selection.rows:
        symbol = row.symbol
        if symbol not in targets:
            continue
        mid = prices.get(symbol)
        if mid is None or mid <= 0:
            continue
        if _is_retained_winner(symbol, report_ids_by_symbol, target_winner_report_ids, config):
            continue
        lot = account.holdings.get(symbol)
        current_value = 0.0 if lot is None else lot.qty * mid
        target_value = targets[symbol]
        if target_value > current_value * 1.05:
            filled = account.buy_value(
                day,
                symbol,
                mid,
                target_value - current_value,
                "rebalance_buy",
                selection.report_ids.get(symbol),
            )
            if filled > 0:
                report_ids_by_symbol[symbol] = selection.report_ids.get(
                    symbol, report_ids_by_symbol.get(symbol, "")
                )


def _sell_positions_no_longer_valid(
    account: Account,
    day: date,
    prices: dict[str, float],
    reports_by_id: dict[str, dict[str, object]],
    board: PriceBoard,
    report_ids_by_symbol: dict[str, str],
    closed_report_ids: set[str],
    target_winner_report_ids: set[str],
    target_winner_peaks: dict[str, float],
    config: PitResearchBoardConfig,
) -> None:
    if not reports_by_id or not report_ids_by_symbol:
        return
    for symbol, report_id in list(report_ids_by_symbol.items()):
        lot = account.holdings.get(symbol)
        mid = prices.get(symbol)
        if lot is None or lot.qty <= 0 or mid is None or mid <= 0:
            continue
        report = reports_by_id.get(report_id)
        if report is None:
            continue
        pub = _as_date(report.get("publication_date"))
        target = _number(report.get("target_price_krw")) or _number(report.get("target_price"))
        if pub is None or target is None:
            continue
        if config.hold_target_winners and report_id in target_winner_report_ids:
            _update_winner_peak(symbol, day, mid, board, target_winner_peaks)
            trailing_price = _winner_trailing_stop(symbol, target_winner_peaks, config)
            if trailing_price is not None and board.target_touched_on(
                day, symbol, trailing_price, "downside"
            ):
                account.sell_all(day, symbol, trailing_price, "stop_loss_price", report_id)
                _close_report(report_id, report_ids_by_symbol, closed_report_ids, symbol)
                target_winner_report_ids.discard(report_id)
                target_winner_peaks.pop(symbol, None)
                continue
            if (
                config.max_holding_days > 0
                and lot.first_buy_date is not None
                and (day - lot.first_buy_date).days >= config.max_holding_days
            ):
                account.sell_all(day, symbol, mid, "stop_loss_max_hold", report_id)
                _close_report(report_id, report_ids_by_symbol, closed_report_ids, symbol)
                target_winner_report_ids.discard(report_id)
                target_winner_peaks.pop(symbol, None)
                continue
            if (day - pub).days > config.max_report_age_days:
                account.sell_all(day, symbol, mid, "stop_loss_report_age", report_id)
                _close_report(report_id, report_ids_by_symbol, closed_report_ids, symbol)
                target_winner_report_ids.discard(report_id)
                target_winner_peaks.pop(symbol, None)
                continue
            continue

        if config.stop_loss_pct > 0:
            stop_price = lot.avg_cost_krw * (1.0 - config.stop_loss_pct)
            if board.target_touched_on(day, symbol, stop_price, "downside"):
                account.sell_all(day, symbol, stop_price, "stop_loss_price", report_id)
                _close_report(report_id, report_ids_by_symbol, closed_report_ids, symbol)
                continue

        target_threshold = _target_threshold_for_report(report, board, symbol, pub, target, config)
        sell_threshold = target_threshold
        if config.take_profit_pct > 0:
            profit_cap = lot.avg_cost_krw * (1.0 + config.take_profit_pct)
            sell_threshold = min(target_threshold, profit_cap)
        if board.target_touched_on(day, symbol, sell_threshold):
            if config.hold_target_winners and config.take_profit_pct == 0:
                target_winner_report_ids.add(report_id)
                _update_winner_peak(symbol, day, mid, board, target_winner_peaks)
                continue
            fill_price = (
                mid if config.take_profit_pct == 0 and config.target_hit_multiplier == 1.0 else sell_threshold
            )
            account.sell_all(day, symbol, fill_price, "target_hit", report_id)
            if config.take_profit_pct > 0 or config.target_hit_multiplier != 1.0:
                _close_report(report_id, report_ids_by_symbol, closed_report_ids, symbol)
            else:
                report_ids_by_symbol.pop(symbol, None)
            continue

        if (
            config.max_holding_days > 0
            and lot.first_buy_date is not None
            and (day - lot.first_buy_date).days >= config.max_holding_days
        ):
            account.sell_all(day, symbol, mid, "stop_loss_max_hold", report_id)
            _close_report(report_id, report_ids_by_symbol, closed_report_ids, symbol)
            continue

        if (day - pub).days > config.max_report_age_days:
            account.sell_all(day, symbol, mid, "stop_loss_report_age", report_id)
            _close_report(report_id, report_ids_by_symbol, closed_report_ids, symbol)


def _close_report(
    report_id: str,
    report_ids_by_symbol: dict[str, str],
    closed_report_ids: set[str],
    symbol: str,
) -> None:
    report_ids_by_symbol.pop(symbol, None)
    if report_id:
        closed_report_ids.add(report_id)


def _target_threshold_for_report(
    report: dict[str, object],
    board: PriceBoard,
    symbol: str,
    publication_date: date,
    target: float,
    config: PitResearchBoardConfig,
) -> float:
    """Translate target-hit multiplier into price progress from entry to target."""

    entry = _number(report.get("report_current_price_krw")) or board.asof(publication_date, symbol)
    if entry is None or entry <= 0 or entry >= target:
        return target * config.target_hit_multiplier
    return entry + (target - entry) * config.target_hit_multiplier


def _is_retained_winner(
    symbol: str,
    report_ids_by_symbol: dict[str, str],
    target_winner_report_ids: set[str],
    config: PitResearchBoardConfig,
) -> bool:
    return config.hold_target_winners and report_ids_by_symbol.get(symbol) in target_winner_report_ids


def _update_winner_peak(
    symbol: str,
    day: date,
    mid: float,
    board: PriceBoard,
    target_winner_peaks: dict[str, float],
) -> None:
    high = board.intraday_high_on(day, symbol) or mid
    target_winner_peaks[symbol] = max(target_winner_peaks.get(symbol, 0.0), high, mid)


def _winner_trailing_stop(
    symbol: str,
    target_winner_peaks: dict[str, float],
    config: PitResearchBoardConfig,
) -> float | None:
    if config.target_winner_trailing_stop_pct <= 0:
        return None
    peak = target_winner_peaks.get(symbol)
    if peak is None or peak <= 0:
        return None
    return peak * (1.0 - config.target_winner_trailing_stop_pct)


def _decision_day(day: date, previous_day: date | None, cadence: str) -> bool:
    if previous_day is None:
        return True
    if cadence == "D":
        return True
    if cadence == "W":
        return day.isocalendar().week != previous_day.isocalendar().week or day.year != previous_day.year
    return day.month != previous_day.month or day.year != previous_day.year


def _passes_universe(symbol: str, universe: str) -> bool:
    domestic = symbol.endswith(".KS") or symbol.endswith(".KQ")
    if universe == "domestic":
        return domestic
    if universe == "overseas":
        return not domestic
    return True


def _bucket(age_days: int, target_upside: float, target_gap: float) -> tuple[str, str]:
    if age_days <= 120:
        return "fresh", f"최근 {age_days}일 리포트"
    if target_upside >= 0.5:
        return "large-upside", "목표 업사이드 50% 이상"
    if target_gap <= 0.2:
        return "near-target", "목표가 20% 이내"
    return "active", "미도달·미만료 활성 리포트"


def _board_score(candidate_score: float, tech: dict[str, float | bool | None]) -> float:
    score = candidate_score
    score += max(0.0, float(tech.get("ytd_return") or 0.0)) * 0.25
    score += max(0.0, float(tech.get("return_3m") or 0.0)) * 0.10
    score += max(0.0, float(tech.get("return_6m") or 0.0)) * 0.10
    score += max(0.0, float(tech.get("return_1y") or 0.0)) * 0.15
    high_gap = tech.get("distance_from_52w_high")
    if isinstance(high_gap, (int, float)) and high_gap >= -0.10:
        score += 0.10
    if tech.get("ma_stack") is True:
        score += 0.12
    elif (
        tech.get("above_20ma") is True and tech.get("above_50ma") is True and tech.get("above_200ma") is True
    ):
        score += 0.05
    if tech.get("ema_stack") is True:
        score += 0.10
    if tech.get("macd_bullish") is True:
        score += 0.08
    return score


def _ta_momentum_score(
    target_upside: float,
    current_return: float,
    target_gap: float,
    tech: dict[str, float | bool | None],
) -> float:
    score = 0.0
    score += _compressed_positive_return(tech.get("return_1m")) * 0.60
    score += _compressed_positive_return(tech.get("return_3m")) * 0.55
    score += _compressed_positive_return(tech.get("return_6m")) * 0.45
    score += _compressed_positive_return(tech.get("return_1y")) * 0.25
    score += _compressed_positive_return(tech.get("ytd_return")) * 0.20
    score += min(max(target_upside, 0.0), 2.0) * 0.20
    score += min(max(current_return, 0.0), 2.0) * 0.15

    high_gap = tech.get("distance_from_52w_high")
    if isinstance(high_gap, (int, float)):
        if high_gap >= -0.05:
            score += 0.20
        elif high_gap >= -0.10:
            score += 0.12
        elif high_gap >= -0.15:
            score += 0.06
    if tech.get("ma_stack") is True:
        score += 0.12
    if tech.get("ema_stack") is True:
        score += 0.12
    if tech.get("macd_bullish") is True:
        score += 0.15
    hist = tech.get("macd_hist")
    if isinstance(hist, (int, float)) and hist > 0:
        score += min(hist / 10_000.0, 0.05)
    if target_gap > 0:
        score -= min(target_gap, 1.0) * 0.20
    return score


def _compressed_positive_return(value: object) -> float:
    number = _number(value)
    if number is None:
        return 0.0
    return min(max(number, 0.0), 2.0)


def _technicals_asof(
    board: PriceBoard, symbol: str, as_of: date, current: float
) -> dict[str, float | bool | None]:
    if symbol not in board.close.columns:
        return {}
    series = board.close[symbol].loc[board.close.index <= pd.Timestamp(as_of)].dropna()
    if series.empty:
        return {}
    ytd = _return_since(series, pd.Timestamp(date(as_of.year, 1, 1)), current)
    ret_1m = _return_since(series, pd.Timestamp(as_of) - pd.Timedelta(days=30), current)
    ret_3m = _return_since(series, pd.Timestamp(as_of) - pd.Timedelta(days=90), current)
    ret_6m = _return_since(series, pd.Timestamp(as_of) - pd.Timedelta(days=180), current)
    ret_1y = _return_since(series, pd.Timestamp(as_of) - pd.Timedelta(days=365), current)
    one_year = series.loc[series.index >= pd.Timestamp(as_of) - pd.Timedelta(days=365)]
    high52 = float(one_year.max()) if not one_year.empty else None
    sma20 = _sma(series, 20)
    sma50 = _sma(series, 50)
    sma200 = _sma(series, 200)
    ema20 = _ema(series, 20)
    ema50 = _ema(series, 50)
    ema200 = _ema(series, 200)
    macd_line, macd_signal, macd_hist = _macd(series)
    if sma20 is None or sma50 is None or sma200 is None:
        ma_stack = None
    else:
        ma_stack = bool(current >= sma20 >= sma50 >= sma200)
    if ema20 is None or ema50 is None or ema200 is None:
        ema_stack = None
    else:
        ema_stack = bool(current >= ema20 >= ema50 >= ema200)
    macd_bullish = (
        None
        if macd_line is None or macd_signal is None or macd_hist is None
        else bool(macd_line >= macd_signal and macd_hist >= 0)
    )
    return {
        "ytd_return": ytd,
        "return_1m": ret_1m,
        "return_3m": ret_3m,
        "return_6m": ret_6m,
        "return_1y": ret_1y,
        "distance_from_52w_high": (current / high52 - 1.0) if high52 and high52 > 0 else None,
        "above_20ma": _above(current, sma20),
        "above_50ma": _above(current, sma50),
        "above_200ma": _above(current, sma200),
        "ma_stack": ma_stack,
        "ema_stack": ema_stack,
        "macd_line": macd_line,
        "macd_signal": macd_signal,
        "macd_hist": macd_hist,
        "macd_bullish": macd_bullish,
    }


def _return_since(series: pd.Series, start: pd.Timestamp, current: float) -> float | None:
    anchor_series = series.loc[series.index >= start]
    if anchor_series.empty:
        anchor_series = series.loc[series.index <= start]
    if anchor_series.empty:
        return None
    anchor = float(anchor_series.iloc[0])
    if anchor <= 0:
        return None
    return current / anchor - 1.0


def _sma(series: pd.Series, window: int) -> float | None:
    if len(series) < window:
        return None
    value = float(series.tail(window).mean())
    return value if np.isfinite(value) else None


def _ema(series: pd.Series, span: int) -> float | None:
    if len(series) < span:
        return None
    value = float(series.ewm(span=span, adjust=False, min_periods=span).mean().iloc[-1])
    return value if np.isfinite(value) else None


def _macd(series: pd.Series) -> tuple[float | None, float | None, float | None]:
    if len(series) < 35:
        return None, None, None
    fast = series.ewm(span=12, adjust=False, min_periods=12).mean()
    slow = series.ewm(span=26, adjust=False, min_periods=26).mean()
    line = fast - slow
    signal = line.ewm(span=9, adjust=False, min_periods=9).mean()
    hist = line - signal
    return _float_or_none(line.iloc[-1]), _float_or_none(signal.iloc[-1]), _float_or_none(hist.iloc[-1])


def _above(current: float, avg: float | None) -> bool | None:
    return None if avg is None else current >= avg


def _float_or_none(value: object) -> float | None:
    number = _number(value)
    if number is None:
        return None
    return float(number)


def _bool_or_none(value: object) -> bool | None:
    if value is None:
        return None
    return bool(value)


def _target_hit_asof(board: PriceBoard, symbol: str, start: date, end: date, target: float) -> bool:
    if board.close.empty:
        return False
    frame = board.high if board.high is not None else board.close
    if symbol not in frame.columns:
        return False
    series = (
        frame[symbol].loc[(frame.index > pd.Timestamp(start)) & (frame.index <= pd.Timestamp(end))].dropna()
    )
    return bool(not series.empty and float(series.max()) >= target)


def _price_date_asof(board: PriceBoard, as_of: date, symbol: str) -> date | None:
    return board.date_asof(as_of, symbol)


def _as_date(value: object) -> date | None:
    if isinstance(value, pd.Timestamp):
        return value.date()
    if isinstance(value, np.datetime64):
        return pd.Timestamp(value).date()
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if not isinstance(value, str):
        return None
    ts = pd.to_datetime(value, errors="coerce")
    if pd.isna(ts):
        return None
    return ts.date()


def _number(value: object) -> float | None:
    try:
        number = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return number
