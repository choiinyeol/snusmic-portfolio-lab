"""학회 리포트 × 전략 연구 백테스트 v4.

변경사항 (v4):
- 유니버스: report_date >= 2019-07-01 & rating_class == 'buy' (KR)
- 벤치마크: KOSPI, NASDAQ, S&P500, 올웨더(GLD 25%+NASDAQ 25%+S&P500 25%+KOSPI 25%, 분기 리밸런싱)
  FX 가정: 지수 수익률(local currency / 달러 기준 지수 레벨)을 그대로 사용 — 환율 변환 없음.
  (미국 지수는 달러 레벨, 한국 지수는 원화 레벨을 동일 '포인트 기준 수익률'로 취급.)
- 전략 패밀리 연구:
  A. 즉시 진입 (발간 당일 다음 거래일 시가 매수, hold 12개월, 동일비중)
  B. 장기보유 (발간 당일 진입, 18개월 보유 후 청산)
  C. 동일비중 월 리밸런싱 클럽 포트폴리오 (모든 활성 buy 콜 동일비중, 월말 리밸런싱)
  D. 컨센서스 전용 (≥2개 학회 동시 buy, 즉시 진입 + 12개월 보유)
  E. v3 헤드라인 (52w 신고가 돌파 + ATR 래칫, in-sample 최적 파라미터 유지)
- 인샘플: 2019-07-01 ~ 2023-12-31, 아웃오브샘플: 2024-01-01 ~ 현재
- 부의 시뮬레이션: 초기 1천만원 + 월 100만원 (2년마다 +100만원), 5개 곡선
- 베이스라인: 나이브 buy-every-report-at-publication-hold-12mo (전략 A와 동일)
- 출력: src/data/strategy-backtest.json

헤드라인 전략 선정 기준: 인샘플 샤프비율 우선, 아웃오브샘플 확인.
"""

from __future__ import annotations

import datetime as dt
import json
import math
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PRICE_DIR = ROOT / "data" / "prices"
OUT_PATH = ROOT / "src" / "data" / "strategy-backtest.json"

# Universe filter
UNIVERSE_START = dt.date(2019, 7, 1)

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
                # Fresh enough
                return df["close"].sort_index()
            # Incremental update
            start_upd = last_date + dt.timedelta(days=1)
            raw = yf.download(ticker, start=start_upd.isoformat(), progress=False, auto_adjust=True, threads=False)
            if not raw.empty:
                raw.index = pd.to_datetime(raw.index)
                # Handle MultiIndex columns from yfinance
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

    # Full download
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
    """IDX_US.csv = ^GSPC (S&P500)."""
    path = PRICE_DIR / "IDX_US.csv"
    df = pd.read_csv(path, index_col=0, parse_dates=True).sort_index()
    return df["close"]


def load_nasdaq() -> pd.Series:
    return _fetch_index_yf("^IXIC", "NASDAQ")


def load_gld() -> pd.Series:
    return _fetch_index_yf("GLD", "GLD")


def load_prices(ticker: str) -> pd.DataFrame | None:
    path = PRICE_DIR / f"KR_{ticker}.csv"
    if not path.exists():
        return None
    df = pd.read_csv(path, index_col=0, parse_dates=True).sort_index()
    if df.empty or "close" not in df:
        return None
    df = df[~df.index.duplicated(keep="last")]
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
# Strategy A/D: Immediate entry, fixed hold period
# ──────────────────────────────────────────────────────────────────────────────

