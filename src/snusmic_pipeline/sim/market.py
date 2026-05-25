"""Market data adapter for the account simulation.

Two responsibilities:

1. **PriceBoard** ??wraps the KRW-converted ``daily_prices.csv`` warehouse
   table in a date-indexed wide pivot for fast ``(date, symbol) ??close``
   lookups. Adds asof helpers and a forward-window slice the prophet
   accounts need.

2. **Benchmark loader** ??downloads (and caches) the All-Weather basket's
   USD ETFs and KOSPI ETF in KRW, reusing the existing
   :mod:`snusmic_pipeline.market_data.currency` FX pipeline.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from ..market_data.currency import download_fx_rates
from .warehouse import (
    apply_daily_price_krw_conversion,
    download_history,
    read_table,
    write_table,
)

# ---------------------------------------------------------------------------
# PriceBoard ??fast lookups for the SNUSMIC report universe.
# ---------------------------------------------------------------------------


def _pivot_price(prices: pd.DataFrame, close: pd.DataFrame, column: str) -> pd.DataFrame:
    if column not in prices.columns:
        return close
    prices[column] = pd.to_numeric(prices[column], errors="coerce")
    return (
        prices.pivot_table(index="date", columns="symbol", values=column, aggfunc="last")
        .reindex(index=close.index, columns=close.columns)
        .fillna(close)
    )


@dataclass
class PriceBoard:
    """Date-indexed wide pivot of close prices in KRW.

    Build via :func:`PriceBoard.from_warehouse`. Empty boards are legal ??    callers must check ``board.is_empty`` before driving the engine.

    The public DataFrames remain available for compatibility. If callers edit
    or replace frames after construction, they must call :meth:`refresh` before
    using cached lookups again. Lookups deliberately avoid per-call mutation
    detection because this class sits on the simulation hot path.
    """

    close: pd.DataFrame  # index = pd.DatetimeIndex (UTC-naive midnight), columns = symbol
    open: pd.DataFrame  # may be the same as close if no opens were captured
    high: pd.DataFrame | None = None  # falls back to close when unavailable
    low: pd.DataFrame | None = None  # falls back to close when unavailable
    _close_on_cache: dict[date, dict[str, float]] = field(default_factory=dict, init=False, repr=False)
    _asof_cache: dict[tuple[date, str], float | None] = field(default_factory=dict, init=False, repr=False)
    _date_asof_cache: dict[tuple[date, str], date | None] = field(
        default_factory=dict, init=False, repr=False
    )
    _price_on_cache: dict[tuple[int, date, str], float | None] = field(
        default_factory=dict, init=False, repr=False
    )
    _dates_ns: np.ndarray = field(init=False, repr=False)
    _trading_dates: list[date] = field(init=False, repr=False)
    _symbols: list[str] = field(init=False, repr=False)
    _symbol_to_idx: dict[str, int] = field(init=False, repr=False)
    _date_to_idx: dict[date, int] = field(init=False, repr=False)
    _frame_arrays: dict[int, np.ndarray] = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self._normalize_ohlc_frames()
        self._rebuild_numpy_state()

    def _normalize_ohlc_frames(self) -> None:
        self.close = self._normalize_frame(self.close)
        self.open = self._normalize_frame(self.open).reindex(
            index=self.close.index, columns=self.close.columns
        )
        if self.high is not None:
            self.high = self._normalize_frame(self.high).reindex(
                index=self.close.index, columns=self.close.columns
            )
        if self.low is not None:
            self.low = self._normalize_frame(self.low).reindex(
                index=self.close.index, columns=self.close.columns
            )

    def refresh(self) -> None:
        """Normalize frames and rebuild NumPy lookup state after external edits."""
        self._normalize_ohlc_frames()
        self._close_on_cache.clear()
        self._asof_cache.clear()
        self._date_asof_cache.clear()
        self._price_on_cache.clear()
        self._rebuild_numpy_state()

    def clone(self) -> PriceBoard:
        """Return an independent lookup board over the same price values."""
        return PriceBoard(
            close=self.close.copy(deep=False),
            open=self.open.copy(deep=False),
            high=None if self.high is None else self.high.copy(deep=False),
            low=None if self.low is None else self.low.copy(deep=False),
        )

    def _rebuild_numpy_state(self) -> None:
        if self.close.empty:
            self._dates_ns = np.array([], dtype=np.int64)
            self._trading_dates = []
            self._symbols = []
            self._symbol_to_idx = {}
            self._date_to_idx = {}
            self._frame_arrays = {}
            return
        self._dates_ns = self.close.index.astype("datetime64[ns]").view("int64")
        self._trading_dates = [ts.date() for ts in self.close.index]
        self._symbols = [str(symbol) for symbol in self.close.columns]
        self._symbol_to_idx = {symbol: index for index, symbol in enumerate(self._symbols)}
        self._date_to_idx = {day: index for index, day in enumerate(self._trading_dates)}
        self._frame_arrays = {
            id(self.close): self.close.to_numpy(dtype=float, copy=False),
            id(self.open): self.open.to_numpy(dtype=float, copy=False),
        }
        if self.high is not None:
            self._frame_arrays[id(self.high)] = self.high.to_numpy(dtype=float, copy=False)
        if self.low is not None:
            self._frame_arrays[id(self.low)] = self.low.to_numpy(dtype=float, copy=False)

    @staticmethod
    def _normalize_frame(frame: pd.DataFrame) -> pd.DataFrame:
        if frame.empty:
            return frame.copy()
        out = frame.copy()
        out.index = pd.to_datetime(out.index).tz_localize(None)
        out.columns = [str(column) for column in out.columns]
        return out.apply(pd.to_numeric, errors="coerce").sort_index()

    @classmethod
    def from_warehouse(cls, warehouse_dir: Path) -> PriceBoard:
        prices = _read_price_board_frame(warehouse_dir)
        if prices.empty:
            return cls(close=pd.DataFrame(), open=pd.DataFrame())
        prices = prices.copy()
        prices["date"] = pd.to_datetime(prices["date"]).dt.tz_localize(None)
        prices["symbol"] = prices["symbol"].astype(str)
        prices["close"] = pd.to_numeric(prices["close"], errors="coerce")
        prices = prices.dropna(subset=["date", "symbol", "close"]).sort_values(["symbol", "date"])
        close = prices.pivot_table(
            index="date", columns="symbol", values="close", aggfunc="last"
        ).sort_index()
        open_pivot = _pivot_price(prices, close, "open")
        high_pivot = _pivot_price(prices, close, "high")
        low_pivot = _pivot_price(prices, close, "low")
        return cls(close=close, open=open_pivot, high=high_pivot, low=low_pivot)

    @property
    def is_empty(self) -> bool:
        return self.close.empty

    def trading_dates(self, start: date | None = None, end: date | None = None) -> list[date]:
        if self.close.empty:
            return []
        left = 0 if start is None else int(np.searchsorted(self._dates_ns, pd.Timestamp(start).value, "left"))
        right = (
            len(self._dates_ns)
            if end is None
            else int(np.searchsorted(self._dates_ns, pd.Timestamp(end).value, "right"))
        )
        return self._trading_dates[left:right]

    def close_on(self, day: date) -> dict[str, float]:
        """Closes available on ``day``. Symbols missing a close are omitted."""
        cached = self._close_on_cache.get(day)
        if cached is not None:
            return cached
        row_idx = self._date_to_idx.get(day)
        if row_idx is None:
            return {}
        values = self._frame_arrays[id(self.close)][row_idx]
        mask = np.isfinite(values) & (values > 0)
        closes = {
            symbol: float(values[col_idx])
            for col_idx, symbol in enumerate(self._symbols)
            if bool(mask[col_idx])
        }
        self._close_on_cache[day] = closes
        return closes

    def open_on(self, day: date) -> dict[str, float]:
        """Opens available on ``day``. Symbols missing an open are omitted."""
        row_idx = self._date_to_idx.get(day)
        if row_idx is None or self.open.empty:
            return {}
        values = self._frame_arrays[id(self.open)][row_idx]
        mask = np.isfinite(values) & (values > 0)
        return {
            symbol: float(values[col_idx])
            for col_idx, symbol in enumerate(self._symbols)
            if bool(mask[col_idx])
        }

    def asof(self, day: date, symbol: str) -> float | None:
        """Latest known close for ``symbol`` on or before ``day``."""
        key = (day, symbol)
        if key in self._asof_cache:
            return self._asof_cache[key]
        col_idx = self._symbol_to_idx.get(symbol)
        if col_idx is None:
            self._asof_cache[key] = None
            return None
        row_idx = int(np.searchsorted(self._dates_ns, pd.Timestamp(day).value, side="right") - 1)
        if row_idx < 0:
            self._asof_cache[key] = None
            return None
        values = self._frame_arrays[id(self.close)][: row_idx + 1, col_idx]
        valid = np.flatnonzero(np.isfinite(values) & (values > 0))
        if valid.size == 0:
            self._asof_cache[key] = None
            return None
        result = float(values[int(valid[-1])])
        self._asof_cache[key] = result
        return result

    def date_asof(self, day: date, symbol: str) -> date | None:
        """Date of the latest valid close for ``symbol`` on or before ``day``."""
        key = (day, symbol)
        if key in self._date_asof_cache:
            return self._date_asof_cache[key]
        col_idx = self._symbol_to_idx.get(symbol)
        if col_idx is None:
            self._date_asof_cache[key] = None
            return None
        row_idx = int(np.searchsorted(self._dates_ns, pd.Timestamp(day).value, side="right") - 1)
        if row_idx < 0:
            self._date_asof_cache[key] = None
            return None
        values = self._frame_arrays[id(self.close)][: row_idx + 1, col_idx]
        valid = np.flatnonzero(np.isfinite(values) & (values > 0))
        if valid.size:
            result = self._trading_dates[int(valid[-1])]
            self._date_asof_cache[key] = result
            return result
        self._date_asof_cache[key] = None
        return None

    def intraday_high_on(self, day: date, symbol: str) -> float | None:
        return self._price_on(day, symbol, self.high if self.high is not None else self.close)

    def intraday_low_on(self, day: date, symbol: str) -> float | None:
        return self._price_on(day, symbol, self.low if self.low is not None else self.close)

    def target_touched_on(self, day: date, symbol: str, threshold: float, direction: str = "upside") -> bool:
        """Return true when any OHLC range available for the day touches target.

        For upside targets, the day's high is enough. For downside targets, the
        day's low is enough. Missing high/low data falls back to close so older
        cached test fixtures keep the previous close-only behavior.
        """
        if direction == "downside":
            low = self.intraday_low_on(day, symbol)
            return low is not None and low <= threshold
        high = self.intraday_high_on(day, symbol)
        return high is not None and high >= threshold

    def _price_on(self, day: date, symbol: str, frame: pd.DataFrame) -> float | None:
        key = (id(frame), day, symbol)
        if key in self._price_on_cache:
            return self._price_on_cache[key]
        row_idx = self._date_to_idx.get(day)
        col_idx = self._symbol_to_idx.get(symbol)
        array = self._frame_arrays.get(id(frame))
        if row_idx is None or col_idx is None or array is None:
            self._price_on_cache[key] = None
            return None
        value = array[row_idx, col_idx]
        result = float(value) if np.isfinite(value) and float(value) > 0 else None
        self._price_on_cache[key] = result
        return result

    def first_close_on_or_after(self, start: date, end: date, symbol: str) -> float | None:
        values = self._window_values(self.close, start, end, symbol)
        if values is None:
            return None
        _, window = values
        finite = np.flatnonzero(np.isfinite(window))
        if finite.size == 0:
            return None
        first = float(window[int(finite[0])])
        return first if first > 0 else None

    def last_close_in_window(self, start: date, end: date, symbol: str) -> tuple[float | None, date | None]:
        values = self._window_values(self.close, start, end, symbol)
        if values is None:
            return None, None
        dates, window = values
        finite = np.flatnonzero(np.isfinite(window))
        if finite.size == 0:
            return None, None
        last_idx = int(finite[-1])
        last = float(window[last_idx])
        if last <= 0:
            return None, None
        return last, dates[last_idx]

    def max_close_in_window(self, start: date, end: date, symbol: str) -> float | None:
        return self._window_extreme(self.close, start, end, symbol, np.nanmax)

    def min_close_in_window(self, start: date, end: date, symbol: str) -> float | None:
        return self._window_extreme(self.close, start, end, symbol, np.nanmin)

    def first_touch_in_window(
        self,
        start: date,
        end: date,
        symbol: str,
        threshold: float,
        *,
        direction: str = "upside",
        include_start: bool = True,
    ) -> date | None:
        frame = self.low if direction == "downside" and self.low is not None else self.high
        if frame is None:
            frame = self.close
        values = self._window_values(frame, start, end, symbol, include_start=include_start)
        if values is None:
            return None
        dates, window = values
        valid = np.isfinite(window)
        touched = valid & (window <= threshold) if direction == "downside" else valid & (window >= threshold)
        indexes = np.flatnonzero(touched)
        return None if indexes.size == 0 else dates[int(indexes[0])]

    def _window_extreme(
        self,
        frame: pd.DataFrame,
        start: date,
        end: date,
        symbol: str,
        reducer,
    ) -> float | None:
        values = self._window_values(frame, start, end, symbol)
        if values is None:
            return None
        _, window = values
        finite = window[np.isfinite(window)]
        if finite.size == 0:
            return None
        return float(reducer(finite))

    def _window_values(
        self,
        frame: pd.DataFrame,
        start: date,
        end: date,
        symbol: str,
        *,
        include_start: bool = True,
    ) -> tuple[list[date], np.ndarray] | None:
        col_idx = self._symbol_to_idx.get(symbol)
        array = self._frame_arrays.get(id(frame))
        if self.close.empty or col_idx is None or array is None:
            return None
        left_side = "left" if include_start else "right"
        left = int(np.searchsorted(self._dates_ns, pd.Timestamp(start).value, left_side))
        right = int(np.searchsorted(self._dates_ns, pd.Timestamp(end).value, "right"))
        if left >= right:
            return None
        return self._trading_dates[left:right], array[left:right, col_idx]

    def returns_window(
        self,
        start: date,
        end: date,
        symbols: Iterable[str],
    ) -> pd.DataFrame:
        """Daily simple returns over ``[start, end]`` for ``symbols``.

        Symbols missing entirely from the window are dropped from the output;
        the caller decides what to do with the survivors.
        """
        if self.close.empty:
            return pd.DataFrame()
        ts_start = pd.Timestamp(start)
        ts_end = pd.Timestamp(end)
        cols = [s for s in symbols if s in self.close.columns]
        if not cols:
            return pd.DataFrame()
        slice_ = self.close.loc[(self.close.index >= ts_start) & (self.close.index <= ts_end), cols].copy()
        if slice_.empty or len(slice_) < 2:
            return pd.DataFrame()
        rets = slice_.pct_change().replace([np.inf, -np.inf], np.nan).dropna(how="all")
        return rets.dropna(axis=1, how="all")

    def cumulative_return(self, start: date, end: date, symbol: str) -> float | None:
        """Realised total return between ``start`` and ``end`` (inclusive close
        anchors). Returns ``None`` when either anchor lacks a close."""
        anchor_start = self.asof(start, symbol)
        anchor_end = self.asof(end, symbol)
        if anchor_start is None or anchor_end is None or anchor_start <= 0:
            return None
        return anchor_end / anchor_start - 1.0

    def peak_return_after(self, start: date, end: date, symbol: str) -> float | None:
        """Maximum close/start - 1 over ``(start, end]``.

        Used by the prophet to score "best realised path after publication".
        Returns ``None`` if no future closes exist in the window.
        """
        if self.close.empty or symbol not in self.close.columns:
            return None
        anchor = self.asof(start, symbol)
        if anchor is None or anchor <= 0:
            return None
        ts_start = pd.Timestamp(start)
        ts_end = pd.Timestamp(end)
        col = self.close[symbol]
        future = col.loc[(col.index > ts_start) & (col.index <= ts_end)].dropna()
        if future.empty:
            return None
        peak = float(future.max())
        return peak / anchor - 1.0

    def peak_date_after(self, start: date, end: date, symbol: str) -> date | None:
        if self.close.empty or symbol not in self.close.columns:
            return None
        ts_start = pd.Timestamp(start)
        ts_end = pd.Timestamp(end)
        col = self.close[symbol]
        future = col.loc[(col.index > ts_start) & (col.index <= ts_end)].dropna()
        if future.empty:
            return None
        return future.idxmax().date()


def _read_price_board_frame(warehouse_dir: Path) -> pd.DataFrame:
    """Read only the OHLC columns needed by ``PriceBoard``.

    ``warehouse.read_table`` validates every row with Pydantic, which is useful
    at schema boundaries but too expensive for repeated simulation reads. The
    simulation hot path only needs already-committed OHLC columns, so it uses a
    narrow typed CSV read and lets artifact/schema checks own full validation.
    """

    path = warehouse_dir / "daily_prices.csv"
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame()
    wanted = {"date", "symbol", "open", "high", "low", "close"}
    return pd.read_csv(
        path,
        usecols=lambda column: column in wanted,
        dtype={"date": "str", "symbol": "str"},
    )


# ---------------------------------------------------------------------------
# Benchmark loader (All-Weather basket).
# ---------------------------------------------------------------------------


_BENCHMARK_TABLE = "benchmark_prices"


def load_benchmark_prices(
    warehouse_dir: Path,
    symbols: Iterable[str],
    start: date,
    end: date,
    *,
    refresh: bool = False,
) -> PriceBoard:
    """Load KRW-converted closes for benchmark ETFs, downloading as needed.

    The result is cached at ``{warehouse_dir}/benchmark_prices.csv`` so
    repeated runs are network-free.
    """
    cached = read_table(warehouse_dir, _BENCHMARK_TABLE)
    needed = set(symbols)
    have = set(cached["symbol"].astype(str)) if not cached.empty else set()
    missing = needed - have
    stale = _stale_benchmark_symbols(cached, needed, start, end)
    refresh_symbols = needed if refresh else missing | stale
    if refresh_symbols:
        frames: list[pd.DataFrame] = []
        for symbol in sorted(refresh_symbols):
            history = download_history(
                symbol,
                datetime.combine(start, datetime.min.time(), tzinfo=UTC),
                datetime.combine(end + timedelta(days=1), datetime.min.time(), tzinfo=UTC),
            )
            if history.empty:
                continue
            history = history.copy()
            history["symbol"] = symbol
            frames.append(history)
        if frames:
            new_prices = pd.concat(frames, ignore_index=True)
            currencies = {_currency_for_benchmark_symbol(s) for s in refresh_symbols}
            fx = download_fx_rates(
                currencies,
                datetime.combine(start, datetime.min.time(), tzinfo=UTC),
                datetime.combine(end + timedelta(days=1), datetime.min.time(), tzinfo=UTC),
                download_history,
            )
            reports = pd.DataFrame(
                [{"symbol": s, "exchange": "KRX" if s.endswith(".KS") else "NYSE"} for s in refresh_symbols]
            )
            new_prices = apply_daily_price_krw_conversion(new_prices, reports, fx)
            if not cached.empty:
                cached = cached[~cached["symbol"].astype(str).isin([str(s) for s in refresh_symbols])]
                cached = pd.concat([cached, new_prices], ignore_index=True)
            else:
                cached = new_prices
            write_table(warehouse_dir, _BENCHMARK_TABLE, cached)
    remaining_stale = _stale_benchmark_symbols(cached, needed, start, end)
    remaining_missing = needed - (set(cached["symbol"].astype(str)) if not cached.empty else set())
    if remaining_missing or remaining_stale:
        problems = []
        if remaining_missing:
            problems.append(f"missing symbols={sorted(remaining_missing)}")
        if remaining_stale:
            problems.append(f"incomplete date coverage={sorted(remaining_stale)}")
        raise RuntimeError(
            f"Benchmark price cache cannot cover requested window {start}..{end}: {'; '.join(problems)}"
        )
    if cached.empty:
        return PriceBoard(close=pd.DataFrame(), open=pd.DataFrame())
    cached = cached.copy()
    cached["date"] = pd.to_datetime(cached["date"]).dt.tz_localize(None)
    cached["symbol"] = cached["symbol"].astype(str)
    cached["close"] = pd.to_numeric(cached["close"], errors="coerce")
    cached = cached.dropna(subset=["date", "symbol", "close"]).sort_values(["symbol", "date"])
    cached = cached[cached["symbol"].isin([str(s) for s in needed])]
    close = cached.pivot_table(index="date", columns="symbol", values="close", aggfunc="last").sort_index()
    if "open" in cached.columns:
        cached["open"] = pd.to_numeric(cached["open"], errors="coerce")
        open_pivot = (
            cached.pivot_table(index="date", columns="symbol", values="open", aggfunc="last")
            .reindex(index=close.index, columns=close.columns)
            .fillna(close)
        )
    else:
        open_pivot = close
    return PriceBoard(close=close, open=open_pivot)


def _stale_benchmark_symbols(cached: pd.DataFrame, symbols: set[str], start: date, end: date) -> set[str]:
    if cached.empty:
        return set(symbols)
    frame = cached.copy()
    frame["symbol"] = frame["symbol"].astype(str)
    frame["date"] = pd.to_datetime(frame["date"], errors="coerce").dt.date
    stale: set[str] = set()
    for symbol in symbols:
        dates = frame.loc[frame["symbol"] == symbol, "date"].dropna()
        if dates.empty:
            stale.add(symbol)
            continue
        if min(dates) > start or max(dates) < end:
            stale.add(symbol)
    return stale


def _currency_for_benchmark_symbol(symbol: str) -> str:
    """All-Weather defaults: yfinance ``.KS`` suffix ??KRW; otherwise USD."""
    return "KRW" if symbol.endswith(".KS") else "USD"
