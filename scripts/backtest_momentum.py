"""학회 리포트 × 전략 연구 백테스트 v6.

변경사항 (v6):
- Task 1: US 종목 유니버스 추가 (US_{TICKER}.csv 로드, yfinance 캐시 패턴)
- Task 2: 종목 링크용 market 필드 trades에 포함
- Task 3: 5가지 신규 전략 (A~E + optional F):
    A. 12개월 보유 (헤드라인 기준선)
    B. 36개월 보유 (장기 호라이즌)
    C. 내러티브 홀드 (200MA 하방 + 진입가 하방 시 청산, Faber 2007)
    D. 샹들리에 래칫 (ATR(42)×5 트레일링)
    E. 목표가 절반 익절 + 러너 (C 규칙 트레일)
    F. 모멘텀 필터 진입 (200MA 위에서만 진입, C 청산)
  파라미터: 문헌 표준값 고정, 그리드 서치 없음
- Task 4: 전략별 CSV (strategy-trades-{key}.csv)
- 오늘의 신호: 헤드라인 전략 기준 유지
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
PUBLIC_DIR = ROOT / "public"

# Universe filter — reports from 2019-07 onwards feed the signal queue
UNIVERSE_START = dt.date(2019, 7, 1)
# Simulation starts 2020-01-01: report pool too thin before this date
SIM_START = dt.date(2020, 1, 1)

# Common params
ATR_PERIOD = 42
MAX_POSITIONS = 20
POSITION_WEIGHT = 0.05
COST_PER_SIDE = 0.003
REGIME_MA = 200

# Literature-grounded, fixed parameters (no grid search)
CHANDELIER_ATR_MULT = 5.0   # Chandelier Exit: ATR(42)×5 — wide, lets multibaggers breathe
MA200_MONTHLY_CHECK = True  # Faber (2007): check 200-day MA monthly

# DCA params
DCA_INITIAL = 10_000_000
DCA_BASE_MONTHLY = 1_000_000
DCA_STEP = 1_000_000
DCA_STEP_MONTHS = 24

# In-sample / out-of-sample split
IS_END = dt.date(2023, 12, 31)
OOS_START = dt.date(2024, 1, 1)

# v3 headline params (kept for breakout sensitivity)
HEADLINE_ATR_MULT = 4.0
HEADLINE_REGIME = False
MIN_DAYS_BEFORE_SIGNAL = 10
SIGNAL_WINDOW_DAYS = 180
RATCHET_THRESHOLD_1 = 0.30
RATCHET_THRESHOLD_2 = 1.00

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


def _fetch_us_stock_yf(ticker: str) -> bool:
    """US 주식 가격 yfinance로 다운로드 → data/prices/US_{ticker}.csv 저장."""
    import yfinance as yf  # type: ignore
    cache_path = PRICE_DIR / f"US_{ticker}.csv"
    print(f"  Fetching US/{ticker} via yfinance...", flush=True)
    try:
        raw = yf.download(ticker, start="2007-01-01", progress=False, auto_adjust=True, threads=False)
        if raw.empty:
            print(f"    WARNING: empty data for {ticker}", flush=True)
            return False
        raw.index = pd.to_datetime(raw.index)
        if isinstance(raw.columns, pd.MultiIndex):
            raw.columns = [c[0].lower() for c in raw.columns]
        else:
            raw.columns = [c.lower() for c in raw.columns]
        needed = [c for c in ["open", "high", "low", "close", "volume"] if c in raw.columns]
        out = raw[needed].copy()
        out.index.name = "Date"
        out.to_csv(cache_path)
        print(f"    Saved {cache_path.name} ({len(out)} rows)", flush=True)
        return True
    except Exception as e:
        print(f"    ERROR fetching {ticker}: {e}", flush=True)
        return False


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


def load_prices(ticker: str, market: str = "KR") -> pd.DataFrame | None:
    """주가 데이터 로드. market='KR' → KR_{ticker}.csv, market='US' → US_{ticker}.csv"""
    if market == "US":
        path = PRICE_DIR / f"US_{ticker}.csv"
    else:
        path = PRICE_DIR / f"KR_{ticker}.csv"

    if not path.exists():
        return None
    try:
        df = pd.read_csv(path, index_col=0, parse_dates=True).sort_index()
    except Exception:
        return None
    if df.empty or "close" not in df:
        return None
    # KR CSVs may use Korean 날짜 header — already handled by index_col=0
    df = df[~df.index.duplicated(keep="last")]

    # Ensure required columns exist
    for col in ["open", "high", "low", "close"]:
        if col not in df.columns:
            return None

    prev_close = df["close"].shift(1)
    tr = pd.concat(
        [df["high"] - df["low"], (df["high"] - prev_close).abs(), (df["low"] - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    df["atr"] = tr.rolling(ATR_PERIOD, min_periods=ATR_PERIOD // 2).mean()
    ret = df["close"].pct_change()
    df["sharpe90"] = ret.rolling(90, min_periods=45).mean() / ret.rolling(90, min_periods=45).std() * math.sqrt(252)
    # 200-day MA for narrative hold and momentum filter
    df["ma200"] = df["close"].rolling(200, min_periods=100).mean()
    return df


def asof_value(series: pd.Series, day: dt.date) -> float:
    value = series.asof(pd.Timestamp(day))
    return float(value) if pd.notna(value) else 0.0


# ──────────────────────────────────────────────────────────────────────────────
# Consensus trigger resolution
# ──────────────────────────────────────────────────────────────────────────────

def build_ticker_reports(perf: pd.DataFrame) -> dict[str, list[dict]]:
    """
    Returns ticker_key -> sorted list of report dicts.
    ticker_key = "KR_{6-digit}" or "US_{TICKER}"
    """
    result: dict[str, list[dict]] = {}
    for _, row in perf.iterrows():
        market = str(row.get("market", "KR"))
        raw_ticker = str(row["ticker"])
        if market == "KR":
            ticker_key = raw_ticker.zfill(6)
        else:
            ticker_key = raw_ticker  # US tickers as-is
        try:
            rdate = dt.date.fromisoformat(str(row["report_date"]))
        except ValueError:
            continue
        result.setdefault(ticker_key, []).append({
            "report_date": rdate,
            "school": str(row.get("school", "")),
            "source_file": str(row.get("source_file", "")),
            "target_price": float(row["target_price"]) if pd.notna(row.get("target_price")) else None,
            "display_name": str(row.get("display_name", ticker_key)),
            "stated_upside_pct": float(row["stated_upside_pct"]) if pd.notna(row.get("stated_upside_pct")) else None,
            "market": market,
        })
    for t in result:
        result[t].sort(key=lambda x: x["report_date"])
    return result


def find_trigger_reports(
    ticker_key: str,
    entry_date: dt.date,
    ticker_reports: dict[str, list[dict]],
    consensus_window: int | None,
) -> list[dict]:
    reports = ticker_reports.get(ticker_key, [])
    past = [r for r in reports if r["report_date"] < entry_date]
    if not past:
        return []
    if consensus_window is not None:
        cutoff = entry_date - dt.timedelta(days=consensus_window)
        past = [r for r in past if r["report_date"] >= cutoff]
    by_school: dict[str, dict] = {}
    for r in past:
        school = r["school"]
        if school not in by_school or r["report_date"] > by_school[school]["report_date"]:
            by_school[school] = r
    return list(by_school.values())


# ──────────────────────────────────────────────────────────────────────────────
# Shared helpers
# ──────────────────────────────────────────────────────────────────────────────

def first_trading_day_after(target: dt.date, calendar: list[dt.date]) -> dt.date | None:
    for d in calendar:
        if d > target:
            return d
    return None


def first_trading_day_on_or_after(target: dt.date, calendar: list[dt.date]) -> dt.date | None:
    for d in calendar:
        if d >= target:
            return d
    return None


def months_later(base: dt.date, n: int) -> dt.date:
    m = base.month - 1 + n
    return dt.date(base.year + m // 12, m % 12 + 1, min(base.day, 28))


def _get_quote(prices: dict[str, pd.DataFrame], ticker: str, day: dt.date) -> pd.Series | None:
    df = prices.get(ticker)
    if df is None:
        return None
    ts = pd.Timestamp(day)
    return df.loc[ts] if ts in df.index else None


def _last_month_open(day: dt.date, calendar: list[dt.date]) -> dt.date | None:
    """Return the first trading day of the current month (for monthly MA check)."""
    target = dt.date(day.year, day.month, 1)
    return first_trading_day_on_or_after(target, calendar)


# ──────────────────────────────────────────────────────────────────────────────
# Common entry-queue builder for consensus strategies
# ──────────────────────────────────────────────────────────────────────────────

def build_pending_entries(
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    consensus_only: bool,
) -> dict[dt.date, list[tuple[str, str, int]]]:
    """Returns entry_day -> [(ticker_key, source, n_clubs)]"""
    by_report_date: dict[dt.date, list[tuple[str, str, int]]] = {}
    for rdate, ticker, source, n_clubs in reports:
        if consensus_only and n_clubs < 2:
            continue
        by_report_date.setdefault(rdate, []).append((ticker, source, n_clubs))

    pending: dict[dt.date, list[tuple[str, str, int]]] = {}
    for rdate, items in by_report_date.items():
        entry_day = first_trading_day_after(rdate, calendar)
        if entry_day:
            pending.setdefault(entry_day, []).extend(items)
    return pending


def _try_enter(
    ticker: str,
    source: str,
    n_clubs: int,
    day: dt.date,
    prices: dict[str, pd.DataFrame],
    positions: dict[str, dict],
    cash: float,
    nav_now: float,
    ticker_reports: dict[str, list[dict]] | None,
    weight: float = POSITION_WEIGHT,
    momentum_filter: bool = False,
) -> tuple[dict | None, float]:
    """
    Try to enter a position. Returns (position_dict, new_cash) or (None, cash).
    momentum_filter=True: only enter if close > 200MA.
    """
    if ticker in positions:
        return None, cash
    df = prices.get(ticker)
    if df is None:
        return None, cash
    day_ts = pd.Timestamp(day)
    if day_ts not in df.index:
        return None, cash
    q = df.loc[day_ts]
    entry_price = float(q["open"])
    if entry_price <= 0:
        return None, cash

    # Momentum filter: price > 200MA at entry
    if momentum_filter:
        ma200_val = asof_value(df["ma200"], day)
        if ma200_val <= 0 or entry_price < ma200_val:
            return None, cash

    budget = min(nav_now * weight, cash)
    if budget < nav_now * POSITION_WEIGHT * 0.5:
        return None, cash

    shares = budget * (1 - COST_PER_SIDE) / entry_price
    cash -= budget

    display_name = ticker
    tp = None
    if ticker_reports is not None:
        tr_list = ticker_reports.get(ticker, [])
        past_tr = [x for x in tr_list if x["report_date"] < day]
        if past_tr:
            latest = max(past_tr, key=lambda x: x["report_date"])
            display_name = latest["display_name"]
            tps = [x["target_price"] for x in past_tr if x["target_price"]]
            tp = max(tps) if tps else None
    # market from ticker_reports
    market = "KR"
    if ticker_reports is not None:
        tr_list = ticker_reports.get(ticker, [])
        if tr_list:
            market = tr_list[0].get("market", "KR")

    pos = {
        "shares": shares,
        "entry_price": entry_price,
        "entry_date": day,
        "cost": budget,
        "last_close": entry_price,
        "highest": entry_price,
        "source": source,
        "n_clubs": n_clubs,
        "display_name": display_name,
        "market": market,
        "target_price": tp,
        # For chandelier
        "stop": None,
        # For narrative hold (C rule): track if below_ma200_and_entry last month
        "ma200_exit_triggered": False,
        # For half-exit (E): whether half already sold
        "half_sold": False,
        "half_sell_price": None,
    }
    return pos, cash


def _close_trade(
    ticker: str,
    pos: dict,
    exit_date: dt.date,
    exit_price: float,
    exit_reason: str,
    ticker_reports: dict[str, list[dict]] | None,
    record_full_trades: bool,
    consensus_window: int | None,
    shares_override: float | None = None,
    cost_override: float | None = None,
) -> dict:
    shares = shares_override if shares_override is not None else pos["shares"]
    cost = cost_override if cost_override is not None else pos["cost"]
    proceeds = shares * exit_price * (1 - COST_PER_SIDE)
    trade: dict = {
        "ticker": ticker,
        "market": pos.get("market", "KR"),
        "display_name": pos.get("display_name", ticker),
        "source": pos["source"],
        "n_clubs": pos["n_clubs"],
        "entry_date": pos["entry_date"].isoformat(),
        "exit_date": exit_date.isoformat(),
        "entry": round(pos["entry_price"], 4),
        "exit": round(exit_price, 4),
        "return_pct": round((proceeds / cost - 1) * 100, 2),
        "days": (exit_date - pos["entry_date"]).days,
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
    return trade


# ──────────────────────────────────────────────────────────────────────────────
# Strategy A/B: Immediate entry, fixed hold period
# ──────────────────────────────────────────────────────────────────────────────

def run_fixed_hold(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    hold_months: int,
    label: str,
    ticker_reports: dict[str, list[dict]] | None = None,
    record_full_trades: bool = False,
) -> dict:
    """Immediate entry, sell after hold_months. Consensus ≥2 only."""
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    scheduled_exits: dict[str, dt.date] = {}

    pending_entries = build_pending_entries(reports, calendar, consensus_only=True)

    for day in calendar:
        day_ts = pd.Timestamp(day)

        # Execute scheduled exits
        to_exit = [t for t, d in list(scheduled_exits.items()) if d <= day and t in positions]
        for ticker in to_exit:
            pos = positions[ticker]
            q = _get_quote(prices, ticker, day)
            if q is None or float(q["open"]) <= 0:
                continue
            exit_price = float(q["open"])
            cash += pos["shares"] * exit_price * (1 - COST_PER_SIDE)
            trades.append(_close_trade(ticker, pos, day, exit_price, f"{hold_months}개월_만기",
                                       ticker_reports, record_full_trades, None))
            del positions[ticker]
            del scheduled_exits[ticker]

        # Execute pending entries
        if day in pending_entries:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            slots = MAX_POSITIONS - len(positions)
            candidates = list({t: (t, s, nc) for t, s, nc in pending_entries[day] if t not in positions}.values())
            for ticker, source, n_clubs in candidates[:slots]:
                pos, cash = _try_enter(ticker, source, n_clubs, day, prices, positions, cash, nav_now, ticker_reports)
                if pos is not None:
                    positions[ticker] = pos
                    exit_target = months_later(day, hold_months)
                    exit_day = first_trading_day_on_or_after(exit_target, calendar)
                    if exit_day:
                        scheduled_exits[ticker] = exit_day

        # Update last_close
        for ticker, pos in positions.items():
            df = prices.get(ticker)
            if df is not None and day_ts in df.index:
                pos["last_close"] = float(df.loc[day_ts]["close"])

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    # Force-close remaining
    last_day = calendar[-1]
    for ticker, pos in list(positions.items()):
        trades.append(_close_trade(ticker, pos, last_day, pos["last_close"], "데이터_종료_미청산",
                                   ticker_reports, record_full_trades, None))

    return _compute_result(nav_series, trades, START_CAPITAL, label, open_positions=positions)


# ──────────────────────────────────────────────────────────────────────────────
# Strategy C: Narrative Hold — exit on 200MA + below entry (Faber 2007)
# Checked monthly. Hold indefinitely if thesis intact.
# ──────────────────────────────────────────────────────────────────────────────

def run_narrative_hold(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    label: str,
    ticker_reports: dict[str, list[dict]] | None = None,
    record_full_trades: bool = False,
    momentum_filter_entry: bool = False,
) -> dict:
    """
    진입: consensus ≥2, 발간 다음 거래일 시가
    청산: 월말 체크 — close < 200MA AND close < entry_price → 다음 거래일 시가 청산
    (Faber 2007 10-month SMA rule 정신: 추세 아래로 돌아오면 EXIT)
    momentum_filter_entry=True: 진입 시 close > 200MA 조건 추가 (Strategy F)
    """
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    pending_exits: set[str] = set()  # flagged at month-end, executed next open

    pending_entries = build_pending_entries(reports, calendar, consensus_only=True)

    # Build set of month-end dates
    cal_s = pd.Series(calendar)
    month_ends: set[dt.date] = set(
        cal_s.groupby(cal_s.apply(lambda d: (d.year, d.month))).last().values
    )

    for day in calendar:
        day_ts = pd.Timestamp(day)

        # Execute pending exits (flagged previous month-end)
        to_exit = [t for t in list(pending_exits) if t in positions]
        for ticker in to_exit:
            pos = positions[ticker]
            q = _get_quote(prices, ticker, day)
            if q is None or float(q["open"]) <= 0:
                continue
            exit_price = float(q["open"])
            cash += pos["shares"] * exit_price * (1 - COST_PER_SIDE)
            trades.append(_close_trade(ticker, pos, day, exit_price, "thesis_break_200MA",
                                       ticker_reports, record_full_trades, None))
            del positions[ticker]
            pending_exits.discard(ticker)

        # Execute pending entries
        if day in pending_entries:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            slots = MAX_POSITIONS - len(positions)
            candidates = list({t: (t, s, nc) for t, s, nc in pending_entries[day] if t not in positions}.values())
            for ticker, source, n_clubs in candidates[:slots]:
                pos, cash = _try_enter(ticker, source, n_clubs, day, prices, positions, cash, nav_now,
                                       ticker_reports, momentum_filter=momentum_filter_entry)
                if pos is not None:
                    positions[ticker] = pos

        # Update last_close and MA
        for ticker, pos in positions.items():
            df = prices.get(ticker)
            if df is not None and day_ts in df.index:
                pos["last_close"] = float(df.loc[day_ts]["close"])

        # Month-end thesis-break check (Faber rule: monthly check)
        if day in month_ends:
            for ticker, pos in list(positions.items()):
                df = prices.get(ticker)
                if df is None:
                    continue
                close = pos["last_close"]
                entry_p = pos["entry_price"]
                ma200_val = asof_value(df["ma200"], day)
                # Thesis break: close below 200MA AND below entry price
                if ma200_val > 0 and close < ma200_val and close < entry_p:
                    pending_exits.add(ticker)

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    # Force-close remaining
    last_day = calendar[-1]
    for ticker, pos in list(positions.items()):
        trades.append(_close_trade(ticker, pos, last_day, pos["last_close"], "데이터_종료_미청산",
                                   ticker_reports, record_full_trades, None))

    return _compute_result(nav_series, trades, START_CAPITAL, label, open_positions=positions)


# ──────────────────────────────────────────────────────────────────────────────
# Strategy D: Chandelier Ratchet — ATR(42)×5 trailing from highest-high
# Wide enough to let multibaggers breathe.
# ──────────────────────────────────────────────────────────────────────────────

def run_chandelier(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    label: str,
    ticker_reports: dict[str, list[dict]] | None = None,
    record_full_trades: bool = False,
) -> dict:
    """
    진입: consensus ≥2, immediate entry
    청산: close < (highest_high_since_entry - ATR(42) × 5)
    Chandelier Exit (Le Beau) — 문헌 표준값 ATR×5
    """
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    pending_exits: set[str] = set()

    pending_entries = build_pending_entries(reports, calendar, consensus_only=True)

    for day in calendar:
        day_ts = pd.Timestamp(day)

        # Execute pending exits
        to_exit = [t for t in list(pending_exits) if t in positions]
        for ticker in to_exit:
            pos = positions[ticker]
            q = _get_quote(prices, ticker, day)
            if q is None or float(q["open"]) <= 0:
                continue
            exit_price = float(q["open"])
            cash += pos["shares"] * exit_price * (1 - COST_PER_SIDE)
            trades.append(_close_trade(ticker, pos, day, exit_price, "chandelier_ATR5",
                                       ticker_reports, record_full_trades, None))
            del positions[ticker]
            pending_exits.discard(ticker)

        # Execute pending entries
        if day in pending_entries:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            slots = MAX_POSITIONS - len(positions)
            candidates = list({t: (t, s, nc) for t, s, nc in pending_entries[day] if t not in positions}.values())
            for ticker, source, n_clubs in candidates[:slots]:
                pos, cash = _try_enter(ticker, source, n_clubs, day, prices, positions, cash, nav_now, ticker_reports)
                if pos is not None:
                    atr_val = asof_value(prices[ticker]["atr"], day)
                    stop = pos["entry_price"] - CHANDELIER_ATR_MULT * atr_val if atr_val else pos["entry_price"] * 0.75
                    pos["stop"] = stop
                    positions[ticker] = pos

        # Update positions and check chandelier stop
        for ticker, pos in list(positions.items()):
            df = prices.get(ticker)
            if df is None or day_ts not in df.index:
                continue
            close = float(df.loc[day_ts]["close"])
            pos["last_close"] = close
            pos["highest"] = max(pos.get("highest", close), close)
            atr_val = asof_value(df["atr"], day)
            if atr_val:
                new_stop = pos["highest"] - CHANDELIER_ATR_MULT * atr_val
                pos["stop"] = max(pos.get("stop", 0.0), new_stop)
            if pos.get("stop") and close < pos["stop"] and ticker not in pending_exits:
                pending_exits.add(ticker)

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    last_day = calendar[-1]
    for ticker, pos in list(positions.items()):
        trades.append(_close_trade(ticker, pos, last_day, pos["last_close"], "데이터_종료_미청산",
                                   ticker_reports, record_full_trades, None))

    return _compute_result(nav_series, trades, START_CAPITAL, label, open_positions=positions)


# ──────────────────────────────────────────────────────────────────────────────
# Strategy E: Half-exit at target + runner with C rule
# Sell half at club target price; trail rest with 200MA+entry thesis break (monthly)
# ──────────────────────────────────────────────────────────────────────────────

def run_half_exit_runner(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    label: str,
    ticker_reports: dict[str, list[dict]] | None = None,
    record_full_trades: bool = False,
) -> dict:
    """
    진입: consensus ≥2, immediate entry
    절반 청산: 목표가(클럽 최고 목표가) 도달 시 → 보유 주수 50% 매도 (당일 종가)
    나머지 러너: C 규칙 (200MA + 진입가 하방, 월 1회 체크)
    목표가 없으면 전량 C 규칙만.
    """
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    runner_exits: set[str] = set()  # flagged for C-rule exit next open

    pending_entries = build_pending_entries(reports, calendar, consensus_only=True)

    cal_s = pd.Series(calendar)
    month_ends: set[dt.date] = set(
        cal_s.groupby(cal_s.apply(lambda d: (d.year, d.month))).last().values
    )

    for day in calendar:
        day_ts = pd.Timestamp(day)

        # Execute runner exits (C-rule triggered previous month-end)
        to_exit = [t for t in list(runner_exits) if t in positions]
        for ticker in to_exit:
            pos = positions[ticker]
            q = _get_quote(prices, ticker, day)
            if q is None or float(q["open"]) <= 0:
                continue
            exit_price = float(q["open"])
            # Only the runner shares remain
            runner_shares = pos["shares"]
            runner_cost = pos.get("runner_cost", pos["cost"] * 0.5)
            cash += runner_shares * exit_price * (1 - COST_PER_SIDE)
            trade = _close_trade(ticker, pos, day, exit_price, "runner_thesis_break_200MA",
                                 ticker_reports, record_full_trades, None,
                                 shares_override=runner_shares, cost_override=runner_cost)
            trades.append(trade)
            del positions[ticker]
            runner_exits.discard(ticker)

        # Execute pending entries
        if day in pending_entries:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            slots = MAX_POSITIONS - len(positions)
            candidates = list({t: (t, s, nc) for t, s, nc in pending_entries[day] if t not in positions}.values())
            for ticker, source, n_clubs in candidates[:slots]:
                pos, cash = _try_enter(ticker, source, n_clubs, day, prices, positions, cash, nav_now, ticker_reports)
                if pos is not None:
                    positions[ticker] = pos

        # Check target-price half exits (intraday high)
        for ticker, pos in list(positions.items()):
            if pos.get("half_sold"):
                continue
            tp = pos.get("target_price")
            if tp is None:
                continue
            df = prices.get(ticker)
            if df is None or day_ts not in df.index:
                continue
            high_today = float(df.loc[day_ts].get("high", df.loc[day_ts]["close"]))
            close_today = float(df.loc[day_ts]["close"])
            if high_today >= tp:
                # Sell half at target price (capped by close if needed)
                half_exit_price = min(tp, close_today) if close_today < tp else tp
                half_shares = pos["shares"] * 0.5
                half_cost = pos["cost"] * 0.5
                cash += half_shares * half_exit_price * (1 - COST_PER_SIDE)
                trade = _close_trade(ticker, pos, day, half_exit_price, "목표가_절반익절",
                                     ticker_reports, record_full_trades, None,
                                     shares_override=half_shares, cost_override=half_cost)
                trades.append(trade)
                # Update position to runner only
                pos["shares"] = pos["shares"] * 0.5
                pos["runner_cost"] = half_cost
                pos["half_sold"] = True
                pos["half_sell_price"] = half_exit_price

        # Update last_close
        for ticker, pos in positions.items():
            df = prices.get(ticker)
            if df is not None and day_ts in df.index:
                pos["last_close"] = float(df.loc[day_ts]["close"])

        # Month-end C-rule check for runners
        if day in month_ends:
            for ticker, pos in list(positions.items()):
                df = prices.get(ticker)
                if df is None:
                    continue
                close = pos["last_close"]
                entry_p = pos["entry_price"]
                ma200_val = asof_value(df["ma200"], day)
                if ma200_val > 0 and close < ma200_val and close < entry_p:
                    runner_exits.add(ticker)

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    last_day = calendar[-1]
    for ticker, pos in list(positions.items()):
        trades.append(_close_trade(ticker, pos, last_day, pos["last_close"], "데이터_종료_미청산",
                                   ticker_reports, record_full_trades, None))

    return _compute_result(nav_series, trades, START_CAPITAL, label, open_positions=positions)


# ──────────────────────────────────────────────────────────────────────────────
# Legacy Strategy (kept for sensitivity table): Immediate entry, fixed hold
# (supports all v5 flags for variant research)
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
    """v5 compatible fixed-hold runner (consensus window variants, upside weighting, target exit)."""
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []

    by_report_date: dict[dt.date, list[tuple[str, str, int]]] = {}
    if consensus_window is not None and ticker_reports is not None:
        all_report_dates = sorted({r[0] for r in reports})
        for rdate in all_report_dates:
            for r_rdate, r_ticker, r_source, _ in reports:
                if r_rdate != rdate:
                    continue
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

    pending_entries: dict[dt.date, list[tuple[str, str, int]]] = {}
    scheduled_exits: dict[str, dt.date] = {}
    target_prices: dict[str, float] = {}

    for rdate, items in by_report_date.items():
        entry_day = first_trading_day_after(rdate, calendar)
        if entry_day:
            pending_entries.setdefault(entry_day, []).extend(items)

    for day in calendar:
        day_ts = pd.Timestamp(day)

        if target_exit:
            for ticker, pos in list(positions.items()):
                tp = target_prices.get(ticker)
                if tp is None:
                    continue
                df = prices.get(ticker)
                if df is None:
                    continue
                if day_ts in df.index:
                    high_today = float(df.loc[day_ts].get("high", df.loc[day_ts]["close"]))
                    if high_today >= tp and ticker not in scheduled_exits:
                        scheduled_exits[ticker] = day

        to_exit = [t for t, exit_d in list(scheduled_exits.items()) if exit_d <= day and t in positions]
        for ticker in to_exit:
            pos = positions[ticker]
            df = prices.get(ticker)
            if df is None:
                continue
            q = df.loc[day_ts] if day_ts in df.index else None
            if q is None or float(q["open"]) <= 0:
                continue
            price = float(q["open"])
            proceeds = pos["shares"] * price * (1 - COST_PER_SIDE)
            cash += proceeds
            exit_reason = "목표가_도달" if target_exit and price >= (target_prices.get(ticker, 0)) else f"{hold_months}개월_만기"
            if day == calendar[-1]:
                exit_reason = "데이터_종료"
            trade: dict = {
                "ticker": ticker,
                "market": pos.get("market", "KR"),
                "display_name": pos.get("display_name", ticker),
                "source": pos["source"],
                "n_clubs": pos["n_clubs"],
                "entry_date": pos["entry_date"].isoformat(),
                "exit_date": day.isoformat(),
                "entry": round(pos["entry_price"], 4),
                "exit": round(price, 4),
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

                weight = POSITION_WEIGHT
                if upside_weighted and ticker_reports is not None:
                    tr_list = ticker_reports.get(ticker, [])
                    past = [x for x in tr_list if x["report_date"] < day and x["stated_upside_pct"] is not None]
                    if past:
                        avg_upside = sum(x["stated_upside_pct"] for x in past) / len(past)
                        scale = max(0.5, min(2.0, avg_upside / 30.0))
                        weight = POSITION_WEIGHT * scale

                budget = min(nav_now * weight, cash)
                if budget < nav_now * POSITION_WEIGHT * 0.5:
                    continue
                price = float(q["open"])
                shares = budget * (1 - COST_PER_SIDE) / price
                cash -= budget

                display_name = ticker
                tp = None
                market = "KR"
                if ticker_reports is not None:
                    tr_list = ticker_reports.get(ticker, [])
                    past_tr = [x for x in tr_list if x["report_date"] < day]
                    if past_tr:
                        latest = max(past_tr, key=lambda x: x["report_date"])
                        display_name = latest["display_name"]
                        tps = [x["target_price"] for x in past_tr if x["target_price"]]
                        tp = max(tps) if tps else None
                        market = past_tr[0].get("market", "KR")

                positions[ticker] = {
                    "shares": shares,
                    "entry_price": price,
                    "entry_date": day,
                    "cost": budget,
                    "last_close": price,
                    "source": source,
                    "n_clubs": n_clubs,
                    "display_name": display_name,
                    "market": market,
                }
                if tp:
                    target_prices[ticker] = tp

                exit_target = months_later(day, hold_months)
                exit_day = first_trading_day_on_or_after(exit_target, calendar)
                if exit_day:
                    scheduled_exits[ticker] = exit_day

        for ticker, pos in positions.items():
            df = prices.get(ticker)
            if df is not None and day_ts in df.index:
                pos["last_close"] = float(df.loc[day_ts]["close"])

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    last_day = calendar[-1]
    for ticker, pos in list(positions.items()):
        trade = {
            "ticker": ticker,
            "market": pos.get("market", "KR"),
            "display_name": pos.get("display_name", ticker),
            "source": pos["source"],
            "n_clubs": pos["n_clubs"],
            "entry_date": pos["entry_date"].isoformat() if hasattr(pos["entry_date"], "isoformat") else str(pos["entry_date"]),
            "exit_date": last_day.isoformat(),
            "entry": round(pos["entry_price"], 4),
            "exit": round(pos["last_close"], 4),
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
# Legacy Strategy E: v3 breakout + ATR ratchet (kept for sensitivity table)
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
        df = prices.get(ticker)
        if df is None:
            return None
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
                "market": pos.get("market", "KR"),
                "display_name": ticker,
                "source": pos["source"],
                "n_clubs": pos["n_clubs"],
                "entry_date": pos["entry_date"].isoformat(),
                "exit_date": day.isoformat(),
                "entry": round(pos["entry_price"], 4),
                "exit": round(price, 4),
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
                        "market": "KR",
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

    # Max single trade return
    max_trade = max((t["return_pct"] for t in closed_trades), default=None)
    max_trade_info = max(closed_trades, key=lambda t: t["return_pct"], default=None)

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
            "max_single_return_pct": round(max_trade, 2) if max_trade is not None else None,
            "best_trade_ticker": max_trade_info.get("display_name", max_trade_info.get("ticker")) if max_trade_info else None,
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

    # Ensure the last calendar day is always represented so the strategy line
    # extends exactly as far as the benchmark lines (fixes missing final point).
    last_day_date = all_dates[-1].date()
    if series and series[-1]["date"] != last_day_date.isoformat():
        bench_vals_last: dict[str, float] = {
            name: bench_units[name] * float(bench_aligned[name].iloc[-1])
            for name in bench_units
        }
        final_entry: dict = {
            "month": month_idx,
            "date": last_day_date.isoformat(),
            "contributed": round(total_contributed),
            "strategy_value": round(strat_wealth),
        }
        for name, val in bench_vals_last.items():
            final_entry[f"{name}_value"] = round(val)
        series.append(final_entry)

    final_strat = series[-1]["strategy_value"] if series else round(strat_wealth)
    final_contrib = series[-1]["contributed"] if series else round(total_contributed)

    def gain_pct(final: float) -> float | None:
        return round((final - final_contrib) / final_contrib * 100, 1) if final_contrib else None

    wealth_vals = pd.Series([s["strategy_value"] for s in series])
    sim_mdd = round(float((wealth_vals / wealth_vals.cummax() - 1).min()) * 100, 2) if len(wealth_vals) > 1 else 0.0

    bench_finals = {name: series[-1].get(f"{name}_value", 0) for name in benchmarks}

    return {
        "fx_assumption": (
            "미국 지수(NASDAQ, S&P500)와 GLD, 미국 종목은 달러 기준 포인트 수익률을 원화 환산 없이 그대로 사용. "
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
            {
                "ticker": t["ticker"],
                "market": t.get("market", "KR"),
                "display_name": t.get("display_name", t["ticker"]),
                "return_pct": t["return_pct"],
                "days": t["days"],
                "n_clubs": t.get("n_clubs", 1),
            }
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
# Today's signals (headline = A. 12개월 보유 consensus)
# ──────────────────────────────────────────────────────────────────────────────

def compute_today_signals(
    perf: pd.DataFrame,
    prices: dict[str, pd.DataFrame],
    ticker_reports: dict[str, list[dict]],
    calendar: list[dt.date],
    headline_trades: list[dict],
    headline_label: str,
) -> dict:
    as_of = calendar[-1] if calendar else dt.date.today()
    as_of_ts = pd.Timestamp(as_of)

    open_positions: list[dict] = []
    expiring_soon: list[dict] = []
    new_signals: list[dict] = []
    watching: list[dict] = []

    # For headline A (12mo fixed hold): positions still within 12mo hold
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
        exit_due = months_later(entry_date, 12)
        days_elapsed = (as_of - entry_date).days
        days_remaining = (exit_due - as_of).days

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
            "market": trade.get("market", "KR"),
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

    all_tickers = set(ticker_reports.keys()) & set(prices.keys())
    already_in = set(entry_map.keys())

    for ticker in all_tickers:
        tr_list = ticker_reports.get(ticker, [])
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
        market = past[0].get("market", "KR")

        entry_basis_date = first_trading_day_after(latest_report_date, calendar)
        entry_basis_price = None
        if entry_basis_date and ticker in prices:
            df = prices[ticker]
            ts = pd.Timestamp(entry_basis_date)
            if ts in df.index:
                entry_basis_price = float(df.loc[ts]["open"])

        if n_schools == 1 and ticker not in already_in:
            school_name = list(by_school.keys())[0]
            r = by_school[school_name]
            watching.append({
                "ticker": ticker,
                "market": market,
                "display_name": r["display_name"],
                "covering_school": school_name,
                "latest_report_date": r["report_date"].isoformat(),
                "target_price": r["target_price"],
                "stated_upside_pct": r["stated_upside_pct"],
                "entry_basis_date": entry_basis_date.isoformat() if entry_basis_date else None,
                "entry_basis_price": round(entry_basis_price, 4) if entry_basis_price else None,
                "note": "추가 학회 발간 시 매수 신호",
            })

        elif n_schools >= 2 and ticker not in already_in:
            if entry_basis_date and (as_of - entry_basis_date).days <= 30:
                trigger_list = list(by_school.values())
                new_signals.append({
                    "ticker": ticker,
                    "market": market,
                    "display_name": latest_report["display_name"],
                    "n_schools": n_schools,
                    "entry_basis_date": entry_basis_date.isoformat() if entry_basis_date else None,
                    "entry_basis_price": round(entry_basis_price, 4) if entry_basis_price else None,
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

    watching.sort(key=lambda x: x["latest_report_date"], reverse=True)
    new_signals.sort(key=lambda x: x["entry_basis_date"] or "", reverse=True)

    return {
        "as_of": as_of.isoformat(),
        "headline_strategy": headline_label,
        "disclaimer": "백테스트 규칙의 기계적 적용이며 투자 권유가 아닙니다. 과거 데이터 기반 시뮬레이션으로 미래 수익을 보장하지 않습니다.",
        "open_positions": open_positions,
        "expiring_soon": expiring_soon,
        "new_buy_signals": new_signals,
        "watching_single_club": watching[:30],
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
        "매수일", "매수가(시가)", "종목명", "티커", "시장", "비중(%)", "커버학회수",
        "트리거학회", "리포트날짜들", "목표가들", "매도일", "매도가", "보유일수",
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
            target_prices_str = "|".join(
                str(round(float(tp), 2)) for tp in t.get("trigger_target_prices", []) if tp
            )
            writer.writerow([
                t.get("entry_date", ""),
                t.get("entry", ""),
                t.get("display_name", t.get("ticker", "")),
                t.get("ticker", ""),
                t.get("market", "KR"),
                round(POSITION_WEIGHT * 100, 1),
                t.get("n_clubs", 1),
                trigger_schools,
                trigger_rdates,
                target_prices_str,
                t.get("exit_date", ""),
                t.get("exit", ""),
                t.get("days", ""),
                t.get("return_pct", ""),
                t.get("exit_reason", ""),
            ])
    print(f"  CSV written: {path} ({len(closed_sorted)} rows)", flush=True)


# ──────────────────────────────────────────────────────────────────────────────
# Multi-strategy comparison helpers
# ──────────────────────────────────────────────────────────────────────────────

def build_multi_strategy_summary(strategies: dict[str, dict]) -> list[dict]:
    """Build comparison table rows for all v6 strategies."""
    rows = []
    for key, r in strategies.items():
        closed = [t for t in r.get("trades", []) if not t.get("exit_reason", "").endswith("미청산")]
        max_trade = max((t["return_pct"] for t in closed), default=None)
        max_trade_info = max(closed, key=lambda t: t["return_pct"], default=None)
        # Tail stat: % P&L from top decile
        n = len(closed)
        top10_n = max(1, math.ceil(n * 0.1)) if n > 0 else 0
        top_decile = sorted([t["return_pct"] for t in closed], reverse=True)[:top10_n]
        total_pos = sum(t["return_pct"] for t in closed if t["return_pct"] > 0)
        top_decile_pos = sum(x for x in top_decile if x > 0)
        top_decile_pnl_share = round(top_decile_pos / total_pos * 100, 1) if total_pos > 0 else 0.0

        is_m = r.get("in_sample", {})
        oos_m = r.get("out_of_sample", {})
        rows.append({
            "key": key,
            "label": r["label"],
            "metrics": r["metrics"],
            "in_sample": is_m,
            "out_of_sample": oos_m,
            "max_single_return_pct": round(max_trade, 2) if max_trade is not None else None,
            "best_trade_name": max_trade_info.get("display_name", max_trade_info.get("ticker")) if max_trade_info else None,
            "best_trade_ticker": max_trade_info.get("ticker") if max_trade_info else None,
            "top_decile_pnl_share_pct": top_decile_pnl_share,
            "trade_count": n,
        })
    return rows


# ──────────────────────────────────────────────────────────────────────────────
# main
# ──────────────────────────────────────────────────────────────────────────────

def main() -> int:
    print("Loading report data...", flush=True)
    perf_all = pd.read_csv(ROOT / "data" / "report_performance.csv", encoding="utf-8-sig")

    # ── Load both KR and US buy reports
    perf = perf_all[
        perf_all["ticker"].notna()
        & perf_all["report_date"].notna()
        & (perf_all["rating_class"] == "buy")
        & (perf_all["report_date"] >= UNIVERSE_START.isoformat())
    ].copy()

    # Normalise ticker keys
    def normalise_ticker(row: pd.Series) -> str:
        market = str(row.get("market", "KR"))
        t = str(row["ticker"])
        return t.zfill(6) if market == "KR" else t

    perf["ticker_key"] = perf.apply(normalise_ticker, axis=1)

    kr_count = (perf["market"] == "KR").sum()
    us_count = (perf["market"] == "US").sum()
    print(f"  {len(perf)} buy reports: {kr_count} KR + {us_count} US  "
          f"({perf.report_date.min()} to {perf.report_date.max()})", flush=True)

    # Build per-ticker report metadata
    ticker_reports = build_ticker_reports(perf)

    # Club count per ticker_key
    ticker_club_count: dict[str, int] = (
        perf.groupby("ticker_key")["school"].nunique().to_dict()
    )

    # ── Fetch missing US price files
    print("Checking US price files...", flush=True)
    us_tickers = perf[perf["market"] == "US"]["ticker"].unique()
    for t in us_tickers:
        path = PRICE_DIR / f"US_{t}.csv"
        if not path.exists():
            _fetch_us_stock_yf(t)

    # ── Load prices (KR + US)
    print("Loading stock prices...", flush=True)
    prices: dict[str, pd.DataFrame] = {}
    for _, row in perf.iterrows():
        tk = row["ticker_key"]
        market = str(row.get("market", "KR"))
        if tk not in prices:
            df = load_prices(str(row["ticker"]), market)
            if df is not None:
                prices[tk] = df

    # ── Build reports list using ticker_key
    reports: list[tuple[dt.date, str, str, int]] = []
    for _, row in perf.iterrows():
        tk = row["ticker_key"]
        if tk not in prices:
            continue
        try:
            rdate = dt.date.fromisoformat(str(row["report_date"]))
        except ValueError:
            continue
        n_clubs = ticker_club_count.get(tk, 1)
        source = Path(str(row["source_file"])).name
        reports.append((rdate, tk, source, n_clubs))
    reports.sort()

    kr_with_prices = len({r[1] for r in reports if r[1][0].isdigit()})
    us_with_prices = len({r[1] for r in reports if not r[1][0].isdigit()})
    print(f"  {len(reports)} reports with price data, "
          f"{kr_with_prices} KR tickers + {us_with_prices} US tickers", flush=True)

    # Consensus-only reports
    consensus_reports = [(d, t, s, n) for d, t, s, n in reports if n >= 2]
    print(f"  {len(consensus_reports)} consensus (≥2 clubs) reports, "
          f"{len({r[1] for r in consensus_reports})} tickers", flush=True)

    # ── Calendar (merged KR + US trading days)
    raw_calendar = sorted({ts.date() for df in prices.values() for ts in df.index})
    calendar = [d for d in raw_calendar if d >= SIM_START]
    if not calendar:
        print("ERROR: no calendar dates after SIM_START", flush=True)
        return 1
    print(f"  Calendar (clipped): {calendar[0]} to {calendar[-1]}", flush=True)

    # ── Load benchmarks
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

    # ══════════════════════════════════════════════════════════════════════════
    # v6 MULTI-STRATEGY COMPARISON
    # All strategies: consensus ≥2, immediate entry, same costs/position sizing
    # Parameters are literature-grounded fixed values — no grid search
    # ══════════════════════════════════════════════════════════════════════════

    print("\n── Running 6 strategies ──────────────────────────────────────────", flush=True)

    # A. 12개월 보유 (baseline headline)
    print("A. 12개월 보유...", flush=True)
    result_A = run_fixed_hold(
        prices, reports, calendar, hold_months=12,
        label="A_12mo", ticker_reports=ticker_reports, record_full_trades=True,
    )
    print(f"   IS sharpe={result_A['in_sample'].get('sharpe')}  OOS sharpe={result_A['out_of_sample'].get('sharpe')}", flush=True)

    # B. 36개월 보유 (long horizon)
    print("B. 36개월 보유...", flush=True)
    result_B = run_fixed_hold(
        prices, reports, calendar, hold_months=36,
        label="B_36mo", ticker_reports=ticker_reports, record_full_trades=True,
    )
    print(f"   IS sharpe={result_B['in_sample'].get('sharpe')}  OOS sharpe={result_B['out_of_sample'].get('sharpe')}", flush=True)

    # C. 내러티브 홀드 (Faber 2007 thesis-break exit)
    print("C. 내러티브 홀드 (200MA thesis-break)...", flush=True)
    result_C = run_narrative_hold(
        prices, reports, calendar,
        label="C_narrative", ticker_reports=ticker_reports, record_full_trades=True,
    )
    print(f"   IS sharpe={result_C['in_sample'].get('sharpe')}  OOS sharpe={result_C['out_of_sample'].get('sharpe')}", flush=True)

    # D. 샹들리에 래칫 (ATR42×5 trailing)
    print("D. 샹들리에 래칫 (ATR×5)...", flush=True)
    result_D = run_chandelier(
        prices, reports, calendar,
        label="D_chandelier", ticker_reports=ticker_reports, record_full_trades=True,
    )
    print(f"   IS sharpe={result_D['in_sample'].get('sharpe')}  OOS sharpe={result_D['out_of_sample'].get('sharpe')}", flush=True)

    # E. 목표가 절반익절 + 러너 (C rule trail)
    print("E. 절반익절 + 러너...", flush=True)
    result_E = run_half_exit_runner(
        prices, reports, calendar,
        label="E_half_runner", ticker_reports=ticker_reports, record_full_trades=True,
    )
    print(f"   IS sharpe={result_E['in_sample'].get('sharpe')}  OOS sharpe={result_E['out_of_sample'].get('sharpe')}", flush=True)

    # F. 모멘텀 필터 진입 (진입 시 200MA 위) + C 청산
    print("F. 모멘텀 필터 + 내러티브 홀드...", flush=True)
    result_F = run_narrative_hold(
        prices, reports, calendar,
        label="F_momentum_narrative", ticker_reports=ticker_reports, record_full_trades=True,
        momentum_filter_entry=True,
    )
    print(f"   IS sharpe={result_F['in_sample'].get('sharpe')}  OOS sharpe={result_F['out_of_sample'].get('sharpe')}", flush=True)

    v6_strategies = {
        "A_12mo": result_A,
        "B_36mo": result_B,
        "C_narrative": result_C,
        "D_chandelier": result_D,
        "E_half_runner": result_E,
        "F_momentum_narrative": result_F,
    }

    # ── Summary table
    print("\n── Strategy summary (v6) ─────────────────────────────────────────", flush=True)
    print(f"{'Strategy':<28} {'IS CAGR':>9} {'IS Shp':>8} {'OOS CAGR':>10} {'OOS Shp':>9} {'MaxRet%':>8} {'Trades':>7}", flush=True)
    for key, r in v6_strategies.items():
        is_m = r.get("in_sample", {})
        oos_m = r.get("out_of_sample", {})
        max_r = r["metrics"].get("max_single_return_pct")
        print(
            f"  {key:<26} {str(is_m.get('cagr_pct','—')):>9} {str(is_m.get('sharpe','—')):>8} "
            f"{str(oos_m.get('cagr_pct','—')):>10} {str(oos_m.get('sharpe','—')):>9} "
            f"{str(round(max_r,1) if max_r else '—'):>8} {r['metrics']['trades']:>7}",
            flush=True,
        )

    # ── Headline selection: best risk-adjusted (IS sharpe primary, OOS sharpe tiebreak)
    # With tenbagger-narrative: C (내러티브) is favoured for its tail-capture property
    # Final headline = best IS sharpe (automatic, anti-overfit)
    def is_sharpe(r: dict) -> float:
        v = r.get("in_sample", {}).get("sharpe")
        return v if v is not None else -999.0

    headline = max(v6_strategies.values(), key=is_sharpe)
    headline_label = headline["label"]
    headline_key = next(k for k, v in v6_strategies.items() if v is headline)
    print(f"\nHeadline (best IS sharpe): {headline_label} [{headline_key}]", flush=True)

    # ── Tail stats and consensus stats on headline
    tail_stats = compute_tail_stats(headline.get("trades", []))
    consensus_stats = compute_consensus_stats(headline.get("trades", []))

    # ── Also compute legacy variant research on A_12mo (for backwards compat section)
    print("\nRunning legacy variant research...", flush=True)
    # Use A (12mo, consensus) as D_consensus_12mo equivalent
    legacy_d = result_A  # same logic
    variants: list[dict] = []

    for hold in [6, 9, 18]:
        lbl = f"variant_{hold}mo"
        rv = run_fixed_hold(prices, reports, calendar, hold_months=hold, label=lbl, ticker_reports=ticker_reports)
        variants.append({"label": lbl, "metrics": rv["metrics"], "in_sample": rv.get("in_sample", {}), "out_of_sample": rv.get("out_of_sample", {})})

    # ── Wealth simulation on headline
    print("\nComputing wealth simulations...", flush=True)
    headline_nav: pd.Series = headline["nav_df"]
    assert headline_nav.index[0].date() >= SIM_START

    benchmarks_for_sim: dict[str, pd.Series] = {
        "KOSPI": kospi, "SP500": sp500, "NASDAQ": nasdaq, "AllWeather": all_weather,
    }
    wealth_sim = compute_wealth_simulation_multi(headline_nav, benchmarks_for_sim, strat_start, strat_end)
    print(f"  Strategy final: {wealth_sim['final_strategy_value']:,}원", flush=True)

    # Per-strategy wealth sims (for UI switcher)
    strat_wealth_sims: dict[str, dict] = {}
    for key, r in v6_strategies.items():
        ws = compute_wealth_simulation_multi(r["nav_df"], benchmarks_for_sim, strat_start, strat_end)
        strat_wealth_sims[key] = {
            "final_strategy_value": ws["final_strategy_value"],
            "strategy_gain_on_contributed_pct": ws["strategy_gain_on_contributed_pct"],
            "strategy_mdd_pct": ws["strategy_mdd_pct"],
            "series": ws["series"],
        }

    # ── Today's signals (based on headline A rules: 12mo hold, consensus)
    print("\nComputing today's signals...", flush=True)
    today_signals = compute_today_signals(
        perf, prices, ticker_reports, calendar,
        result_A.get("trades", []),  # always use A for signals (12mo horizon)
        "A_12mo",
    )
    print(f"  Open: {today_signals['counts']['open']}, "
          f"Expiring ≤30d: {today_signals['counts']['expiring_soon_30d']}, "
          f"New buy signals: {today_signals['counts']['new_buy_signals']}, "
          f"Watching (1-club): {today_signals['counts']['watching_single_club']}",
          flush=True)

    # ── Export CSVs per strategy
    print("\nExporting trade CSVs...", flush=True)
    export_trades_csv(result_A.get("trades", []), CSV_PATH)  # default headline CSV
    for key, r in v6_strategies.items():
        export_trades_csv(r.get("trades", []), PUBLIC_DIR / f"strategy-trades-{key}.csv")

    # ── Multi-strategy comparison rows
    multi_strategy_summary = build_multi_strategy_summary(v6_strategies)

    # ── Open positions from headline
    open_positions_list = []
    if "open_positions" in headline and isinstance(headline["open_positions"], dict):
        for t, p in headline["open_positions"].items():
            open_positions_list.append({
                "ticker": t,
                "market": p.get("market", "KR"),
                "display_name": p.get("display_name", t),
                "entry_date": p["entry_date"].isoformat() if hasattr(p.get("entry_date"), "isoformat") else str(p.get("entry_date", "")),
                "entry": round(p["entry_price"], 4),
                "last_close": round(p["last_close"], 4),
                "stop": round(p.get("stop", 0) or 0, 4),
                "return_pct": round((p["shares"] * p["last_close"] / p["cost"] - 1) * 100, 2),
                "source": p.get("source", ""),
                "n_clubs": p.get("n_clubs", 1),
            })

    # ── Legacy breakout sensitivity (kept for legacy page section)
    print("\nBuilding breakout sensitivity (legacy E)...", flush=True)
    # Use KR-only prices for breakout to keep signals consistent with v5
    kr_prices = {k: v for k, v in prices.items() if k[0].isdigit()}
    kr_reports = [(d, t, s, n) for d, t, s, n in reports if t[0].isdigit()]

    signals_list: list[tuple[dt.date, str, str, int]] = []
    for rdate, ticker, source, n_clubs in kr_reports:
        signal = find_signal(prices[ticker], rdate)
        if signal:
            signals_list.append((signal, ticker, source, n_clubs))
    signals_list.sort()
    by_signal_date: dict[dt.date, list[tuple[str, str, int]]] = {}
    for date, ticker, source, n_clubs in signals_list:
        by_signal_date.setdefault(date, []).append((ticker, source, n_clubs))

    breakout_cal = [d for d in calendar if d >= min(s[0] for s in signals_list)] if signals_list else calendar
    regime = load_regime()

    sensitivity: list[dict] = []
    for atr_mult in (2.0, 3.0, 4.0, 5.0):
        for use_regime in (False, True):
            r = run_breakout_backtest(
                kr_prices, by_signal_date, breakout_cal, atr_mult,
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

    # ── Headline closed trades for JSON
    headline_trades_for_json = [
        t for t in headline.get("trades", [])
        if not t.get("exit_reason", "").endswith("미청산")
    ]

    payload = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "universe_filter": f"rating_class == buy AND report_date >= {UNIVERSE_START.isoformat()} (KR + US)",
        "universe_stats": {
            "kr_reports": int(kr_count),
            "us_reports": int(us_count),
            "total_reports": int(len(perf)),
            "kr_tickers": kr_with_prices,
            "us_tickers": us_with_prices,
        },
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
            "headline_key": headline_key,
            "chandelier_atr_mult": CHANDELIER_ATR_MULT,
            "faber_ma_period": 200,
            "anti_overfit_note": "파라미터는 문헌 표준값 고정 (200MA, ATR×5). 그리드 서치 없음.",
        },
        "metrics": headline["metrics"],
        "in_sample": headline.get("in_sample", {}),
        "out_of_sample": headline.get("out_of_sample", {}),
        "yearly": headline["yearly"],
        "equity": headline["equity"],
        "sensitivity": sensitivity,
        # v6: per-strategy comparison
        "multi_strategy": {
            "strategies": multi_strategy_summary,
            "headline_key": headline_key,
            "strategy_wealth_sims": strat_wealth_sims,
            # per-strategy equity curves
            "equity_by_strategy": {
                key: r["equity"] for key, r in v6_strategies.items()
            },
            # per-strategy yearly returns
            "yearly_by_strategy": {
                key: r["yearly"] for key, r in v6_strategies.items()
            },
        },
        # legacy fields for backwards compat
        "research_families": [
            {"label": r["label"], "metrics": r["metrics"],
             "in_sample": r.get("in_sample", {}), "out_of_sample": r.get("out_of_sample", {})}
            for r in v6_strategies.values()
        ],
        "variant_research": {
            "variants": variants,
            "conclusion": "v6: 전략 패밀리 재구성 — 고정 홀드 vs 동적 청산 비교. 상세 내용은 multi_strategy 참조.",
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
    print(f"  Trades in JSON: {len(headline_trades_for_json)}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