def run_immediate_hold(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],  # (report_date, ticker, source, n_clubs)
    calendar: list[dt.date],
    hold_months: int,
    consensus_only: bool = False,
    label: str = "immediate",
) -> dict:
    """
    진입: report_date 이후 첫 거래일 시가
    청산: 진입 후 hold_months개월 후 첫 거래일 시가
    포지션: 동일비중 5%, 최대 20종목
    consensus_only: True면 n_clubs >= 2만 진입
    """
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []

    # Build entry queue: report_date -> list of (ticker, source, n_clubs)
    by_report_date: dict[dt.date, list[tuple[str, str, int]]] = {}
    for rdate, ticker, source, n_clubs in reports:
        if consensus_only and n_clubs < 2:
            continue
        by_report_date.setdefault(rdate, []).append((ticker, source, n_clubs))

    # For each entry, compute exit date (hold_months calendar months later)
    pending_entries: dict[dt.date, list[tuple[str, str, int]]] = {}  # first trading day after report_date
    scheduled_exits: dict[str, dt.date] = {}  # ticker -> exit date

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

    # Pre-compute entry days
    for rdate, items in by_report_date.items():
        entry_day = first_trading_day_after(rdate)
        if entry_day:
            pending_entries.setdefault(entry_day, []).extend(items)

    for day in calendar:
        day_ts = pd.Timestamp(day)

        # Execute scheduled exits
        to_exit = [t for t, exit_d in scheduled_exits.items() if exit_d <= day and t in positions]
        for ticker in to_exit:
            pos = positions.get(ticker)
            if pos is None:
                continue
            df = prices[ticker]
            q = df.loc[day_ts] if day_ts in df.index else None
            if q is None or float(q["open"]) <= 0:
                continue  # defer
            price = float(q["open"])
            proceeds = pos["shares"] * price * (1 - COST_PER_SIDE)
            cash += proceeds
            trades.append({
                "ticker": ticker,
                "source": pos["source"],
                "n_clubs": pos["n_clubs"],
                "entry_date": pos["entry_date"].isoformat(),
                "exit_date": day.isoformat(),
                "entry": round(pos["entry_price"], 2),
                "exit": round(price, 2),
                "return_pct": round((proceeds / pos["cost"] - 1) * 100, 2),
                "days": (day - pos["entry_date"]).days,
            })
            del positions[ticker]
            if ticker in scheduled_exits:
                del scheduled_exits[ticker]

        # Execute pending entries
        if day in pending_entries:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            slots = MAX_POSITIONS - len(positions)
            candidates = [(t, s, nc) for t, s, nc in pending_entries[day] if t not in positions]
            # Deduplicate tickers (take first occurrence per ticker)
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
                budget = min(nav_now * POSITION_WEIGHT, cash)
                if budget < nav_now * POSITION_WEIGHT * 0.5:
                    continue
                price = float(q["open"])
                shares = budget * (1 - COST_PER_SIDE) / price
                cash -= budget
                positions[ticker] = {
                    "shares": shares,
                    "entry_price": price,
                    "entry_date": day,
                    "cost": budget,
                    "last_close": price,
                    "source": source,
                    "n_clubs": n_clubs,
                }
                # Schedule exit
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

    return _compute_result(nav_series, trades, START_CAPITAL, label)


# ──────────────────────────────────────────────────────────────────────────────
# Strategy C: Equal-weight monthly rebalanced portfolio
# ──────────────────────────────────────────────────────────────────────────────

