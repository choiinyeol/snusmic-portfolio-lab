"""학회 리포트 × 전략 연구 백테스트 v5.

변경사항 (v5):
- Task 1: 모든 시리즈 2019-07-01 시작 통일 (캘린더, 부의 시뮬, 벤치마크 모두)
- Task 2: 전체 거래 로그 + CSV 내보내기 (트리거 리포트 포함)
- Task 3: 추가 전략 변형 연구 (컨센서스 윈도우, 보유 기간, 목표가 청산, 업사이드 가중)
- Task 4: 오늘의 신호 (보유 중, 매도 임박, 매수 대기, 신규 신호)
"""

from __future__ import annotations

import csv
import datetime as dt
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PRICE_DIR = ROOT / "data" / "prices"
OUT_PATH = ROOT / "src" / "data" / "strategy-backtest.json"
CSV_PATH = ROOT / "public" / "strategy-trades.csv"

# Universe filter — also the sim start date
UNIVERSE_START = dt.date(2019, 7, 1)
SIM_START = UNIVERSE_START  # all series start here

# Common params
ATR_PERIOD = 42
MAX_POSITIONS = 20
POSITION_WEIGHT = 0.05
COST_PER_SIDE = 0.003
REGIME_MA = 200

# DCA params
DCA_INITIAL = 10_000_000
DCA_BASE_MONTHLY = 1_000_000
DCA_STEP = 1_000_000
DCA_STEP_MONTHS = 24

# In-sample / out-of-sample split
IS_END = dt.date(2023, 12, 31)
OOS_START = dt.date(2024, 1, 1)

# v3 headline params
HEADLINE_ATR_MULT = 4.0
HEADLINE_REGIME = False
MIN_DAYS_BEFORE_SIGNAL = 10
SIGNAL_WINDOW_DAYS = 180
RATCHET_THRESHOLD_1 = 0.30
RATCHET_THRESHOLD_2 = 1.00

# Consensus window variants (days; None = all-time)
CONSENSUS_WINDOWS = [90, 180, 365, None]

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


# ──────────────────────────────────────────────────────────────────────────────
# Data loading helpers
# ──────────────────────────────────────────────────────────────────────────────

def _fetch_index_yf(ticker: str, cache_name: str) -> pd.Series:
    """yfinance로 지수 종가 다운로드, data/prices에 캐시."""
    cache_path = PRICE_DIR / f"IDX_{cache_name}.csv"
    import yfinance as yf  # type: ignore

    today = dt.date.today()
    if cache_path.exists():
        df = pd.read_csv(cache_path, index_col=0, parse_dates=True)
        if not df.empty:
            last_date = df.index[-1].date()
            if last_date >= today - dt.timedelta(days=5):
                return df["close"].sort_index()
            start_upd = last_date + dt.timedelta(days=1)
            raw = yf.download(ticker, start=start_upd.isoformat(), progress=False, auto_adjust=True, threads=False)
            if not raw.empty:
                raw.index = pd.to_datetime(raw.index)
                if isinstance(raw.columns, pd.MultiIndex):
                    raw.columns = [c[0].lower() for c in raw.columns]
                else:
                    raw.columns = [c.lower() for c in raw.columns]
                if "close" in raw.columns:
                    new_rows = raw[["close"]].copy()
                    new_rows.index.name = "Date"
                    combined = pd.concat([df, new_rows])
                    combined = combined[~combined.index.duplicated(keep="last")]
                    combined.to_csv(cache_path)
                    return combined["close"].sort_index()
            return df["close"].sort_index()

    raw = yf.download(ticker, start="2007-01-01", progress=False, auto_adjust=True, threads=False)
    if raw.empty:
        raise RuntimeError(f"yfinance returned empty data for {ticker}")
    raw.index = pd.to_datetime(raw.index)
    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = [c[0].lower() for c in raw.columns]
    else:
        raw.columns = [c.lower() for c in raw.columns]
    out = raw[["close"]].copy()
    out.index.name = "Date"
    out.to_csv(cache_path)
    return out["close"].sort_index()


def load_kospi() -> pd.Series:
    path = PRICE_DIR / "IDX_KOSPI.csv"
    df = pd.read_csv(path, index_col=0, parse_dates=True).sort_index()
    return df["close"]


def load_sp500() -> pd.Series:
    path = PRICE_DIR / "IDX_US.csv"
    df = pd.read_csv(path, index_col=0, parse_dates=True).sort_index()
    return df["close"]


def load_nasdaq() -> pd.Series:
    path = PRICE_DIR / "IDX_NASDAQ.csv"
    if path.exists():
        df = pd.read_csv(path, index_col=0, parse_dates=True).sort_index()
        if not df.empty and "close" in df.columns:
            return df["close"]
    return _fetch_index_yf("^IXIC", "NASDAQ")


def load_gld() -> pd.Series:
    path = PRICE_DIR / "IDX_GLD.csv"
    if path.exists():
        df = pd.read_csv(path, index_col=0, parse_dates=True).sort_index()
        if not df.empty and "close" in df.columns:
            return df["close"]
    return _fetch_index_yf("GLD", "GLD")


