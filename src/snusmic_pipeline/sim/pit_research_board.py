"""Point-in-time research board data.

The module builds as-of rows only. It does not select portfolios, promote
strategies, rebalance accounts, or run admission gates.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Literal

import numpy as np
import pandas as pd

from .market import PriceBoard

Universe = Literal["all", "domestic", "overseas"]
Cadence = Literal["D", "W", "M"]


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
    entry_price_source: str
    entry_price_scale_factor: float | None
    price_quality_flag: str
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

    def to_record(self, *, rank: int | None = None) -> dict[str, object]:
        return {
            "rank": rank,
            "as_of_date": self.as_of_date.isoformat(),
            "price_date": self.price_date.isoformat(),
            "report_id": self.report_id,
            "symbol": self.symbol,
            "company": self.company,
            "publication_date": self.publication_date.isoformat(),
            "report_age_days": self.report_age_days,
            "entry_price_krw": self.entry_price_krw,
            "entry_price_source": self.entry_price_source,
            "entry_price_scale_factor": self.entry_price_scale_factor,
            "price_quality_flag": self.price_quality_flag,
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


@dataclass
class PitResearchBoardCache:
    reports: pd.DataFrame
    board: PriceBoard
    _prepared_reports: pd.DataFrame = field(init=False, repr=False)
    _rows_by_key: dict[tuple[date, int, Universe], list[PitResearchBoardRow]] = field(
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
    _indicator_cache: _PitTechnicalIndicatorCache = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self._prepared_reports = _prepare_pit_reports(self.reports)
        self._indicator_cache = _PitTechnicalIndicatorCache(self.board)

    def rows(
        self,
        as_of: date,
        *,
        max_report_age_days: int,
        universe: Universe,
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

    def technicals(self, symbol: str, as_of: date, current: float) -> dict[str, float | bool | None]:
        key = (symbol, as_of)
        cached = self._technicals_by_key.get(key)
        if cached is None:
            cached = self._indicator_cache.technicals(symbol, as_of, current)
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


@dataclass
class _PitTechnicalIndicatorCache:
    board: PriceBoard
    _series_by_symbol: dict[str, pd.Series] = field(default_factory=dict, init=False, repr=False)
    _frames_by_symbol: dict[str, pd.DataFrame] = field(default_factory=dict, init=False, repr=False)

    def technicals(self, symbol: str, as_of: date, current: float) -> dict[str, float | bool | None]:
        series = self._series(symbol)
        if series is None or series.empty:
            return _empty_technicals()
        ts = pd.Timestamp(as_of)
        end_pos = int(series.index.searchsorted(ts, side="right") - 1)
        if end_pos < 0:
            return _empty_technicals()
        indicators = self._indicator_frame(symbol, series)
        row = indicators.iloc[end_pos]
        ytd = _return_since_position(series, pd.Timestamp(date(as_of.year, 1, 1)), current, end_pos)
        ret_1m = _return_since_position(series, ts - pd.Timedelta(days=30), current, end_pos)
        ret_3m = _return_since_position(series, ts - pd.Timedelta(days=90), current, end_pos)
        ret_6m = _return_since_position(series, ts - pd.Timedelta(days=180), current, end_pos)
        ret_1y = _return_since_position(series, ts - pd.Timedelta(days=365), current, end_pos)
        high52 = _float_or_none(row.get("high52"))
        sma20 = _float_or_none(row.get("sma20"))
        sma50 = _float_or_none(row.get("sma50"))
        sma200 = _float_or_none(row.get("sma200"))
        ema20 = _float_or_none(row.get("ema20"))
        ema50 = _float_or_none(row.get("ema50"))
        ema200 = _float_or_none(row.get("ema200"))
        macd_line = _float_or_none(row.get("macd_line"))
        macd_signal = _float_or_none(row.get("macd_signal"))
        macd_hist = _float_or_none(row.get("macd_hist"))
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
            "ma_stack": _stacked(current, sma20, sma50, sma200),
            "ema_stack": _stacked(current, ema20, ema50, ema200),
            "macd_line": macd_line,
            "macd_signal": macd_signal,
            "macd_hist": macd_hist,
            "macd_bullish": (
                None
                if macd_line is None or macd_signal is None or macd_hist is None
                else bool(macd_line >= macd_signal and macd_hist >= 0)
            ),
        }

    def _series(self, symbol: str) -> pd.Series | None:
        cached = self._series_by_symbol.get(symbol)
        if cached is not None:
            return cached
        if symbol not in self.board.close.columns:
            return None
        series = self.board.close[symbol].dropna().astype(float)
        self._series_by_symbol[symbol] = series
        return series

    def _indicator_frame(self, symbol: str, series: pd.Series) -> pd.DataFrame:
        cached = self._frames_by_symbol.get(symbol)
        if cached is not None:
            return cached
        frame = pd.DataFrame(index=series.index)
        frame["high52"] = series.rolling("365D", min_periods=1).max()
        frame["sma20"] = series.rolling(20, min_periods=20).mean()
        frame["sma50"] = series.rolling(50, min_periods=50).mean()
        frame["sma200"] = series.rolling(200, min_periods=200).mean()
        frame["ema20"] = series.ewm(span=20, adjust=False, min_periods=20).mean()
        frame["ema50"] = series.ewm(span=50, adjust=False, min_periods=50).mean()
        frame["ema200"] = series.ewm(span=200, adjust=False, min_periods=200).mean()
        fast = series.ewm(span=12, adjust=False, min_periods=12).mean()
        slow = series.ewm(span=26, adjust=False, min_periods=26).mean()
        frame["macd_line"] = fast - slow
        frame["macd_signal"] = frame["macd_line"].ewm(span=9, adjust=False, min_periods=9).mean()
        frame["macd_hist"] = frame["macd_line"] - frame["macd_signal"]
        self._frames_by_symbol[symbol] = frame
        return frame


@dataclass(frozen=True)
class _EntryPriceEstimate:
    value: float
    source: str
    scale_factor: float | None
    quality_flag: str


def build_pit_research_board(
    reports: pd.DataFrame,
    board: PriceBoard,
    as_of: date,
    *,
    max_report_age_days: int = 730,
    universe: Universe = "all",
    cache: PitResearchBoardCache | None = None,
) -> list[PitResearchBoardRow]:
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


def build_pit_research_board_snapshots(
    reports: pd.DataFrame,
    board: PriceBoard,
    trading_dates: list[date],
    *,
    cadence: Cadence = "M",
    max_report_age_days: int = 730,
    universe: Universe = "all",
) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    previous_day: date | None = None
    row_cache = PitResearchBoardCache(reports, board)
    for day in trading_dates:
        if not _decision_day(day, previous_day, cadence):
            previous_day = day
            continue
        rows = row_cache.rows(day, max_report_age_days=max_report_age_days, universe=universe)
        for rank, row in enumerate(rows, start=1):
            item = row.to_record(rank=rank)
            item["cadence"] = cadence
            item["universe"] = universe
            item["max_report_age_days"] = max_report_age_days
            records.append(item)
        previous_day = day
    return records


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
    universe: Universe,
    cache: PitResearchBoardCache | None,
) -> list[PitResearchBoardRow]:
    if prepared.empty or board.close.empty:
        return []
    current_reports = prepared[prepared["publication_date"] <= pd.Timestamp(as_of)]
    if current_reports.empty:
        return []
    latest = current_reports.groupby("symbol", as_index=False).tail(1)
    rows = [
        row
        for raw_record in latest.to_dict("records")
        if (
            row := _row_from_report(
                {str(key): value for key, value in raw_record.items()},
                board,
                as_of,
                max_report_age_days=max_report_age_days,
                universe=universe,
                cache=cache,
            )
        )
        is not None
    ]
    return sorted(
        rows, key=lambda row: (-row.board_score, -row.candidate_score, row.publication_date, row.symbol)
    )


def _row_from_report(
    record: dict[str, object],
    board: PriceBoard,
    as_of: date,
    *,
    max_report_age_days: int,
    universe: Universe,
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
    entry_estimate = _market_scale_entry_price(record, board, symbol, publication_date, as_of, target)
    if entry_estimate is None or entry_estimate.value <= 0:
        return None
    entry = entry_estimate.value
    target_upside = target / entry - 1.0
    if target_upside <= 0:
        return None
    age = (as_of - publication_date).days
    target_hit = (
        cache.target_hit(symbol, publication_date, as_of, target)
        if cache is not None
        else _target_hit_asof(board, symbol, publication_date, as_of, target)
    )
    current_return = current / entry - 1.0
    target_gap = current / target - 1.0
    tech = (
        cache.technicals(symbol, as_of, current)
        if cache is not None
        else _PitTechnicalIndicatorCache(board).technicals(symbol, as_of, current)
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
        entry_price_source=entry_estimate.source,
        entry_price_scale_factor=entry_estimate.scale_factor,
        price_quality_flag=entry_estimate.quality_flag,
        target_price_krw=float(target),
        last_close_krw=float(current),
        target_upside_at_pub=float(target_upside),
        current_return=float(current_return),
        target_gap_pct=float(target_gap),
        ytd_return=_float_or_none(tech.get("ytd_return")),
        return_1m=_float_or_none(tech.get("return_1m")),
        return_3m=_float_or_none(tech.get("return_3m")),
        return_6m=_float_or_none(tech.get("return_6m")),
        return_1y=_float_or_none(tech.get("return_1y")),
        distance_from_52w_high=_float_or_none(tech.get("distance_from_52w_high")),
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
        expired=age > max_report_age_days,
        bucket=bucket,
        rank_basis=rank_basis,
        candidate_score=round(float(candidate_score), 6),
        board_score=round(float(board_score), 6),
        ta_momentum_score=round(float(ta_momentum_score), 6),
    )


def _market_scale_entry_price(
    record: dict[str, object],
    board: PriceBoard,
    symbol: str,
    publication_date: date,
    end_date: date,
    target_price_krw: float,
) -> _EntryPriceEstimate | None:
    quoted_entry = _number(record.get("report_current_price_krw"))
    scale_factor = _number(record.get("target_price_scale_factor"))
    market_entry = board.first_close_on_or_after(publication_date, end_date, symbol) or board.asof(
        publication_date, symbol
    )
    if (
        quoted_entry is not None
        and quoted_entry > 0
        and scale_factor is not None
        and scale_factor > 0
        and not math.isclose(scale_factor, 1.0)
    ):
        return _EntryPriceEstimate(
            value=quoted_entry * scale_factor,
            source="scaled_report_quote",
            scale_factor=float(scale_factor),
            quality_flag="explicit_scale",
        )
    if quoted_entry is not None and quoted_entry > 0:
        inferred_scale = _entry_unit_scale_factor(quoted_entry, target_price_krw, market_entry)
        if inferred_scale is not None and market_entry is not None and market_entry > 0:
            return _EntryPriceEstimate(
                value=float(market_entry),
                source="market_price",
                scale_factor=float(inferred_scale),
                quality_flag="entry_unit_scaled",
            )
        return _EntryPriceEstimate(
            value=float(quoted_entry),
            source="report_quote",
            scale_factor=1.0,
            quality_flag="ok",
        )
    if market_entry is None or market_entry <= 0:
        return None
    return _EntryPriceEstimate(
        value=float(market_entry),
        source="market_price",
        scale_factor=None,
        quality_flag="market_entry",
    )


def _entry_unit_scale_factor(
    quoted_entry: float,
    target_price_krw: float,
    market_entry: float | None,
) -> float | None:
    if market_entry is None or market_entry <= 0 or quoted_entry <= 0:
        return None
    scale = market_entry / quoted_entry
    if 0.05 < scale < 20.0:
        return None
    target_multiple_on_quote = target_price_krw / quoted_entry if target_price_krw > 0 else None
    target_multiple_on_market = target_price_krw / market_entry if target_price_krw > 0 else None
    if target_multiple_on_quote is None or target_multiple_on_market is None:
        return scale
    if target_multiple_on_quote >= 10.0 and 0.2 <= target_multiple_on_market <= 10.0:
        return scale
    return None


def _decision_day(day: date, previous_day: date | None, cadence: Cadence) -> bool:
    if previous_day is None:
        return True
    if cadence == "D":
        return True
    if cadence == "W":
        return day.isocalendar().week != previous_day.isocalendar().week or day.year != previous_day.year
    return day.month != previous_day.month or day.year != previous_day.year


def _passes_universe(symbol: str, universe: Universe) -> bool:
    domestic = symbol.endswith(".KS") or symbol.endswith(".KQ")
    if universe == "domestic":
        return domestic
    if universe == "overseas":
        return not domestic
    return True


def _bucket(age_days: int, target_upside: float, target_gap: float) -> tuple[str, str]:
    if age_days <= 120:
        return "fresh", f"recent report ({age_days} days)"
    if target_upside >= 0.5:
        return "large-upside", "target upside >= 50%"
    if target_gap <= 0.2:
        return "near-target", "within 20% of target"
    return "active", "active report"


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
        score += (
            0.20 if high_gap >= -0.05 else 0.12 if high_gap >= -0.10 else 0.06 if high_gap >= -0.15 else 0
        )
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
    return 0.0 if number is None else min(max(number, 0.0), 2.0)


def _return_since_position(
    series: pd.Series,
    start: pd.Timestamp,
    current: float,
    end_pos: int,
) -> float | None:
    effective = series.iloc[: end_pos + 1]
    if effective.empty:
        return None
    start_pos = int(effective.index.searchsorted(start, side="left"))
    if start_pos >= len(effective):
        start_pos = int(effective.index.searchsorted(start, side="right") - 1)
    if start_pos < 0:
        return None
    anchor = float(effective.iloc[start_pos])
    if anchor <= 0:
        return None
    return current / anchor - 1.0


def _target_hit_asof(board: PriceBoard, symbol: str, start: date, end: date, target: float) -> bool:
    return (
        board.first_touch_in_window(
            start,
            end,
            symbol,
            target,
            include_start=False,
        )
        is not None
    )


def _price_date_asof(board: PriceBoard, as_of: date, symbol: str) -> date | None:
    return board.date_asof(as_of, symbol)


def _empty_technicals() -> dict[str, float | bool | None]:
    return {
        "ytd_return": None,
        "return_1m": None,
        "return_3m": None,
        "return_6m": None,
        "return_1y": None,
        "distance_from_52w_high": None,
        "above_20ma": None,
        "above_50ma": None,
        "above_200ma": None,
        "ma_stack": None,
        "ema_stack": None,
        "macd_line": None,
        "macd_signal": None,
        "macd_hist": None,
        "macd_bullish": None,
    }


def _stacked(current: float, fast: float | None, mid: float | None, slow: float | None) -> bool | None:
    if fast is None or mid is None or slow is None:
        return None
    return bool(current >= fast >= mid >= slow)


def _above(current: float, avg: float | None) -> bool | None:
    return None if avg is None else current >= avg


def _float_or_none(value: object) -> float | None:
    number = _number(value)
    return None if number is None else float(number)


def _bool_or_none(value: object) -> bool | None:
    if value is None:
        return None
    return bool(value)


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