def run_equal_weight_monthly(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    label: str = "ew_monthly",
) -> dict:
    """
    매월 말일 기준: 해당 날짜까지 발간된 buy 리포트 중 활성 상태인 모든 종목 동일비중 보유.
    '활성'= 가장 최근 report_date가 발간된 지 12개월 이내인 종목.
    월말 시가에 전 달 포트폴리오를 청산 후 새 포트폴리오 매수.
    """
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []

    # Build: ticker -> list of report_dates (sorted)
    ticker_rdates: dict[str, list[dt.date]] = {}
    for rdate, ticker, source, n_clubs in reports:
        ticker_rdates.setdefault(ticker, []).append(rdate)
    for t in ticker_rdates:
        ticker_rdates[t].sort()

    # Month-end trading days
    cal_series = pd.Series(calendar)
    month_ends: set[dt.date] = set(
        cal_series.groupby(cal_series.apply(lambda d: (d.year, d.month))).last().values
    )

    positions: dict[str, dict] = {}  # ticker -> {shares, cost, entry_price, entry_date, last_close}

    def active_tickers(as_of: dt.date) -> list[str]:
        result = []
        for t, rdates in ticker_rdates.items():
            # Most recent report_date <= as_of and within 12 months
            past = [r for r in rdates if r <= as_of]
            if not past:
                continue
            latest = max(past)
            if (as_of - latest).days <= 365:
                result.append(t)
        return result

    for day in calendar:
        day_ts = pd.Timestamp(day)

        # Update last_close
        for ticker, pos in positions.items():
            df = prices.get(ticker)
            if df is not None and day_ts in df.index:
                pos["last_close"] = float(df.loc[day_ts]["close"])

        is_month_end = day in month_ends

        if is_month_end:
            # Compute current NAV
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())

            # Liquidate all positions at today's open (if available)
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
                    "source": "ew_monthly",
                    "n_clubs": 1,
                    "entry_date": pos["entry_date"].isoformat(),
                    "exit_date": day.isoformat(),
                    "entry": round(pos["entry_price"], 2),
                    "exit": round(price, 2),
                    "return_pct": round((proceeds / pos["cost"] - 1) * 100, 2),
                    "days": (day - pos["entry_date"]).days,
                })
            positions = {}

            # Build new portfolio
            universe = [t for t in active_tickers(day) if t in prices]
            if universe:
                n = min(len(universe), MAX_POSITIONS * 4)  # No max cap for equal-weight
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
# Strategy E: v3 breakout + ATR ratchet (original logic)
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
                "source": pos["source"],
                "n_clubs": pos["n_clubs"],
                "entry_date": pos["entry_date"].isoformat(),
                "exit_date": day.isoformat(),
                "entry": round(pos["entry_price"], 2),
                "exit": round(price, 2),
                "return_pct": round((proceeds / pos["cost"] - 1) * 100, 2),
                "days": (day - pos["entry_date"]).days,
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

    return _compute_result(nav_series, trades, START_CAPITAL, label, positions=positions)


# ──────────────────────────────────────────────────────────────────────────────
# Shared result computation
# ──────────────────────────────────────────────────────────────────────────────