def load_prices(ticker: str) -> pd.DataFrame | None:
    path = PRICE_DIR / f"KR_{ticker}.csv"
    if not path.exists():
        return None
    df = pd.read_csv(path, index_col=0, parse_dates=True).sort_index()
    if df.empty or "close" not in df:
        return None
    df = df[~df.index.duplicated(keep="last")]
    # Only keep rows from SIM_START onward (still need earlier rows for ATR warmup)
    prev_close = df["close"].shift(1)
    tr = pd.concat(
        [df["high"] - df["low"], (df["high"] - prev_close).abs(), (df["low"] - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    df["atr"] = tr.rolling(ATR_PERIOD, min_periods=ATR_PERIOD // 2).mean()
    ret = df["close"].pct_change()
    df["sharpe90"] = ret.rolling(90, min_periods=45).mean() / ret.rolling(90, min_periods=45).std() * math.sqrt(252)
    return df


def asof_value(series: pd.Series, day: dt.date) -> float:
    value = series.asof(pd.Timestamp(day))
    return float(value) if pd.notna(value) else 0.0


# ──────────────────────────────────────────────────────────────────────────────
# Consensus trigger resolution
# Build: ticker -> list of (report_date, school, source_file, target_price, display_name)
# For each trade entry, find the trigger reports that created the consensus.
# ──────────────────────────────────────────────────────────────────────────────

def build_ticker_reports(perf: pd.DataFrame) -> dict[str, list[dict]]:
    """
    Returns ticker -> sorted list of report dicts with keys:
      report_date, school, source_file, target_price, display_name, stated_upside_pct
    """
    result: dict[str, list[dict]] = {}
    for _, row in perf.iterrows():
        ticker = str(row["ticker"]).zfill(6)
        try:
            rdate = dt.date.fromisoformat(str(row["report_date"]))
        except ValueError:
            continue
        result.setdefault(ticker, []).append({
            "report_date": rdate,
            "school": str(row.get("school", "")),
            "source_file": str(row.get("source_file", "")),
            "target_price": float(row["target_price"]) if pd.notna(row.get("target_price")) else None,
            "display_name": str(row.get("display_name", ticker)),
            "stated_upside_pct": float(row["stated_upside_pct"]) if pd.notna(row.get("stated_upside_pct")) else None,
        })
    for t in result:
        result[t].sort(key=lambda x: x["report_date"])
    return result


def find_trigger_reports(
    ticker: str,
    entry_date: dt.date,
    ticker_reports: dict[str, list[dict]],
    consensus_window: int | None,
) -> list[dict]:
    """
    Returns the set of reports that formed the consensus at entry_date.
    consensus_window: if not None, only reports within window days before entry_date count.
    """
    reports = ticker_reports.get(ticker, [])
    # Reports that were published before entry_date
    past = [r for r in reports if r["report_date"] < entry_date]
    if not past:
        return []
    if consensus_window is not None:
        cutoff = entry_date - dt.timedelta(days=consensus_window)
        past = [r for r in past if r["report_date"] >= cutoff]
    # Group by school, keep latest report per school
    by_school: dict[str, dict] = {}
    for r in past:
        school = r["school"]
        if school not in by_school or r["report_date"] > by_school[school]["report_date"]:
            by_school[school] = r
    return list(by_school.values())


# ──────────────────────────────────────────────────────────────────────────────
# Strategy A/D: Immediate entry, fixed hold period
# ──────────────────────────────────────────────────────────────────────────────

def run_immediate_hold(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    hold_months: int,
    consensus_only: bool = False,
    label: str = "immediate",
    ticker_reports: dict[str, list[dict]] | None = None,
    consensus_window: int | None = None,
    upside_weighted: bool = False,
    target_exit: bool = False,
    record_full_trades: bool = False,
) -> dict:
    """
    진입: report_date 이후 첫 거래일 시가
    청산: 진입 후 hold_months개월 후 첫 거래일 시가 (또는 목표가 도달 시 조기 청산)
    포지션: 동일비중 5%, 최대 20종목
    consensus_only: True면 n_clubs >= 2만 진입
    consensus_window: None=all-time, else only reports within N days
    upside_weighted: stated_upside_pct 기반 비중 조정 (capped at 2x)
    target_exit: True면 목표가 도달 시 청산
    record_full_trades: True면 trigger_reports 포함 상세 거래 기록
    """
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []

    # Build entry queue with consensus window filter
    by_report_date: dict[dt.date, list[tuple[str, str, int]]] = {}
    if consensus_window is not None and ticker_reports is not None:
        # Re-derive n_clubs using the window
        ticker_schools_in_window: dict[str, set[str]] = {}
        for _, row_ticker, row_source, _ in reports:
            pass  # we'll compute below per entry date
        # Build: report_date -> list of (ticker, source, schools_in_window)
        # We need to compute at the time of each report
        all_report_dates = sorted({r[0] for r in reports})
        for rdate in all_report_dates:
            for r_rdate, r_ticker, r_source, _ in reports:
                if r_rdate != rdate:
                    continue
                # count schools within window up to rdate
                tr = ticker_reports.get(r_ticker, [])
                past = [x for x in tr if x["report_date"] <= rdate]
                window_start = rdate - dt.timedelta(days=consensus_window)
                in_window = [x for x in past if x["report_date"] >= window_start]
                schools_in_window = {x["school"] for x in in_window}
                n_clubs_window = len(schools_in_window)
                if consensus_only and n_clubs_window < 2:
                    continue
                by_report_date.setdefault(rdate, []).append((r_ticker, r_source, n_clubs_window))
    else:
        for rdate, ticker, source, n_clubs in reports:
            if consensus_only and n_clubs < 2:
                continue
            by_report_date.setdefault(rdate, []).append((ticker, source, n_clubs))

    def first_trading_day_after(target: dt.date) -> dt.date | None:
        for d in calendar:
            if d > target:
                return d
        return None

    def first_trading_day_on_or_after(target: dt.date) -> dt.date | None:
        for d in calendar:
            if d >= target:
                return d
        return None

    pending_entries: dict[dt.date, list[tuple[str, str, int]]] = {}
    scheduled_exits: dict[str, dt.date] = {}
    target_prices: dict[str, float] = {}

    for rdate, items in by_report_date.items():
        entry_day = first_trading_day_after(rdate)
        if entry_day:
            pending_entries.setdefault(entry_day, []).extend(items)

    for day in calendar:
        day_ts = pd.Timestamp(day)

        # Check target-price exits
        if target_exit:
            for ticker, pos in list(positions.items()):
                tp = target_prices.get(ticker)
                if tp is None:
                    continue
                df = prices[ticker]
                if day_ts in df.index:
                    high_today = float(df.loc[day_ts].get("high", df.loc[day_ts]["close"]))
                    if high_today >= tp and ticker not in scheduled_exits:
                        # Schedule for today's close
                        scheduled_exits[ticker] = day

        # Execute scheduled exits
        to_exit = [t for t, exit_d in list(scheduled_exits.items()) if exit_d <= day and t in positions]
        for ticker in to_exit:
            pos = positions.get(ticker)
            if pos is None:
                continue
            df = prices[ticker]
            q = df.loc[day_ts] if day_ts in df.index else None
            if q is None or float(q["open"]) <= 0:
                continue
            price = float(q["open"])
            proceeds = pos["shares"] * price * (1 - COST_PER_SIDE)
            cash += proceeds
            exit_reason = "목표가_도달" if target_exit and price >= (target_prices.get(ticker, 0)) else "12개월_만기"
            if day == calendar[-1]:
                exit_reason = "데이터_종료"
            trade: dict = {
                "ticker": ticker,
                "display_name": pos.get("display_name", ticker),
                "source": pos["source"],
                "n_clubs": pos["n_clubs"],
                "entry_date": pos["entry_date"].isoformat(),
                "exit_date": day.isoformat(),
                "entry": round(pos["entry_price"], 2),
                "exit": round(price, 2),
                "return_pct": round((proceeds / pos["cost"] - 1) * 100, 2),
                "days": (day - pos["entry_date"]).days,
                "exit_reason": exit_reason,
            }
            if record_full_trades and ticker_reports is not None:
                triggers = find_trigger_reports(ticker, pos["entry_date"], ticker_reports, consensus_window)
                trade["trigger_reports"] = [
                    {
                        "school": tr["school"],
                        "report_date": tr["report_date"].isoformat(),
                        "source_file": Path(tr["source_file"]).name,
                        "target_price": tr["target_price"],
                        "stated_upside_pct": tr["stated_upside_pct"],
                    }
                    for tr in triggers
                ]
                trade["trigger_schools"] = sorted({tr["school"] for tr in triggers})
                trade["trigger_target_prices"] = [tr["target_price"] for tr in triggers if tr["target_price"]]
            trades.append(trade)
            del positions[ticker]
            if ticker in scheduled_exits:
                del scheduled_exits[ticker]
            if ticker in target_prices:
                del target_prices[ticker]

        # Execute pending entries
        if day in pending_entries:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            slots = MAX_POSITIONS - len(positions)
            candidates = [(t, s, nc) for t, s, nc in pending_entries[day] if t not in positions]
            seen: set[str] = set()
            deduped = []
            for t, s, nc in candidates:
                if t not in seen:
                    seen.add(t)
                    deduped.append((t, s, nc))

            for ticker, source, n_clubs in deduped[:slots]:
                if ticker not in prices:
                    continue
                df = prices[ticker]
                if day_ts not in df.index:
                    continue
                q = df.loc[day_ts]
                if float(q["open"]) <= 0:
                    continue

                # Upside-weighted sizing
                weight = POSITION_WEIGHT
                if upside_weighted and ticker_reports is not None:
                    tr_list = ticker_reports.get(ticker, [])
                    past = [x for x in tr_list if x["report_date"] < day and x["stated_upside_pct"] is not None]
                    if past:
                        avg_upside = sum(x["stated_upside_pct"] for x in past) / len(past)
                        # Scale: base 30% upside = 1x, cap at 2x, floor at 0.5x
                        scale = max(0.5, min(2.0, avg_upside / 30.0))
                        weight = POSITION_WEIGHT * scale

                budget = min(nav_now * weight, cash)
                if budget < nav_now * POSITION_WEIGHT * 0.5:
                    continue
                price = float(q["open"])
                shares = budget * (1 - COST_PER_SIDE) / price
                cash -= budget

                # Get display_name and target_price from ticker_reports
                display_name = ticker
                tp = None
                if ticker_reports is not None:
                    tr_list = ticker_reports.get(ticker, [])
                    past_tr = [x for x in tr_list if x["report_date"] < day]
                    if past_tr:
                        latest = max(past_tr, key=lambda x: x["report_date"])
                        display_name = latest["display_name"]
                        # Use max target price among triggering reports
                        tps = [x["target_price"] for x in past_tr if x["target_price"]]
                        tp = max(tps) if tps else None

                positions[ticker] = {
                    "shares": shares,
                    "entry_price": price,
                    "entry_date": day,
                    "cost": budget,
                    "last_close": price,
                    "source": source,
                    "n_clubs": n_clubs,
                    "display_name": display_name,
                }
                if tp:
                    target_prices[ticker] = tp

                exit_target = dt.date(
                    day.year + (day.month - 1 + hold_months) // 12,
                    (day.month - 1 + hold_months) % 12 + 1,
                    min(day.day, 28),
                )
                exit_day = first_trading_day_on_or_after(exit_target)
                if exit_day:
                    scheduled_exits[ticker] = exit_day

        # Update last_close
        for ticker, pos in positions.items():
            df = prices[ticker]
            if day_ts in df.index:
                pos["last_close"] = float(df.loc[day_ts]["close"])

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    # Force-close remaining open positions at last price (data end)
    last_day = calendar[-1]
    for ticker, pos in list(positions.items()):
        trade: dict = {
            "ticker": ticker,
            "display_name": pos.get("display_name", ticker),
            "source": pos["source"],
            "n_clubs": pos["n_clubs"],
            "entry_date": pos["entry_date"].isoformat(),
            "exit_date": last_day.isoformat(),
            "entry": round(pos["entry_price"], 2),
            "exit": round(pos["last_close"], 2),
            "return_pct": round((pos["shares"] * pos["last_close"] / pos["cost"] - 1) * 100, 2),
            "days": (last_day - pos["entry_date"]).days,
            "exit_reason": "데이터_종료_미청산",
        }
        if record_full_trades and ticker_reports is not None:
            triggers = find_trigger_reports(ticker, pos["entry_date"], ticker_reports, consensus_window)
            trade["trigger_reports"] = [
                {
                    "school": tr["school"],
                    "report_date": tr["report_date"].isoformat(),
                    "source_file": Path(tr["source_file"]).name,
                    "target_price": tr["target_price"],
                    "stated_upside_pct": tr["stated_upside_pct"],
                }
                for tr in triggers
            ]
            trade["trigger_schools"] = sorted({tr["school"] for tr in triggers})
            trade["trigger_target_prices"] = [tr["target_price"] for tr in triggers if tr["target_price"]]
        trades.append(trade)

    return _compute_result(nav_series, trades, START_CAPITAL, label, open_positions=positions)


# ──────────────────────────────────────────────────────────────────────────────
# Strategy C: Equal-weight monthly rebalanced portfolio
# ──────────────────────────────────────────────────────────────────────────────

def run_equal_weight_monthly(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    label: str = "ew_monthly",
) -> dict:
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []

    ticker_rdates: dict[str, list[dt.date]] = {}
    for rdate, ticker, source, n_clubs in reports:
        ticker_rdates.setdefault(ticker, []).append(rdate)
    for t in ticker_rdates:
        ticker_rdates[t].sort()

    cal_series = pd.Series(calendar)
    month_ends: set[dt.date] = set(
        cal_series.groupby(cal_series.apply(lambda d: (d.year, d.month))).last().values
    )

    positions: dict[str, dict] = {}

    def active_tickers(as_of: dt.date) -> list[str]:
        result = []
        for t, rdates in ticker_rdates.items():
            past = [r for r in rdates if r <= as_of]
            if not past:
                continue
            latest = max(past)
            if (as_of - latest).days <= 365:
                result.append(t)
        return result

    for day in calendar:
        day_ts = pd.Timestamp(day)

        for ticker, pos in positions.items():
            df = prices.get(ticker)
            if df is not None and day_ts in df.index:
                pos["last_close"] = float(df.loc[day_ts]["close"])

        is_month_end = day in month_ends

        if is_month_end:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())

            for ticker, pos in list(positions.items()):
                df = prices.get(ticker)
                if df is None or day_ts not in df.index:
                    continue
                q = df.loc[day_ts]
                price = float(q["open"]) if float(q["open"]) > 0 else float(q["close"])
                proceeds = pos["shares"] * price * (1 - COST_PER_SIDE)
                cash += proceeds
                trades.append({
                    "ticker": ticker,
                    "display_name": ticker,
                    "source": "ew_monthly",
                    "n_clubs": 1,
                    "entry_date": pos["entry_date"].isoformat(),
                    "exit_date": day.isoformat(),
                    "entry": round(pos["entry_price"], 2),
                    "exit": round(price, 2),
                    "return_pct": round((proceeds / pos["cost"] - 1) * 100, 2),
                    "days": (day - pos["entry_date"]).days,
                    "exit_reason": "월말_리밸런싱",
                })
            positions = {}

            universe = [t for t in active_tickers(day) if t in prices]
            if universe:
                n = min(len(universe), MAX_POSITIONS * 4)
                per_position = nav_now / n
                for ticker in universe[:n]:
                    df = prices[ticker]
                    if day_ts not in df.index:
                        continue
                    q = df.loc[day_ts]
                    price = float(q["open"]) if float(q["open"]) > 0 else float(q["close"])
                    if price <= 0:
                        continue
                    budget = min(per_position, cash)
                    if budget <= 0:
                        continue
                    shares = budget * (1 - COST_PER_SIDE) / price
                    cash -= budget
                    positions[ticker] = {
                        "shares": shares,
                        "entry_price": price,
                        "entry_date": day,
                        "cost": budget,
                        "last_close": price,
                    }

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    return _compute_result(nav_series, trades, START_CAPITAL, label)


# ──────────────────────────────────────────────────────────────────────────────
# Strategy E: v3 breakout + ATR ratchet
# ──────────────────────────────────────────────────────────────────────────────

def find_signal(df: pd.DataFrame, report_date: dt.date) -> dt.date | None:
    window = df[df.index >= pd.Timestamp(report_date)]
    if len(window) <= MIN_DAYS_BEFORE_SIGNAL:
        return None
    closes = window["close"]
    running_max = closes.cummax().shift(1)
    cutoff = pd.Timestamp(report_date) + pd.Timedelta(days=SIGNAL_WINDOW_DAYS)
    for ts in closes.index[MIN_DAYS_BEFORE_SIGNAL:]:
        if ts > cutoff:
            return None
        if closes.loc[ts] > running_max.loc[ts]:
            return ts.date()
    return None


def load_regime() -> pd.Series | None:
    path = PRICE_DIR / "IDX_KOSPI.csv"
    if not path.exists():
        return None
    idx = pd.read_csv(path, index_col=0, parse_dates=True).sort_index()
    if idx.empty or "close" not in idx:
        return None
    ma = idx["close"].rolling(REGIME_MA, min_periods=REGIME_MA // 2).mean()
    return idx["close"] > ma


def run_breakout_backtest(
    prices: dict[str, pd.DataFrame],
    by_signal_date: dict[dt.date, list[tuple[str, str, int]]],
    calendar: list[dt.date],
    atr_mult: float,
    regime: pd.Series | None,
    use_ratchet: bool = True,
    label: str = "breakout",
) -> dict:
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    pending_buys: list[tuple[str, str, int]] = []
    pending_sells: list[str] = []

    def quote(ticker: str, day: dt.date) -> pd.Series | None:
        df = prices[ticker]
        ts = pd.Timestamp(day)
        return df.loc[ts] if ts in df.index else None

    def effective_atr_mult(pos: dict, atr_mult: float) -> float:
        if not use_ratchet:
            return atr_mult
        gain = pos["highest"] / pos["entry_price"] - 1
        if gain >= RATCHET_THRESHOLD_2:
            return atr_mult + 2
        if gain >= RATCHET_THRESHOLD_1:
            return atr_mult + 1
        return atr_mult

    for day in calendar:
        deferred_sells: list[str] = []
        for ticker in pending_sells:
            pos = positions.get(ticker)
            if not pos:
                continue
            q = quote(ticker, day)
            if q is None or q["open"] <= 0:
                deferred_sells.append(ticker)
                continue
            positions.pop(ticker)
            price = float(q["open"])
            proceeds = pos["shares"] * price * (1 - COST_PER_SIDE)
            cash += proceeds
            trades.append({
                "ticker": ticker,
                "display_name": ticker,
                "source": pos["source"],
                "n_clubs": pos["n_clubs"],
                "entry_date": pos["entry_date"].isoformat(),
                "exit_date": day.isoformat(),
                "entry": round(pos["entry_price"], 2),
                "exit": round(price, 2),
                "return_pct": round((proceeds / pos["cost"] - 1) * 100, 2),
                "days": (day - pos["entry_date"]).days,
                "exit_reason": "ATR_트레일링_스탑",
            })
        pending_sells = deferred_sells

        if pending_buys:
            signal_cutoff = day - dt.timedelta(days=1)
            regime_ok = True
            if regime is not None:
                value = regime.asof(pd.Timestamp(signal_cutoff))
                regime_ok = bool(value) if pd.notna(value) else False
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            slots = MAX_POSITIONS - len(positions)
            candidates = [(t, s, nc) for t, s, nc in pending_buys if t not in positions]
            if regime_ok and slots > 0 and candidates:
                ranked = sorted(
                    candidates,
                    key=lambda item: (
                        item[2] >= 2,
                        asof_value(prices[item[0]]["sharpe90"], signal_cutoff),
                    ),
                    reverse=True,
                )
                for ticker, source, n_clubs in ranked[:slots]:
                    q = quote(ticker, day)
                    if q is None or q["open"] <= 0:
                        continue
                    budget = min(nav_now * POSITION_WEIGHT, cash)
                    if budget < nav_now * POSITION_WEIGHT * 0.5:
                        continue
                    price = float(q["open"])
                    shares = budget * (1 - COST_PER_SIDE) / price
                    cash -= budget
                    atr = asof_value(prices[ticker]["atr"], signal_cutoff)
                    positions[ticker] = {
                        "shares": shares,
                        "entry_price": price,
                        "entry_date": day,
                        "cost": budget,
                        "highest": price,
                        "stop": price - atr_mult * atr if atr else price * 0.85,
                        "last_close": price,
                        "source": source,
                        "n_clubs": n_clubs,
                    }
        pending_buys = []

        for ticker, pos in positions.items():
            q = quote(ticker, day)
            if q is None:
                continue
            close = float(q["close"])
            pos["last_close"] = close
            pos["highest"] = max(pos["highest"], close)
            atr = asof_value(prices[ticker]["atr"], day)
            if atr:
                eff_mult = effective_atr_mult(pos, atr_mult)
                pos["stop"] = max(pos["stop"], pos["highest"] - eff_mult * atr)
            if close < pos["stop"] and ticker not in pending_sells:
                pending_sells.append(ticker)

        pending_buys = by_signal_date.get(day, [])

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    return _compute_result(nav_series, trades, START_CAPITAL, label, open_positions=positions)


# ──────────────────────────────────────────────────────────────────────────────
# Shared result computation
# ──────────────────────────────────────────────────────────────────────────────

def _compute_result(
    nav_series: list[tuple[str, float]],
    trades: list[dict],
    start_capital: float,
    label: str,
    open_positions: dict | None = None,
) -> dict:
    nav_df = pd.Series({pd.Timestamp(d): v for d, v in nav_series}).sort_index()
    daily_ret = nav_df.pct_change().dropna()
    total_return = nav_df.iloc[-1] / nav_df.iloc[0] - 1
    years = (nav_df.index[-1] - nav_df.index[0]).days / 365.25
    cagr = (nav_df.iloc[-1] / nav_df.iloc[0]) ** (1 / years) - 1 if years > 0 else None
    sharpe = float(daily_ret.mean() / daily_ret.std() * math.sqrt(252)) if daily_ret.std() else None
    mdd = float((nav_df / nav_df.cummax() - 1).min())
    # Only count fully-closed trades for win rate (exclude data_end open ones)
    closed_trades = [t for t in trades if not t.get("exit_reason", "").endswith("미청산")]
    wins = [t for t in closed_trades if t["return_pct"] > 0]

    is_mask = nav_df.index.date <= IS_END
    oos_mask = nav_df.index.date >= OOS_START

    def period_metrics(mask: pd.Series) -> dict:
        sub = nav_df[mask]
        if len(sub) < 2:
            return {}
        ret = sub.pct_change().dropna()
        _total = sub.iloc[-1] / sub.iloc[0] - 1
        _years = (sub.index[-1] - sub.index[0]).days / 365.25
        _cagr = (sub.iloc[-1] / sub.iloc[0]) ** (1 / _years) - 1 if _years > 0 else None
        _sharpe = float(ret.mean() / ret.std() * math.sqrt(252)) if ret.std() else None
        _mdd = float((sub / sub.cummax() - 1).min())
        return {
            "start": sub.index[0].date().isoformat(),
            "end": sub.index[-1].date().isoformat(),
            "total_return_pct": round(_total * 100, 2),
            "cagr_pct": round(_cagr * 100, 2) if _cagr is not None else None,
            "sharpe": round(_sharpe, 2) if _sharpe is not None else None,
            "mdd_pct": round(_mdd * 100, 2),
        }

    year_last = nav_df.resample("YE").last().dropna()
    yearly = year_last.pct_change()
    if len(year_last):
        yearly.iloc[0] = year_last.iloc[0] / nav_df.iloc[0] - 1
    yearly = (yearly * 100).round(2)

    equity_weekly = [
        {"date": ts.date().isoformat(), "nav": round(v / start_capital, 4)}
        for ts, v in nav_df.resample("W-FRI").last().dropna().items()
    ]

    result: dict = {
        "label": label,
        "metrics": {
            "start": nav_series[0][0],
            "end": nav_series[-1][0],
            "total_return_pct": round(total_return * 100, 2),
            "cagr_pct": round(cagr * 100, 2) if cagr is not None else None,
            "sharpe": round(sharpe, 2) if sharpe is not None else None,
            "mdd_pct": round(mdd * 100, 2),
            "trades": len(closed_trades),
            "win_rate_pct": round(len(wins) / len(closed_trades) * 100, 1) if closed_trades else None,
            "avg_hold_days": round(sum(t["days"] for t in closed_trades) / len(closed_trades), 1) if closed_trades else None,
        },
        "in_sample": period_metrics(is_mask),
        "out_of_sample": period_metrics(oos_mask),
        "yearly": [{"year": ts.year, "return_pct": float(v)} for ts, v in yearly.items()],
        "equity": equity_weekly,
        "trades": trades,
        "nav_df": nav_df,
    }
    if open_positions is not None:
        result["open_positions"] = open_positions
    return result


# ──────────────────────────────────────────────────────────────────────────────
# Benchmark computations
# ──────────────────────────────────────────────────────────────────────────────

def compute_all_weather(
    kospi: pd.Series,
    sp500: pd.Series,
    nasdaq: pd.Series,
    gld: pd.Series,
    start: dt.date,
    end: dt.date,
) -> pd.Series:
    idx = pd.date_range(start=pd.Timestamp(start), end=pd.Timestamp(end), freq="B")
    k = kospi.reindex(idx).ffill().bfill()
    s = sp500.reindex(idx).ffill().bfill()
    n = nasdaq.reindex(idx).ffill().bfill()
    g = gld.reindex(idx).ffill().bfill()

    k = k / k.iloc[0]
    s = s / s.iloc[0]
    n = n / n.iloc[0]
    g = g / g.iloc[0]

    weights = {"k": 0.25, "s": 0.25, "n": 0.25, "g": 0.25}
    units = {name: weights[name] for name in weights}
    prices_dict = {"k": k, "s": s, "n": n, "g": g}

    nav = pd.Series(index=idx, dtype=float)
    last_rebal_quarter: tuple[int, int] | None = None

    for ts in idx:
        p = {name: float(prices_dict[name].loc[ts]) for name in units}
        current_nav = sum(units[name] * p[name] for name in units)
        q = (ts.year, (ts.month - 1) // 3)
        if last_rebal_quarter != q:
            last_rebal_quarter = q
            for name in units:
                units[name] = weights[name] * current_nav / p[name]
        nav.loc[ts] = current_nav

    return nav.dropna()


def compute_wealth_simulation_multi(
    strategy_nav_df: pd.Series,
    benchmarks: dict[str, pd.Series],
    backtest_start: dt.date,
    backtest_end: dt.date,
) -> dict:
    strat_daily_ret = strategy_nav_df.pct_change().fillna(0)
    all_dates = strategy_nav_df.index

    _dates_series = pd.Series(all_dates.date, index=all_dates)
    monthly_dates = set(
        _dates_series.groupby(_dates_series.index.to_period("M")).first().values
    )

    strat_wealth = float(DCA_INITIAL)
    total_contributed = float(DCA_INITIAL)
    month_idx = 0
    series: list[dict] = []

    bench_units: dict[str, float] = {}
    bench_aligned: dict[str, pd.Series] = {}
    for name, idx_series in benchmarks.items():
        aligned = idx_series.reindex(all_dates).ffill().bfill()
        bench_aligned[name] = aligned
        bench_units[name] = DCA_INITIAL / float(aligned.iloc[0])

    for day in all_dates:
        day_date = day.date()
        is_month_first = day_date in monthly_dates

        if is_month_first and month_idx > 0:
            contribution = DCA_BASE_MONTHLY + DCA_STEP * (month_idx // DCA_STEP_MONTHS)
            total_contributed += contribution
            strat_wealth += contribution
            for name in bench_units:
                price_today = float(bench_aligned[name].loc[day])
                bench_units[name] += contribution / price_today

        if is_month_first:
            month_idx += 1

        sr = float(strat_daily_ret.loc[day])
        strat_wealth *= (1 + sr)

        bench_vals: dict[str, float] = {
            name: bench_units[name] * float(bench_aligned[name].loc[day])
            for name in bench_units
        }

        if is_month_first:
            entry: dict = {
                "month": month_idx - 1,
                "date": day_date.isoformat(),
                "contributed": round(total_contributed),
                "strategy_value": round(strat_wealth),
            }
            for name, val in bench_vals.items():
                entry[f"{name}_value"] = round(val)
            series.append(entry)

    final_strat = series[-1]["strategy_value"] if series else round(strat_wealth)
    final_contrib = series[-1]["contributed"] if series else round(total_contributed)

    def gain_pct(final: float) -> float | None:
        return round((final - final_contrib) / final_contrib * 100, 1) if final_contrib else None

    wealth_vals = pd.Series([s["strategy_value"] for s in series])
    sim_mdd = round(float((wealth_vals / wealth_vals.cummax() - 1).min()) * 100, 2) if len(wealth_vals) > 1 else 0.0

    bench_finals = {name: series[-1].get(f"{name}_value", 0) for name in benchmarks}

    return {
        "fx_assumption": (
            "미국 지수(NASDAQ, S&P500)와 GLD는 달러 기준 포인트 수익률을 원화 환산 없이 그대로 사용. "
            "실제 KRW/USD 환율 변동은 반영되지 않으므로 달러 강세 기간의 원화 환산 수익은 과소평가될 수 있습니다."
        ),
        "schedule_desc": (
            "초기 자본 1,000만원 + 월 적립 (0~23개월: 100만원, 24~47개월: 200만원, "
            "48~71개월: 300만원, …). 유휴 현금 이자 없음."
        ),
        "final_contributed": final_contrib,
        "final_strategy_value": final_strat,
        "final_benchmark_values": bench_finals,
        "strategy_gain_on_contributed_pct": gain_pct(final_strat),
        "benchmark_gain_on_contributed_pct": {name: gain_pct(v) for name, v in bench_finals.items()},
        "strategy_mdd_pct": sim_mdd,
        "series": series,
    }


def compute_tail_stats(trades: list[dict]) -> dict:
    closed = [t for t in trades if not t.get("exit_reason", "").endswith("미청산")]
    if not closed:
        return {}
    returns = sorted([t["return_pct"] for t in closed], reverse=True)
    n = len(returns)
    top10_n = max(1, math.ceil(n * 0.1))
    top_decile = returns[:top10_n]
    total_positive = sum(r for r in returns if r > 0)
    top_decile_positive = sum(r for r in top_decile if r > 0)
    top_decile_pnl_share = (top_decile_positive / total_positive * 100) if total_positive > 0 else 0
    doublers = [t for t in closed if t["return_pct"] >= 100]
    top_trades = sorted(closed, key=lambda t: t["return_pct"], reverse=True)[:top10_n]
    avg_hold_top = round(sum(t["days"] for t in top_trades) / len(top_trades), 1) if top_trades else None
    return {
        "total_trades": n,
        "top_decile_n": top10_n,
        "top_decile_pnl_share_pct": round(top_decile_pnl_share, 1),
        "top_decile_avg_return_pct": round(sum(top_decile) / len(top_decile), 1) if top_decile else None,
        "multibagger_count": len([t for t in closed if t["return_pct"] >= 400]),
        "doubler_count": len(doublers),
        "top_decile_avg_hold_days": avg_hold_top,
        "top10_trades": [
            {"ticker": t["ticker"], "display_name": t.get("display_name", t["ticker"]),
             "return_pct": t["return_pct"], "days": t["days"], "n_clubs": t.get("n_clubs", 1)}
            for t in sorted(closed, key=lambda t: t["return_pct"], reverse=True)[:10]
        ],
    }


def compute_consensus_stats(trades: list[dict]) -> dict:
    closed = [t for t in trades if not t.get("exit_reason", "").endswith("미청산")]
    if not closed:
        return {}
    single = [t for t in closed if t.get("n_clubs", 1) == 1]
    multi = [t for t in closed if t.get("n_clubs", 1) >= 2]

    def stats(group: list[dict]) -> dict:
        if not group:
            return {"count": 0, "avg_return_pct": None, "win_rate_pct": None, "median_return_pct": None}
        returns = [t["return_pct"] for t in group]
        wins = [r for r in returns if r > 0]
        rs = sorted(returns)
        n = len(rs)
        median = rs[n // 2] if n % 2 == 1 else (rs[n // 2 - 1] + rs[n // 2]) / 2
        return {
            "count": len(group),
            "avg_return_pct": round(sum(returns) / len(returns), 2),
            "win_rate_pct": round(len(wins) / len(returns) * 100, 1),
            "median_return_pct": round(median, 2),
        }

    s = stats(single)
    m = stats(multi)
    return {
        "single_club": s,
        "multi_club": m,
        "alpha_multi_vs_single": round((m["avg_return_pct"] or 0) - (s["avg_return_pct"] or 0), 2) if single and multi else None,
        "note": "≥2개 학회가 동시에 Buy 의견을 낸 종목이 단독 커버 종목 대비 더 높은 수익률을 보이는지 검증합니다.",
    }


# ──────────────────────────────────────────────────────────────────────────────
# Today's signals
# ──────────────────────────────────────────────────────────────────────────────

def compute_today_signals(
    perf: pd.DataFrame,
    prices: dict[str, pd.DataFrame],
    ticker_reports: dict[str, list[dict]],
    calendar: list[dt.date],
    headline_trades: list[dict],
    headline_label: str,
) -> dict:
    """
    as_of = 데이터 기준일 (마지막 거래일).
    헤드라인 전략(D) 규칙 기반:
    - 보유 중: 진입 후 12개월 이내
    - 매도 임박: 30일 이내 만기
    - 매수 대기: 1개 학회만 커버 (추가 학회 발간 시 매수 신호)
    - 신규 매수 신호: 컨센서스 형성 + 진입 시점이 최근 30일 이내
    """
    as_of = calendar[-1] if calendar else dt.date.today()
    as_of_ts = pd.Timestamp(as_of)

    # Open positions from headline trades
    open_positions: list[dict] = []
    expiring_soon: list[dict] = []
    new_signals: list[dict] = []
    watching: list[dict] = []

    # Track which tickers are "in position" per strategy rules
    # Re-derive from trade log: entry dates within last 12 months
    entry_map: dict[str, dict] = {}
    for t in headline_trades:
        if t.get("exit_reason", "").endswith("미청산"):
            ticker = t["ticker"]
            try:
                entry_date = dt.date.fromisoformat(t["entry_date"])
            except ValueError:
                continue
            months_held = (as_of - entry_date).days / 30.44
            if months_held < 12:
                entry_map[ticker] = t

    for ticker, trade in entry_map.items():
        entry_date = dt.date.fromisoformat(trade["entry_date"])
        exit_due = dt.date(
            entry_date.year + (entry_date.month - 1 + 12) // 12,
            (entry_date.month - 1 + 12) % 12 + 1,
            min(entry_date.day, 28),
        )
        days_elapsed = (as_of - entry_date).days
        days_remaining = (exit_due - as_of).days

        # Current price
        current_price = None
        if ticker in prices:
            df = prices[ticker]
            cv = df["close"].asof(as_of_ts)
            if pd.notna(cv):
                current_price = float(cv)

        entry_price = trade.get("entry", 0)
        unrealized_pct = round((current_price / entry_price - 1) * 100, 2) if current_price and entry_price else None

        pos_info = {
            "ticker": ticker,
            "display_name": trade.get("display_name", ticker),
            "entry_date": trade["entry_date"],
            "entry_price": entry_price,
            "current_price": current_price,
            "unrealized_pct": unrealized_pct,
            "days_elapsed": days_elapsed,
            "exit_due": exit_due.isoformat(),
            "days_remaining": days_remaining,
            "trigger_schools": trade.get("trigger_schools", []),
            "trigger_reports": trade.get("trigger_reports", []),
        }
        open_positions.append(pos_info)
        if 0 <= days_remaining <= 30:
            expiring_soon.append(pos_info)

    open_positions.sort(key=lambda x: x["days_remaining"])

    # Scan all tickers for new signals / watching
    all_tickers = set(ticker_reports.keys()) & set(prices.keys())
    already_in = set(entry_map.keys())

    for ticker in all_tickers:
        tr_list = ticker_reports.get(ticker, [])
        # Only reports with dates <= as_of
        past = [r for r in tr_list if r["report_date"] <= as_of]
        if not past:
            continue

        by_school: dict[str, dict] = {}
        for r in past:
            school = r["school"]
            if school not in by_school or r["report_date"] > by_school[school]["report_date"]:
                by_school[school] = r
        n_schools = len(by_school)

        if n_schools == 0:
            continue

        latest_report_date = max(r["report_date"] for r in past)
        latest_report = max(past, key=lambda x: x["report_date"])

        # Entry price basis = next open after latest_report_date
        def first_trading_day_after(target: dt.date) -> dt.date | None:
            for d in calendar:
                if d > target:
                    return d
            return None

        entry_basis_date = first_trading_day_after(latest_report_date)
        entry_basis_price = None
        if entry_basis_date and ticker in prices:
            df = prices[ticker]
            ts = pd.Timestamp(entry_basis_date)
            if ts in df.index:
                entry_basis_price = float(df.loc[ts]["open"])

        if n_schools == 1 and ticker not in already_in:
            # Single-club watching
            school_name = list(by_school.keys())[0]
            r = by_school[school_name]
            watching.append({
                "ticker": ticker,
                "display_name": r["display_name"],
                "covering_school": school_name,
                "latest_report_date": r["report_date"].isoformat(),
                "target_price": r["target_price"],
                "stated_upside_pct": r["stated_upside_pct"],
                "entry_basis_date": entry_basis_date.isoformat() if entry_basis_date else None,
                "entry_basis_price": round(entry_basis_price, 2) if entry_basis_price else None,
                "note": "추가 학회 발간 시 매수 신호",
            })

        elif n_schools >= 2 and ticker not in already_in:
            # Consensus formed — check if entry would have been within last 30 days
            if entry_basis_date and (as_of - entry_basis_date).days <= 30:
                trigger_list = list(by_school.values())
                new_signals.append({
                    "ticker": ticker,
                    "display_name": latest_report["display_name"],
                    "n_schools": n_schools,
                    "entry_basis_date": entry_basis_date.isoformat() if entry_basis_date else None,
                    "entry_basis_price": round(entry_basis_price, 2) if entry_basis_price else None,
                    "trigger_schools": sorted(by_school.keys()),
                    "trigger_reports": [
                        {
                            "school": r["school"],
                            "report_date": r["report_date"].isoformat(),
                            "target_price": r["target_price"],
                            "stated_upside_pct": r["stated_upside_pct"],
                        }
                        for r in trigger_list
                    ],
                })

    # Sort
    watching.sort(key=lambda x: x["latest_report_date"], reverse=True)
    new_signals.sort(key=lambda x: x["entry_basis_date"] or "", reverse=True)

    return {
        "as_of": as_of.isoformat(),
        "headline_strategy": headline_label,
        "disclaimer": "백테스트 규칙의 기계적 적용이며 투자 권유가 아닙니다. 과거 데이터 기반 시뮬레이션으로 미래 수익을 보장하지 않습니다.",
        "open_positions": open_positions,
        "expiring_soon": expiring_soon,
        "new_buy_signals": new_signals,
        "watching_single_club": watching[:30],  # cap at 30
        "counts": {
            "open": len(open_positions),
            "expiring_soon_30d": len(expiring_soon),
            "new_buy_signals": len(new_signals),
            "watching_single_club": len(watching),
        },
    }


# ──────────────────────────────────────────────────────────────────────────────
# CSV export
# ──────────────────────────────────────────────────────────────────────────────

def export_trades_csv(trades: list[dict], path: Path) -> None:
    """UTF-8 with BOM CSV for Korean Excel."""
    closed = [t for t in trades if not t.get("exit_reason", "").endswith("미청산")]
    closed_sorted = sorted(closed, key=lambda t: t["exit_date"], reverse=True)

    headers = [
        "매수일", "매수가(시가)", "종목명", "티커", "비중(%)", "커버학회수",
        "트리거학회", "리포트날짜들", "목표가들(원)", "매도일", "매도가", "보유일수",
        "수익률(%)", "매도사유",
    ]

    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        for t in closed_sorted:
            trigger_schools = "|".join(t.get("trigger_schools", [t.get("source", "")]))
            trigger_rdates = "|".join(
                r["report_date"] for r in t.get("trigger_reports", [])
            )
            target_prices = "|".join(
                str(int(tp)) for tp in t.get("trigger_target_prices", []) if tp
            )
            writer.writerow([
                t.get("entry_date", ""),
                t.get("entry", ""),
                t.get("display_name", t.get("ticker", "")),
                t.get("ticker", ""),
                round(POSITION_WEIGHT * 100, 1),
                t.get("n_clubs", 1),
                trigger_schools,
                trigger_rdates,
                target_prices,
                t.get("exit_date", ""),
                t.get("exit", ""),
                t.get("days", ""),
                t.get("return_pct", ""),
                t.get("exit_reason", ""),
            ])
    print(f"  CSV written: {path} ({len(closed_sorted)} rows)", flush=True)


# ──────────────────────────────────────────────────────────────────────────────
# main
# ──────────────────────────────────────────────────────────────────────────────

def main() -> int:
    print("Loading report data...", flush=True)
    perf = pd.read_csv(ROOT / "data" / "report_performance.csv", encoding="utf-8-sig")
    perf = perf[
        (perf["market"] == "KR")
        & perf["ticker"].notna()
        & perf["report_date"].notna()
        & (perf["rating_class"] == "buy")
        & (perf["report_date"] >= UNIVERSE_START.isoformat())
    ]
    perf["ticker"] = perf["ticker"].astype(str).str.zfill(6)
    print(f"  {len(perf)} buy reports from {perf.report_date.min()} to {perf.report_date.max()}", flush=True)

    # Build per-ticker report metadata (for trigger resolution and signals)
    ticker_reports = build_ticker_reports(perf)

    ticker_club_count: dict[str, int] = perf.groupby("ticker")["school"].nunique().to_dict()

    print("Loading stock prices...", flush=True)
    prices: dict[str, pd.DataFrame] = {}
    for _, row in perf.iterrows():
        ticker = row["ticker"]
        if ticker not in prices:
            df = load_prices(ticker)
            if df is not None:
                prices[ticker] = df

    reports: list[tuple[dt.date, str, str, int]] = []
    for _, row in perf.iterrows():
        ticker = row["ticker"]
        if ticker not in prices:
            continue
        try:
            rdate = dt.date.fromisoformat(str(row["report_date"]))
        except ValueError:
            continue
        n_clubs = ticker_club_count.get(ticker, 1)
        source = Path(str(row["source_file"])).name
        reports.append((rdate, ticker, source, n_clubs))
    reports.sort()
    print(f"  {len(reports)} reports with price data, {len({r[1] for r in reports})} unique tickers", flush=True)

    # ── TASK 1: Calendar clipped to SIM_START ────────────────────────────────
    raw_calendar = sorted({ts.date() for df in prices.values() for ts in df.index})
    calendar = [d for d in raw_calendar if d >= SIM_START]
    if not calendar:
        print("ERROR: no calendar dates after SIM_START", flush=True)
        return 1
    print(f"  Calendar (clipped): {calendar[0]} to {calendar[-1]}  (was {raw_calendar[0]})", flush=True)

    print("Loading benchmarks...", flush=True)
    kospi = load_kospi()
    sp500 = load_sp500()
    try:
        nasdaq = load_nasdaq()
        print(f"  NASDAQ: {nasdaq.index[0].date()} to {nasdaq.index[-1].date()}", flush=True)
    except Exception as e:
        print(f"  NASDAQ fetch failed: {e}, using S&P500 as proxy", flush=True)
        nasdaq = sp500.copy()
    try:
        gld = load_gld()
        print(f"  GLD: {gld.index[0].date()} to {gld.index[-1].date()}", flush=True)
    except Exception as e:
        print(f"  GLD fetch failed: {e}, using flat series as proxy", flush=True)
        gld = pd.Series(100.0, index=nasdaq.index)

    strat_start = calendar[0]
    strat_end = calendar[-1]
    all_weather = compute_all_weather(kospi, sp500, nasdaq, gld, strat_start, strat_end)
    print(f"  All-weather: {all_weather.index[0].date()} to {all_weather.index[-1].date()}", flush=True)

    # ── Strategy A: Immediate entry + 12mo hold (baseline)
    print("\nRunning Strategy A: Immediate 12mo hold (baseline)...", flush=True)
    result_a = run_immediate_hold(prices, reports, calendar, hold_months=12, consensus_only=False, label="A_immediate_12mo")
    print(f"  IS sharpe={result_a['in_sample'].get('sharpe')}  OOS sharpe={result_a['out_of_sample'].get('sharpe')}", flush=True)

    # ── Strategy B: Immediate entry + 18mo hold
    print("\nRunning Strategy B: Immediate 18mo hold...", flush=True)
    result_b = run_immediate_hold(prices, reports, calendar, hold_months=18, consensus_only=False, label="B_immediate_18mo")
    print(f"  IS sharpe={result_b['in_sample'].get('sharpe')}  OOS sharpe={result_b['out_of_sample'].get('sharpe')}", flush=True)

    # ── Strategy C: Equal-weight monthly rebalanced
    print("\nRunning Strategy C: Equal-weight monthly rebalanced...", flush=True)
    result_c = run_equal_weight_monthly(prices, reports, calendar, label="C_ew_monthly")
    print(f"  IS sharpe={result_c['in_sample'].get('sharpe')}  OOS sharpe={result_c['out_of_sample'].get('sharpe')}", flush=True)

    # ── Strategy D: Consensus only (≥2 clubs, all-time), 12mo hold  ← HEADLINE CANDIDATE
    print("\nRunning Strategy D: Consensus-only 12mo hold (all-time window)...", flush=True)
    result_d = run_immediate_hold(
        prices, reports, calendar,
        hold_months=12, consensus_only=True,
        label="D_consensus_12mo",
        ticker_reports=ticker_reports,
        consensus_window=None,
        record_full_trades=True,
    )
    print(f"  IS sharpe={result_d['in_sample'].get('sharpe')}  OOS sharpe={result_d['out_of_sample'].get('sharpe')}", flush=True)

    # ── Strategy E: v3 breakout + ATR ratchet
    print("\nBuilding breakout signals (Strategy E)...", flush=True)
    signals: list[tuple[dt.date, str, str, int]] = []
    for rdate, ticker, source, n_clubs in reports:
        signal = find_signal(prices[ticker], rdate)
        if signal:
            signals.append((signal, ticker, source, n_clubs))
    signals.sort()
    by_signal_date: dict[dt.date, list[tuple[str, str, int]]] = {}
    for date, ticker, source, n_clubs in signals:
        by_signal_date.setdefault(date, []).append((ticker, source, n_clubs))

    breakout_cal = [d for d in calendar if d >= min(s[0] for s in signals)] if signals else calendar
    regime = load_regime()
    print(f"  {len(signals)} signals ({len({s[1] for s in signals})} unique tickers)", flush=True)

    sensitivity: list[dict] = []
    headline_result_e: dict | None = None
    for atr_mult in (2.0, 3.0, 4.0, 5.0):
        for use_regime in (False, True):
            r = run_breakout_backtest(
                prices, by_signal_date, breakout_cal, atr_mult,
                regime if use_regime else None, use_ratchet=True,
                label=f"E_atr{atr_mult}_regime{'on' if use_regime else 'off'}"
            )
            entry = {
                "atr_mult": atr_mult, "regime_filter": use_regime,
                **r["metrics"],
                "is_sharpe": r["in_sample"].get("sharpe"), "is_cagr": r["in_sample"].get("cagr_pct"),
                "oos_sharpe": r["out_of_sample"].get("sharpe"), "oos_cagr": r["out_of_sample"].get("cagr_pct"),
            }
            sensitivity.append(entry)
            print(f"  E ATRx{atr_mult} regime={'on' if use_regime else 'off'}: IS-sharpe={entry['is_sharpe']} OOS-sharpe={entry['oos_sharpe']}", flush=True)
            if atr_mult == HEADLINE_ATR_MULT and use_regime == HEADLINE_REGIME:
                headline_result_e = r

    assert headline_result_e is not None
    result_e = headline_result_e
    result_e["label"] = "E_breakout_atr4"

    # ── TASK 3: Strategy variants (consensus window + hold + target exit + upside sizing)
    print("\nRunning strategy variants research (Task 3)...", flush=True)
    variants: list[dict] = []

    # D variants: consensus window
    for window in [90, 180, 365]:
        lbl = f"D_consensus_window{window}d"
        rv = run_immediate_hold(
            prices, reports, calendar,
            hold_months=12, consensus_only=True,
            label=lbl, ticker_reports=ticker_reports,
            consensus_window=window,
        )
        print(f"  {lbl}: IS sharpe={rv['in_sample'].get('sharpe')} OOS sharpe={rv['out_of_sample'].get('sharpe')}", flush=True)
        variants.append({"label": lbl, "metrics": rv["metrics"], "in_sample": rv.get("in_sample", {}), "out_of_sample": rv.get("out_of_sample", {})})

    # Hold period variants on D
    for hold in [6, 9, 18]:
        lbl = f"D_consensus_{hold}mo"
        rv = run_immediate_hold(
            prices, reports, calendar,
            hold_months=hold, consensus_only=True,
            label=lbl, ticker_reports=ticker_reports,
        )
        print(f"  {lbl}: IS sharpe={rv['in_sample'].get('sharpe')} OOS sharpe={rv['out_of_sample'].get('sharpe')}", flush=True)
        variants.append({"label": lbl, "metrics": rv["metrics"], "in_sample": rv.get("in_sample", {}), "out_of_sample": rv.get("out_of_sample", {})})

    # Target-price exit (12mo hold, sell on target hit)
    rv_target = run_immediate_hold(
        prices, reports, calendar,
        hold_months=12, consensus_only=True,
        label="D_consensus_target_exit", ticker_reports=ticker_reports,
        target_exit=True,
    )
    print(f"  D_consensus_target_exit: IS sharpe={rv_target['in_sample'].get('sharpe')} OOS sharpe={rv_target['out_of_sample'].get('sharpe')}", flush=True)
    variants.append({"label": "D_consensus_target_exit", "metrics": rv_target["metrics"], "in_sample": rv_target.get("in_sample", {}), "out_of_sample": rv_target.get("out_of_sample", {})})

    # Upside-weighted sizing
    rv_upside = run_immediate_hold(
        prices, reports, calendar,
        hold_months=12, consensus_only=True,
        label="D_consensus_upside_weighted", ticker_reports=ticker_reports,
        upside_weighted=True,
    )
    print(f"  D_consensus_upside_weighted: IS sharpe={rv_upside['in_sample'].get('sharpe')} OOS sharpe={rv_upside['out_of_sample'].get('sharpe')}", flush=True)
    variants.append({"label": "D_consensus_upside_weighted", "metrics": rv_upside["metrics"], "in_sample": rv_upside.get("in_sample", {}), "out_of_sample": rv_upside.get("out_of_sample", {})})

    # Determine if any variant beats D on both IS Sharpe AND OOS Sharpe
    d_is_sharpe = result_d.get("in_sample", {}).get("sharpe") or -999.0
    d_oos_sharpe = result_d.get("out_of_sample", {}).get("sharpe") or -999.0
    best_variant = None
    best_variant_reason = ""
    for v in variants:
        v_is = v.get("in_sample", {}).get("sharpe") or -999.0
        v_oos = v.get("out_of_sample", {}).get("sharpe") or -999.0
        if v_is > d_is_sharpe and v_oos > d_oos_sharpe:
            if best_variant is None or v_is > (best_variant.get("in_sample", {}).get("sharpe") or -999.0):
                best_variant = v
                best_variant_reason = f"IS sharpe {v_is:.2f} > D {d_is_sharpe:.2f}; OOS sharpe {v_oos:.2f} > D {d_oos_sharpe:.2f}"

    if best_variant:
        print(f"\n  NEW HEADLINE candidate: {best_variant['label']} — {best_variant_reason}", flush=True)
        variant_conclusion = f"변형 전략 {best_variant['label']}이 IS/OOS 모두에서 D를 상회함: {best_variant_reason}"
    else:
        print(f"\n  No variant beats D on both IS+OOS Sharpe. Keeping D as headline.", flush=True)
        variant_conclusion = (
            f"테스트한 모든 변형 전략이 인샘플과 아웃오브샘플 샤프 동시 초과에 실패. "
            f"D_consensus_12mo(all-time window) 유지. "
            f"IS sharpe={d_is_sharpe:.2f}, OOS sharpe={d_oos_sharpe:.2f}."
        )

    # ── Select headline strategy
    base_candidates = [result_a, result_b, result_c, result_d, result_e]

    def is_sharpe(r: dict) -> float:
        v = r.get("in_sample", {}).get("sharpe")
        return v if v is not None else -999.0

    headline = max(base_candidates, key=is_sharpe)
    headline_label = headline["label"]
    print(f"\nHeadline strategy (best IS sharpe): {headline_label}", flush=True)

    print("\n── Strategy summary ──────────────────────────────────────────────", flush=True)
    print(f"{'Strategy':<30} {'IS CAGR':>9} {'IS Sharpe':>10} {'OOS CAGR':>10} {'OOS Sharpe':>11}", flush=True)
    for r in base_candidates:
        is_m = r.get("in_sample", {})
        oos_m = r.get("out_of_sample", {})
        print(
            f"  {r['label']:<28} {str(is_m.get('cagr_pct', '—')):>9} {str(is_m.get('sharpe', '—')):>10} "
            f"{str(oos_m.get('cagr_pct', '—')):>10} {str(oos_m.get('sharpe', '—')):>11}",
            flush=True,
        )

    tail_stats = compute_tail_stats(headline.get("trades", []))
    consensus_stats = compute_consensus_stats(headline.get("trades", []))

    # ── Wealth simulation — uses headline nav
    print("\nComputing wealth simulations...", flush=True)
    headline_nav: pd.Series = headline["nav_df"]

    # Verify wealth sim starts at SIM_START
    sim_first_date = headline_nav.index[0].date()
    print(f"  Strategy nav starts: {sim_first_date} (expected >= {SIM_START})", flush=True)
    assert sim_first_date >= SIM_START, f"Wealth sim starts before SIM_START: {sim_first_date}"

    benchmarks_for_sim: dict[str, pd.Series] = {
        "KOSPI": kospi,
        "SP500": sp500,
        "NASDAQ": nasdaq,
        "AllWeather": all_weather,
    }
    wealth_sim = compute_wealth_simulation_multi(headline_nav, benchmarks_for_sim, strat_start, strat_end)

    print(f"  Wealth sim first date: {wealth_sim['series'][0]['date']} (must be >= {SIM_START})", flush=True)
    print(f"  Strategy final: {wealth_sim['final_strategy_value']:,}원", flush=True)
    for name, val in wealth_sim["final_benchmark_values"].items():
        gain = wealth_sim["benchmark_gain_on_contributed_pct"].get(name)
        print(f"  {name} final: {val:,}원 ({gain}%)", flush=True)

    # ── TASK 4: Today's signals
    print("\nComputing today's signals...", flush=True)
    today_signals = compute_today_signals(
        perf, prices, ticker_reports, calendar,
        headline.get("trades", []),
        headline_label,
    )
    print(f"  Open: {today_signals['counts']['open']}, "
          f"Expiring ≤30d: {today_signals['counts']['expiring_soon_30d']}, "
          f"New buy signals: {today_signals['counts']['new_buy_signals']}, "
          f"Watching (1-club): {today_signals['counts']['watching_single_club']}",
          flush=True)

    # ── TASK 2: Export CSV
    print("\nExporting trade CSV...", flush=True)
    export_trades_csv(headline.get("trades", []), CSV_PATH)

    # ── Research families
    research_families: list[dict] = []
    for r in base_candidates:
        research_families.append({
            "label": r["label"],
            "metrics": r["metrics"],
            "in_sample": r.get("in_sample", {}),
            "out_of_sample": r.get("out_of_sample", {}),
        })

    # ── Open positions list for display
    open_positions_list = []
    if "open_positions" in headline and isinstance(headline["open_positions"], dict):
        for t, p in headline["open_positions"].items():
            open_positions_list.append({
                "ticker": t,
                "display_name": p.get("display_name", t),
                "entry_date": p["entry_date"].isoformat() if hasattr(p.get("entry_date"), "isoformat") else str(p.get("entry_date", "")),
                "entry": round(p["entry_price"], 2),
                "last_close": round(p["last_close"], 2),
                "stop": round(p.get("stop", 0), 2),
                "return_pct": round((p["shares"] * p["last_close"] / p["cost"] - 1) * 100, 2),
                "source": p.get("source", ""),
                "n_clubs": p.get("n_clubs", 1),
            })

    # Headline trades: include only closed trades in JSON (open pos tracked separately)
    headline_trades_for_json = [
        t for t in headline.get("trades", [])
        if not t.get("exit_reason", "").endswith("미청산")
    ]

    payload = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "universe_filter": f"rating_class == buy AND report_date >= {UNIVERSE_START.isoformat()}",
        "params": {
            "universe_start": UNIVERSE_START.isoformat(),
            "sim_start": SIM_START.isoformat(),
            "is_period": f"{SIM_START.isoformat()} ~ {IS_END.isoformat()}",
            "oos_period": f"{OOS_START.isoformat()} ~ present",
            "atr_period": ATR_PERIOD,
            "max_positions": MAX_POSITIONS,
            "position_weight": POSITION_WEIGHT,
            "cost_per_side": COST_PER_SIDE,
            "headline_strategy": headline_label,
            "breakout": {
                "min_days_before_signal": MIN_DAYS_BEFORE_SIGNAL,
                "signal_window_days": SIGNAL_WINDOW_DAYS,
                "atr_mult": HEADLINE_ATR_MULT,
                "regime_filter": HEADLINE_REGIME,
                "ratchet_thresholds": [RATCHET_THRESHOLD_1, RATCHET_THRESHOLD_2],
            },
        },
        "metrics": headline["metrics"],
        "in_sample": headline.get("in_sample", {}),
        "out_of_sample": headline.get("out_of_sample", {}),
        "yearly": headline["yearly"],
        "equity": headline["equity"],
        "sensitivity": sensitivity,
        "research_families": research_families,
        "variant_research": {
            "variants": variants,
            "conclusion": variant_conclusion,
        },
        "tail_stats": tail_stats,
        "consensus_stats": consensus_stats,
        "wealth_sim": wealth_sim,
        "trades": headline_trades_for_json,
        "best_trades": sorted(headline_trades_for_json, key=lambda t: t["return_pct"], reverse=True)[:5],
        "worst_trades": sorted(headline_trades_for_json, key=lambda t: t["return_pct"])[:5],
        "open_positions": open_positions_list,
        "signals": today_signals,
    }

    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nWrote {OUT_PATH.relative_to(ROOT).as_posix()}", flush=True)
    print(f"  Wealth sim first date: {wealth_sim['series'][0]['date']}", flush=True)
    print(f"  Trades in JSON: {len(headline_trades_for_json)}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