def _compute_result(
    nav_series: list[tuple[str, float]],
    trades: list[dict],
    start_capital: float,
    label: str,
    positions: dict | None = None,
) -> dict:
    nav_df = pd.Series({pd.Timestamp(d): v for d, v in nav_series}).sort_index()
    daily_ret = nav_df.pct_change().dropna()
    total_return = nav_df.iloc[-1] / nav_df.iloc[0] - 1
    years = (nav_df.index[-1] - nav_df.index[0]).days / 365.25
    cagr = (nav_df.iloc[-1] / nav_df.iloc[0]) ** (1 / years) - 1 if years > 0 else None
    sharpe = float(daily_ret.mean() / daily_ret.std() * math.sqrt(252)) if daily_ret.std() else None
    mdd = float((nav_df / nav_df.cummax() - 1).min())
    wins = [t for t in trades if t["return_pct"] > 0]

    # In-sample vs out-of-sample split
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
            "trades": len(trades),
            "win_rate_pct": round(len(wins) / len(trades) * 100, 1) if trades else None,
            "avg_hold_days": round(sum(t["days"] for t in trades) / len(trades), 1) if trades else None,
        },
        "in_sample": period_metrics(is_mask),
        "out_of_sample": period_metrics(oos_mask),
        "yearly": [{"year": ts.year, "return_pct": float(v)} for ts, v in yearly.items()],
        "equity": equity_weekly,
        "trades": trades,
        "nav_df": nav_df,
    }
    if positions is not None:
        result["open_positions"] = positions
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
    """
    올웨더 = 25% GLD + 25% NASDAQ + 25% S&P500 + 25% KOSPI, 분기 리밸런싱.
    FX 가정: 모든 지수를 local/원화 레벨 그대로 사용 (달러/원화 혼용 포인트 기준).
    """
    # Common date index
    idx = pd.date_range(start=pd.Timestamp(start), end=pd.Timestamp(end), freq="B")
    k = kospi.reindex(idx).ffill().bfill()
    s = sp500.reindex(idx).ffill().bfill()
    n = nasdaq.reindex(idx).ffill().bfill()
    g = gld.reindex(idx).ffill().bfill()

    # Normalize to 1.0 at start
    k = k / k.iloc[0]
    s = s / s.iloc[0]
    n = n / n.iloc[0]
    g = g / g.iloc[0]

    weights = {"k": 0.25, "s": 0.25, "n": 0.25, "g": 0.25}
    # Start with equal units valued at 1.0 each
    units = {name: weights[name] for name in weights}  # each "unit" starts at price=1.0
    prices_dict = {"k": k, "s": s, "n": n, "g": g}

    nav = pd.Series(index=idx, dtype=float)
    last_rebal_quarter: tuple[int, int] | None = None

    for ts in idx:
        # Current prices
        p = {name: float(prices_dict[name].loc[ts]) for name in units}
        current_nav = sum(units[name] * p[name] for name in units)

        # Quarterly rebalance check
        q = (ts.year, (ts.month - 1) // 3)
        if last_rebal_quarter != q:
            last_rebal_quarter = q
            # Rebalance: set units so each asset = 25% of current_nav
            for name in units:
                units[name] = weights[name] * current_nav / p[name]

        nav.loc[ts] = current_nav

    return nav.dropna()


def compute_index_wealth_series(
    index_close: pd.Series,
    strategy_nav_df: pd.Series,
) -> list[dict]:
    """
    동일 DCA 일정으로 지수를 추종할 경우 부의 시뮬레이션.
    Returns monthly snapshot list with same schema as strategy series.
    """
    all_dates = strategy_nav_df.index
    idx_aligned = index_close.reindex(all_dates).ffill().bfill()

    _dates_series = pd.Series(all_dates.date, index=all_dates)
    monthly_dates = set(
        _dates_series.groupby(_dates_series.index.to_period("M")).first().values
    )

    idx_first = float(idx_aligned.iloc[0])
    bench_units = DCA_INITIAL / idx_first
    bench_wealth = float(DCA_INITIAL)
    total_contributed = float(DCA_INITIAL)
    month_idx = 0
    series = []

    for day in all_dates:
        day_date = day.date()
        is_month_first = day_date in monthly_dates

        if is_month_first and month_idx > 0:
            contribution = DCA_BASE_MONTHLY + DCA_STEP * (month_idx // DCA_STEP_MONTHS)
            total_contributed += contribution
            idx_price_today = float(idx_aligned.loc[day])
            bench_units += contribution / idx_price_today

        if is_month_first:
            month_idx += 1

        idx_price_now = float(idx_aligned.loc[day])
        bench_wealth = bench_units * idx_price_now

        if is_month_first:
            series.append({
                "month": month_idx - 1,
                "date": day_date.isoformat(),
                "contributed": round(total_contributed),
                "value": round(bench_wealth),
            })

    return series


def compute_wealth_simulation_multi(
    strategy_nav_df: pd.Series,
    benchmarks: dict[str, pd.Series],
    backtest_start: dt.date,
    backtest_end: dt.date,
) -> dict:
    """
    월 DCA 기반 부의 시뮬레이션 — 전략 + 4개 벤치마크.
    """
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

    # Bench units (units × price = wealth)
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

    # Final snapshot values
    final_strat = series[-1]["strategy_value"] if series else round(strat_wealth)
    final_contrib = series[-1]["contributed"] if series else round(total_contributed)

    def gain_pct(final: float) -> float | None:
        return round((final - final_contrib) / final_contrib * 100, 1) if final_contrib else None

    # MDD of strategy wealth sim
    wealth_vals = pd.Series([s["strategy_value"] for s in series])
    sim_mdd = round(float((wealth_vals / wealth_vals.cummax() - 1).min()) * 100, 2) if len(wealth_vals) > 1 else 0.0

    bench_finals = {
        name: series[-1].get(f"{name}_value", 0) for name in benchmarks
    }

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
    if not trades:
        return {}
    returns = sorted([t["return_pct"] for t in trades], reverse=True)
    n = len(returns)
    top10_n = max(1, math.ceil(n * 0.1))
    top_decile = returns[:top10_n]
    total_positive = sum(r for r in returns if r > 0)
    top_decile_positive = sum(r for r in top_decile if r > 0)
    top_decile_pnl_share = (top_decile_positive / total_positive * 100) if total_positive > 0 else 0
    multibaggers = [t for t in trades if t["return_pct"] >= 400]
    doublers = [t for t in trades if t["return_pct"] >= 100]
    top_trades = sorted(trades, key=lambda t: t["return_pct"], reverse=True)[:top10_n]
    avg_hold_top = round(sum(t["days"] for t in top_trades) / len(top_trades), 1) if top_trades else None
    return {
        "total_trades": n,
        "top_decile_n": top10_n,
        "top_decile_pnl_share_pct": round(top_decile_pnl_share, 1),
        "top_decile_avg_return_pct": round(sum(top_decile) / len(top_decile), 1) if top_decile else None,
        "multibagger_count": len(multibaggers),
        "doubler_count": len(doublers),
        "top_decile_avg_hold_days": avg_hold_top,
        "top10_trades": [
            {"ticker": t["ticker"], "return_pct": t["return_pct"], "days": t["days"], "n_clubs": t.get("n_clubs", 1)}
            for t in sorted(trades, key=lambda t: t["return_pct"], reverse=True)[:10]
        ],
    }


def compute_consensus_stats(trades: list[dict]) -> dict:
    if not trades:
        return {}
    single = [t for t in trades if t.get("n_clubs", 1) == 1]
    multi = [t for t in trades if t.get("n_clubs", 1) >= 2]

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
        & (perf["report_date"] >= UNIVERSE_START.isoformat())  # Task 1: filter ≥2019-07-01
    ]
    perf["ticker"] = perf["ticker"].astype(str).str.zfill(6)
    print(f"  {len(perf)} buy reports from {perf.report_date.min()} to {perf.report_date.max()}", flush=True)

    # Build ticker -> club count (for consensus)
    ticker_club_count: dict[str, int] = perf.groupby("ticker")["school"].nunique().to_dict()

    # Load all stock prices
    print("Loading stock prices...", flush=True)
    prices: dict[str, pd.DataFrame] = {}
    for _, row in perf.iterrows():
        ticker = row["ticker"]
        if ticker not in prices:
            df = load_prices(ticker)
            if df is not None:
                prices[ticker] = df

    # Build reports list: (report_date, ticker, source, n_clubs)
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

    # Trading calendar (all KR stock trading days)
    calendar = sorted({ts.date() for df in prices.values() for ts in df.index})
    if not calendar:
        print("ERROR: no calendar dates", flush=True)
        return 1
    print(f"  Calendar: {calendar[0]} to {calendar[-1]}", flush=True)

    # Load benchmark data
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

    # Compute all-weather index
    strat_start = calendar[0]
    strat_end = calendar[-1]
    all_weather = compute_all_weather(kospi, sp500, nasdaq, gld, strat_start, strat_end)
    print(f"  All-weather computed: {all_weather.index[0].date()} to {all_weather.index[-1].date()}", flush=True)

    # ── Strategy A: Immediate entry + 12mo hold (baseline / naive)
    print("\nRunning Strategy A: Immediate 12mo hold (baseline)...", flush=True)
    result_a = run_immediate_hold(prices, reports, calendar, hold_months=12, consensus_only=False, label="A_immediate_12mo")
    print(f"  IS: total={result_a['in_sample'].get('total_return_pct')}% sharpe={result_a['in_sample'].get('sharpe')} mdd={result_a['in_sample'].get('mdd_pct')}%", flush=True)
    print(f"  OOS: total={result_a['out_of_sample'].get('total_return_pct')}% sharpe={result_a['out_of_sample'].get('sharpe')} mdd={result_a['out_of_sample'].get('mdd_pct')}%", flush=True)

    # ── Strategy B: Immediate entry + 18mo hold
    print("\nRunning Strategy B: Immediate 18mo hold...", flush=True)
    result_b = run_immediate_hold(prices, reports, calendar, hold_months=18, consensus_only=False, label="B_immediate_18mo")
    print(f"  IS: total={result_b['in_sample'].get('total_return_pct')}% sharpe={result_b['in_sample'].get('sharpe')} mdd={result_b['in_sample'].get('mdd_pct')}%", flush=True)
    print(f"  OOS: total={result_b['out_of_sample'].get('total_return_pct')}% sharpe={result_b['out_of_sample'].get('sharpe')} mdd={result_b['out_of_sample'].get('mdd_pct')}%", flush=True)

    # ── Strategy C: Equal-weight monthly rebalanced
    print("\nRunning Strategy C: Equal-weight monthly rebalanced...", flush=True)
    result_c = run_equal_weight_monthly(prices, reports, calendar, label="C_ew_monthly")
    print(f"  IS: total={result_c['in_sample'].get('total_return_pct')}% sharpe={result_c['in_sample'].get('sharpe')} mdd={result_c['in_sample'].get('mdd_pct')}%", flush=True)
    print(f"  OOS: total={result_c['out_of_sample'].get('total_return_pct')}% sharpe={result_c['out_of_sample'].get('sharpe')} mdd={result_c['out_of_sample'].get('mdd_pct')}%", flush=True)

    # ── Strategy D: Consensus only (≥2 clubs), 12mo hold
    print("\nRunning Strategy D: Consensus-only 12mo hold...", flush=True)
    result_d = run_immediate_hold(prices, reports, calendar, hold_months=12, consensus_only=True, label="D_consensus_12mo")
    print(f"  IS: total={result_d['in_sample'].get('total_return_pct')}% sharpe={result_d['in_sample'].get('sharpe')} mdd={result_d['in_sample'].get('mdd_pct')}%", flush=True)
    print(f"  OOS: total={result_d['out_of_sample'].get('total_return_pct')}% sharpe={result_d['out_of_sample'].get('sharpe')} mdd={result_d['out_of_sample'].get('mdd_pct')}%", flush=True)

    # ── Strategy E: v3 breakout + ATR ratchet (original)
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

    # Sensitivity grid for E (in-sample optimisation only)
    sensitivity: list[dict] = []
    headline_result_e: dict | None = None
    for atr_mult in (2.0, 3.0, 4.0, 5.0):
        for use_regime in (False, True):
            r = run_breakout_backtest(prices, by_signal_date, breakout_cal, atr_mult, regime if use_regime else None, use_ratchet=True, label=f"E_atr{atr_mult}_regime{'on' if use_regime else 'off'}")
            entry = {"atr_mult": atr_mult, "regime_filter": use_regime, **r["metrics"],
                     "is_sharpe": r["in_sample"].get("sharpe"), "is_cagr": r["in_sample"].get("cagr_pct"),
                     "oos_sharpe": r["out_of_sample"].get("sharpe"), "oos_cagr": r["out_of_sample"].get("cagr_pct")}
            sensitivity.append(entry)
            print(
                f"  E ATRx{atr_mult} regime={'on' if use_regime else 'off'}: "
                f"total={entry['total_return_pct']}% IS-sharpe={entry['is_sharpe']} OOS-sharpe={entry['oos_sharpe']}",
                flush=True,
            )
            if atr_mult == HEADLINE_ATR_MULT and use_regime == HEADLINE_REGIME:
                headline_result_e = r

    assert headline_result_e is not None
    result_e = headline_result_e
    result_e["label"] = "E_breakout_atr4"

    # ── Select headline strategy (IS sharpe comparison)
    candidates = [result_a, result_b, result_c, result_d, result_e]
    # Pick by IS sharpe, fallback to total return
    def is_sharpe(r: dict) -> float:
        v = r.get("in_sample", {}).get("sharpe")
        return v if v is not None else -999.0

    headline = max(candidates, key=is_sharpe)
    headline_label = headline["label"]
    print(f"\nHeadline strategy (best IS sharpe): {headline_label}", flush=True)

    # Summary table
    print("\n── Strategy summary ──────────────────────────────────────────────", flush=True)
    print(f"{'Strategy':<30} {'IS CAGR':>9} {'IS Sharpe':>10} {'OOS CAGR':>10} {'OOS Sharpe':>11}", flush=True)
    for r in candidates:
        is_m = r.get("in_sample", {})
        oos_m = r.get("out_of_sample", {})
        print(
            f"  {r['label']:<28} {str(is_m.get('cagr_pct', '—')):>9} {str(is_m.get('sharpe', '—')):>10} "
            f"{str(oos_m.get('cagr_pct', '—')):>10} {str(oos_m.get('sharpe', '—')):>11}",
            flush=True,
        )

    # ── Tail and consensus stats for headline
    tail_stats = compute_tail_stats(headline.get("trades", []))
    consensus_stats = compute_consensus_stats(headline.get("trades", []))

    # ── Wealth simulation (multi-benchmark)
    print("\nComputing wealth simulations...", flush=True)
    headline_nav: pd.Series = headline["nav_df"]

    benchmarks_for_sim: dict[str, pd.Series] = {
        "KOSPI": kospi,
        "SP500": sp500,
        "NASDAQ": nasdaq,
        "AllWeather": all_weather,
    }
    wealth_sim = compute_wealth_simulation_multi(headline_nav, benchmarks_for_sim, strat_start, strat_end)

    print(f"  Strategy final: {wealth_sim['final_strategy_value']:,}원", flush=True)
    for name, val in wealth_sim["final_benchmark_values"].items():
        gain = wealth_sim["benchmark_gain_on_contributed_pct"].get(name)
        print(f"  {name} final: {val:,}원 ({gain}%)", flush=True)

    # ── Assemble all strategy metrics for research report
    research_families: list[dict] = []
    for r in candidates:
        research_families.append({
            "label": r["label"],
            "metrics": r["metrics"],
            "in_sample": r.get("in_sample", {}),
            "out_of_sample": r.get("out_of_sample", {}),
        })

    # ── Build final payload
    open_positions_list = []
    if "open_positions" in headline and isinstance(headline["open_positions"], dict):
        for t, p in headline["open_positions"].items():
            open_positions_list.append({
                "ticker": t,
                "entry_date": p["entry_date"].isoformat() if hasattr(p.get("entry_date"), "isoformat") else str(p.get("entry_date", "")),
                "entry": round(p["entry_price"], 2),
                "last_close": round(p["last_close"], 2),
                "stop": round(p.get("stop", 0), 2),
                "return_pct": round((p["shares"] * p["last_close"] / p["cost"] - 1) * 100, 2),
                "source": p.get("source", ""),
                "n_clubs": p.get("n_clubs", 1),
            })

    payload = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "universe_filter": f"rating_class == buy AND report_date >= {UNIVERSE_START.isoformat()}",
        "params": {
            "universe_start": UNIVERSE_START.isoformat(),
            "is_period": f"{UNIVERSE_START.isoformat()} ~ {IS_END.isoformat()}",
            "oos_period": f"{OOS_START.isoformat()} ~ present",
            "atr_period": ATR_PERIOD,
            "max_positions": MAX_POSITIONS,
            "position_weight": POSITION_WEIGHT,
            "cost_per_side": COST_PER_SIDE,
            "headline_strategy": headline_label,
            # v3 breakout params preserved
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
        "tail_stats": tail_stats,
        "consensus_stats": consensus_stats,
        "wealth_sim": wealth_sim,
        "best_trades": sorted(headline.get("trades", []), key=lambda t: t["return_pct"], reverse=True)[:5],
        "worst_trades": sorted(headline.get("trades", []), key=lambda t: t["return_pct"])[:5],
        "open_positions": open_positions_list,
    }

    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nWrote {OUT_PATH.relative_to(ROOT).as_posix()}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
