"""학회 리포트 × 전략 연구 백테스트 v15.

변경사항 (v15):
- S 포트폴리오 최적화 침묵 실패 수정: scipy/sklearn 미설치 시 _msharpe/_mincvar의
  함수 내부 import 실패가 월별 try/except에 삼켜져 NAV가 1.0 평탄(거래 0건)으로
  출력되던 버그. run_portfolio_opt 시작 시 의존성 프리플라이트 체크 → 즉시
  RuntimeError로 크게 실패. requirements.txt에 scipy/scikit-learn 추가.
- 오늘의 신호 의미 재정의: 헤드라인(SOTA) 전략이 지금 규칙대로 굴러갈 때
  임박한 매매만 표시.
    매수 임박 = 최근 5거래일 내 발간된 buy 리포트 중 미보유 + 슬롯 여유.
    매도 임박 = 트레일링 스탑 3% 이내 + 스탑 이미 터치(stop_hit).
    보유 중 = 현 포지션 + 스탑 레벨 + 과열계수.
    레짐 상태(T- 헤드라인): KOSPI vs 200MA — OFF면 파킹 수익 0%(현금) 명시.
    대기(watching) 목록은 카운트만 유지(리포트 흐름이지 전략 신호가 아님).
- 레거시 필드 제거: sensitivity(빈 배열, v8부터 dead) 페이로드에서 삭제.

변경사항 (v12):
- Q. 깡토 추세추종: 시장 신호등(KOSPI 200MA+50MA상승), 유닛 사이징(총자본/20, Max 2% Rule),
  진입=RS퍼센타일≥KOSPI RS AND 60d고가돌파 AND 거래량≥1.5×20d평균,
  청산=-8%초기스탑/BE at+1R/트레일 고점-8% at+1.5R/절반익절 +3R.
  보고 항목: win rate, vs KOSPI DCA. 추세형 그룹.
- R. Kelly 샹들리에: D+ Chandelier 규칙 + Kelly 포지션 사이징
  (rolling 최근 40거래 win_rate/payoff → fractional Kelly, cap 0.25, safety 0.5, floor 1%).
  오버레이 그룹.
- S. 포트폴리오 최적화 (월간 리밸런스): 활성 유니버스(18mo 유효)에 대해 trailing 252d 일별 수익률 사용.
  (a) S_hrp: HRP (hierarchical risk parity — 직접 구현, corr distance, single-linkage, quasi-diag, iv-split),
  (b) S_msharpe: max-Sharpe (mean-variance, LedoitWolf 수축 또는 λ=0.3 diagonal, long-only w≤15%),
  (c) S_mincvar: min-CVaR (95%, scipy linprog LP, long-only w≤15%).
  월 리밸런스, 턴오버 비용. IS 샤프 최상 변형만 셀렉터에 포함. 배분형 그룹.
- 비교표에 "vs KOSPI DCA" 최종 자산 비율 열 추가.
- 방법론 주석: 장중 데이터 미도입(데이터 부재) 및 SPO 보류(미래 작업) 1줄씩 명시.

변경사항 (v11):
- MTT 룩어헤드 감사 및 수정: O 전략 진입 시그널을 당일 종가 기준으로 포착,
  실제 체결은 익일 시가로 처리 (동일 바 룩어헤드 제거).
  _compute_rs_percentiles: 당일 종가+과거 데이터만 사용 — 점검 결과 문제 없음.
  52w 고/저, MA 등 rolling window 지표: load_prices에서 look-forward 없이 계산 확인.
  히스토리컬 가격 파일에 상장폐지 종목 포함 여부: 프라이스 파일이 존재하는 종목만
  유니버스에 포함 → 생존 편향 존재하나 피할 수 없음, 방법론 주석에 명시.
- L 민리버전 RSI-2: 동일 바 룩어헤드 수정 (시그널→익일 시가 체결).
  그러나 수정 후에도 0.6% 왕복 비용 × 단기 회전율 → 비용 사망 확인 → 제외.
- M 단기 리버설: positions.clear() 버그 수정 (미청산 포지션 현금 미회수 문제),
  동일 바 룩어헤드 수정. 수정 후에도 월별 전체 교체 비용 사망 → 제외.
  방법론: "RSI-2 민리버전·단기 리버설은 거래비용으로 사망 — 구현 검증 후 제외"
- 신규 전략 P: 딥바이 샹들리에 하이브리드 ("P_deepbuy_chandelier").
  진입 = G 딥바이 (발간일 종가 대비 ≥20% 하락, 6개월 내),
  규모 추가 = 최초 진입 후 추가 10% 하락 시 동일 슬롯에 1회 한정 추가 매수,
  청산 = D+ 샹들리에 Optuna 파라미터 ATR 트레일링 스탑 (타겟가 캡 없음).
  최고점 기준 통합 포지션 스탑 관리.

변경사항 (v10):
- Optuna 탐색공간 이산화: suggest_float에 step= 추가 (ATR mult step 0.25, 0.05 등).
  파라미터를 소수점 2자리로 반올림하여 보고.
- 신규 전략 O: MTT (alpha16 이식) - 알파16 논문 Minervini MTT를 OUR 유니버스에 이식.
  RS 퍼센타일(3m*0.5/6m*0.3/12m*0.2), MTT 필터(close>50MA>150MA>200MA, 200MA상승,
  52w저점*1.9 이상, 52w고점*0.95 이상, RS>=80), 진입 RS>=79, 청산(-8%초기스탑/BE/6%트레일/+3.5R/RS<82 후 8일/115일).
  동일 유니버스(리포트 후 18개월 유효풀), 5%/20슬롯 동일비중, 추세형 그룹 추가.
  [출처 공개: alpha16 RobustOpt KRX 파라미터 - KRX 전체 종목으로 튜닝된 값, OUR 데이터 미사용]
- 재매수 규칙 명시: 청산 후 동일 티커 재진입 허용 (패밀리 진입 조건 재충족 시).
  기존 open_positions 체크는 현재 보유 중 여부만 확인 -> OK.
  단, 리포트 구동 패밀리는 신규 리포트 OR 18개월 유효창 내 기술적 재충족 시 재진입.
- 신규 전략 L (민리버전 Connors RSI-2), M (단기 리버설 월별 하위 5분위), N (52주 고가 근접 George & Hwang 2004).
- RSI(2) 지표를 load_prices에 추가.

변경사항 (v9):
- 오늘의 신호: 헤드라인 전략(D 샹들리에) 기준으로 변경.
- Optuna 강건 최적화: 샹들리에 패밀리 파라미터 (ATR 기간, 배수, 래칫, 최대 포지션).

변경사항 (v8):
- 유니버스 확대: >=2개교 컨센서스 게이트 제거 -> 1회 언급(단독 커버 포함) 즉시 진입.
    컨센서스는 분석 통계(consensus_stats)로만 유지 - 진입 조건 아님.
    동일 티커 중복 진입 방지: 이미 오픈된 포지션이 있으면 스킵.
- 전략별 open_positions 추가: multi_strategy.open_positions_by_strategy 에 현재 보유 상태 포함.
- 레거시 신고가 돌파 민감도 분석(sensitivity) 제거 - dead weight.
- 11가지 전략(A~K) 동일 유니버스에서 재계산.
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
    # ATR(20) for K R:R strategy
    df["atr20"] = tr.rolling(20, min_periods=10).mean()
    # ATR(14) for extension gauge (U 과열 스케일아웃)
    df["atr14"] = tr.rolling(14, min_periods=7).mean()
    ret = df["close"].pct_change()
    df["sharpe90"] = ret.rolling(90, min_periods=45).mean() / ret.rolling(90, min_periods=45).std() * math.sqrt(252)
    # Moving averages for various strategies
    df["ma50"]  = df["close"].rolling(50,  min_periods=25).mean()
    df["ma150"] = df["close"].rolling(150, min_periods=75).mean()
    df["ma200"] = df["close"].rolling(200, min_periods=100).mean()
    # 52-week high/low
    df["hi52w"] = df["high"].rolling(252, min_periods=126).max()
    df["lo52w"] = df["low"].rolling(252, min_periods=126).min()
    # Supertrend(10, 3): standard Supertrend indicator
    #   basic upper/lower bands = hl2 ± multiplier * ATR(period)
    _atr10 = tr.rolling(10, min_periods=5).mean()
    _hl2 = (df["high"] + df["low"]) / 2
    _upper = _hl2 + 3.0 * _atr10
    _lower = _hl2 - 3.0 * _atr10
    # Supertrend state: True=bullish, False=bearish
    _final_upper = _upper.copy()
    _final_lower = _lower.copy()
    _trend = pd.Series(True, index=df.index)
    for i in range(1, len(df)):
        prev_fu = _final_upper.iloc[i - 1]
        prev_fl = _final_lower.iloc[i - 1]
        cu = _upper.iloc[i]
        cl = _lower.iloc[i]
        prev_close = df["close"].iloc[i - 1]
        # Adjust bands
        _final_upper.iloc[i] = min(cu, prev_fu) if prev_close <= prev_fu else cu
        _final_lower.iloc[i] = max(cl, prev_fl) if prev_close >= prev_fl else cl
        # Determine trend
        prev_trend = _trend.iloc[i - 1]
        close_now = df["close"].iloc[i]
        if prev_trend:
            _trend.iloc[i] = close_now >= _final_lower.iloc[i]
        else:
            _trend.iloc[i] = close_now > _final_upper.iloc[i]
    df["supertrend_bull"] = _trend
    df["supertrend_upper"] = _final_upper
    df["supertrend_lower"] = _final_lower
    # RSI(2) for Connors mean-reversion (L strategy)
    delta = df["close"].diff()
    gain = delta.clip(lower=0)
    loss = (-delta).clip(lower=0)
    avg_gain = gain.ewm(com=1, adjust=False).mean()   # Wilder EMA with α=1/2
    avg_loss = loss.ewm(com=1, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, float("nan"))
    df["rsi2"] = 100 - 100 / (1 + rs)
    df["rsi2"] = df["rsi2"].fillna(50.0)
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
    """Immediate entry, sell after hold_months. All single reports OK (v8: no consensus gate)."""
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    scheduled_exits: dict[str, dt.date] = {}

    pending_entries = build_pending_entries(reports, calendar, consensus_only=False)

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
    진입: 단독 커버 포함 즉시 진입 (v8: 컨센서스 게이트 제거)
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

    pending_entries = build_pending_entries(reports, calendar, consensus_only=False)

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
    진입: 단독 커버 포함 즉시 진입 (v8: 컨센서스 게이트 제거)
    청산: close < (highest_high_since_entry - ATR(42) × 5)
    Chandelier Exit (Le Beau) — 문헌 표준값 ATR×5
    """
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    pending_exits: set[str] = set()

    pending_entries = build_pending_entries(reports, calendar, consensus_only=False)

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
    진입: 단독 커버 포함 즉시 진입 (v8: 컨센서스 게이트 제거)
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

    pending_entries = build_pending_entries(reports, calendar, consensus_only=False)

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
# Strategy G: 딥바이 — dip-buy on ≥20% pullback after report
# Single-club OK (dip itself is the filter).
# Entry: price falls ≥20% below publication-day close within 6 months.
# Exit: club target price OR +50% OR 12mo OR ATR×3 trailing stop (whichever first).
# Reference: mean-reversion after analyst catalyst (Jegadeesh & Kim 2006 framing).
# ──────────────────────────────────────────────────────────────────────────────

DIP_THRESHOLD = 0.20        # 20% below report-day close
DIP_WINDOW_DAYS = 180       # watch window
DIP_EXIT_PCT = 0.50         # +50% profit target
DIP_HOLD_MONTHS = 12        # max hold
DIP_ATR_MULT = 3.0          # trailing stop multiplier

def run_dip_buy(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    label: str,
    ticker_reports: dict[str, list[dict]] | None = None,
    record_full_trades: bool = False,
) -> dict:
    """
    단독 커버 OK (딥이 필터).
    진입: 발간일 종가 대비 ≥20% 하락 시점 (6개월 내), 다음 거래일 시가 매수.
    청산: 목표가 / +50% / 12개월 / ATR×3 트레일 중 선착.
    """
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    pending_exits: set[str] = set()

    # Build per-ticker dip-watch queue: {ticker: [(report_date, pub_day_close, target_price, display_name, n_clubs, source)]}
    dip_watch: dict[str, list[dict]] = {}
    cal_set = set(calendar)
    for rdate, ticker, source, n_clubs in reports:
        if rdate < SIM_START - dt.timedelta(days=DIP_WINDOW_DAYS):
            continue
        df = prices.get(ticker)
        if df is None:
            continue
        # publication-day close (asof)
        pub_close = asof_value(df["close"], rdate)
        if pub_close <= 0:
            continue
        tr_list = (ticker_reports or {}).get(ticker, [])
        past_tr = [x for x in tr_list if x["report_date"] <= rdate]
        tp = max((x["target_price"] for x in past_tr if x["target_price"]), default=None)
        dn = past_tr[-1]["display_name"] if past_tr else ticker
        market = past_tr[0].get("market", "KR") if past_tr else "KR"
        dip_watch.setdefault(ticker, []).append({
            "report_date": rdate,
            "pub_close": pub_close,
            "expire_date": rdate + dt.timedelta(days=DIP_WINDOW_DAYS),
            "target_price": tp,
            "display_name": dn,
            "n_clubs": n_clubs,
            "source": source,
            "market": market,
        })

    # Flag set: ticker -> next-day entry queued
    dip_entry_queue: list[tuple[str, dict]] = []

    for day in calendar:
        day_ts = pd.Timestamp(day)

        # Execute pending exits (trailing stop or other)
        to_exit = [t for t in list(pending_exits) if t in positions]
        for ticker in to_exit:
            pos = positions[ticker]
            q = _get_quote(prices, ticker, day)
            if q is None or float(q["open"]) <= 0:
                continue
            exit_price = float(q["open"])
            cash += pos["shares"] * exit_price * (1 - COST_PER_SIDE)
            trades.append(_close_trade(ticker, pos, day, exit_price, pos.get("_exit_reason", "dip_atr3_stop"),
                                       ticker_reports, record_full_trades, None))
            del positions[ticker]
            pending_exits.discard(ticker)

        # Execute dip entries queued from previous day's check
        if dip_entry_queue:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            slots = MAX_POSITIONS - len(positions)
            for ticker, watch in dip_entry_queue[:slots]:
                if ticker in positions:
                    continue
                df = prices.get(ticker)
                if df is None:
                    continue
                if day_ts not in df.index:
                    continue
                q = df.loc[day_ts]
                entry_price = float(q["open"])
                if entry_price <= 0:
                    continue
                budget = min(nav_now * POSITION_WEIGHT, cash)
                if budget < nav_now * POSITION_WEIGHT * 0.5:
                    continue
                shares = budget * (1 - COST_PER_SIDE) / entry_price
                cash -= budget
                atr_val = asof_value(df["atr"], day)
                stop = entry_price - DIP_ATR_MULT * atr_val if atr_val else entry_price * 0.80
                pos = {
                    "shares": shares, "entry_price": entry_price, "entry_date": day,
                    "cost": budget, "last_close": entry_price, "highest": entry_price,
                    "source": watch["source"], "n_clubs": watch["n_clubs"],
                    "display_name": watch["display_name"], "market": watch["market"],
                    "target_price": watch["target_price"], "stop": stop,
                    "max_hold_date": months_later(day, DIP_HOLD_MONTHS),
                    "half_sold": False, "half_sell_price": None,
                }
                positions[ticker] = pos
            dip_entry_queue = []

        # Scan dip-watch for new triggers
        for ticker, watches in dip_watch.items():
            if ticker in positions:
                continue
            df = prices.get(ticker)
            if df is None or day_ts not in df.index:
                continue
            close_today = float(df.loc[day_ts]["close"])
            for watch in watches:
                if day < watch["report_date"] or day > watch["expire_date"]:
                    continue
                dip_level = watch["pub_close"] * (1 - DIP_THRESHOLD)
                if close_today <= dip_level:
                    dip_entry_queue.append((ticker, watch))
                    break  # one entry per ticker per day

        # Update positions + check exits
        for ticker, pos in list(positions.items()):
            df = prices.get(ticker)
            if df is None or day_ts not in df.index:
                continue
            close = float(df.loc[day_ts]["close"])
            high_today = float(df.loc[day_ts].get("high", close))
            pos["last_close"] = close
            pos["highest"] = max(pos.get("highest", close), close)

            # Trailing stop ratchet
            atr_val = asof_value(df["atr"], day)
            if atr_val:
                new_stop = pos["highest"] - DIP_ATR_MULT * atr_val
                pos["stop"] = max(pos.get("stop", 0.0), new_stop)

            exit_reason = None
            exit_price_override = None

            # ATR trailing stop
            if pos.get("stop") and close < pos["stop"]:
                exit_reason = "dip_atr3_stop"

            # +50% profit target
            elif high_today >= pos["entry_price"] * (1 + DIP_EXIT_PCT):
                exit_reason = "dip_+50pct"
                exit_price_override = pos["entry_price"] * (1 + DIP_EXIT_PCT)

            # Club target price
            elif pos.get("target_price") and high_today >= pos["target_price"]:
                exit_reason = "dip_목표가"
                exit_price_override = pos["target_price"]

            # Max hold
            elif day >= pos["max_hold_date"]:
                exit_reason = "dip_12mo_만기"

            if exit_reason and ticker not in pending_exits:
                if exit_price_override:
                    # Immediate same-day close at override price
                    ep = min(exit_price_override, close)
                    cash += pos["shares"] * ep * (1 - COST_PER_SIDE)
                    trades.append(_close_trade(ticker, pos, day, ep, exit_reason,
                                               ticker_reports, record_full_trades, None))
                    del positions[ticker]
                else:
                    pos["_exit_reason"] = exit_reason
                    pending_exits.add(ticker)

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    last_day = calendar[-1]
    for ticker, pos in list(positions.items()):
        trades.append(_close_trade(ticker, pos, last_day, pos["last_close"], "데이터_종료_미청산",
                                   ticker_reports, record_full_trades, None))

    return _compute_result(nav_series, trades, START_CAPITAL, label, open_positions=positions)


# ──────────────────────────────────────────────────────────────────────────────
# Strategy H: 미너비니 트렌드 템플릿
# Consensus ≥2 required at entry.
# Entry conditions (all must hold on entry day):
#   close > 50MA > 150MA > 200MA
#   200MA rising vs 1 month ago
#   close ≥ 70% of 52w high
#   RS(6mo) vs KOSPI > 0
# Exit: close < 50MA on weekly check (Friday close).
# Reference: Minervini (2013) "Trade Like a Stock Market Wizard"
# ──────────────────────────────────────────────────────────────────────────────

def run_minervini(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    label: str,
    ticker_reports: dict[str, list[dict]] | None = None,
    record_full_trades: bool = False,
    kospi: pd.Series | None = None,
) -> dict:
    """
    미너비니 트렌드 템플릿. 진입: 단독 커버 포함 + 5-point template (v8: 컨센서스 게이트 제거).
    청산: 주간(금요일) 체크 시 close < 50MA.
    """
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    pending_exits: set[str] = set()

    pending_entries = build_pending_entries(reports, calendar, consensus_only=False)

    # Weekly check days (Fridays, or last day of week in calendar)
    cal_s = pd.Series(calendar)
    week_ends: set[dt.date] = set(
        cal_s.groupby(cal_s.apply(lambda d: (d.isocalendar()[0], d.isocalendar()[1]))).last().values
    )

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
            trades.append(_close_trade(ticker, pos, day, exit_price, "minervini_close<50MA",
                                       ticker_reports, record_full_trades, None))
            del positions[ticker]
            pending_exits.discard(ticker)

        # Execute pending entries — check Minervini template
        if day in pending_entries:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            slots = MAX_POSITIONS - len(positions)
            candidates = list({t: (t, s, nc) for t, s, nc in pending_entries[day] if t not in positions}.values())
            for ticker, source, n_clubs in candidates[:slots]:
                df = prices.get(ticker)
                if df is None or day_ts not in df.index:
                    continue
                q = df.loc[day_ts]
                close = float(q["close"])
                ma50  = asof_value(df["ma50"],  day)
                ma150 = asof_value(df["ma150"], day)
                ma200 = asof_value(df["ma200"], day)
                hi52w = asof_value(df["hi52w"], day)
                if any(v <= 0 for v in [ma50, ma150, ma200, hi52w]):
                    continue
                # Template: close > 50MA > 150MA > 200MA
                if not (close > ma50 > ma150 > ma200):
                    continue
                # 200MA rising vs 1 month ago
                ma200_1mo = asof_value(df["ma200"], day - dt.timedelta(days=30))
                if ma200_1mo <= 0 or ma200 <= ma200_1mo:
                    continue
                # Price ≥ 70% of 52w high
                if close < 0.70 * hi52w:
                    continue
                # RS vs KOSPI positive over 6mo
                if kospi is not None:
                    price_6mo_ago = asof_value(df["close"], day - dt.timedelta(days=182))
                    kospi_6mo_ago = asof_value(kospi, day - dt.timedelta(days=182))
                    kospi_now = asof_value(kospi, day)
                    if price_6mo_ago > 0 and kospi_6mo_ago > 0 and kospi_now > 0:
                        stock_rs = close / price_6mo_ago - 1
                        kospi_rs = kospi_now / kospi_6mo_ago - 1
                        if stock_rs <= kospi_rs:
                            continue
                pos, cash = _try_enter(ticker, source, n_clubs, day, prices, positions, cash, nav_now, ticker_reports)
                if pos is not None:
                    positions[ticker] = pos

        # Update last_close
        for ticker, pos in positions.items():
            df = prices.get(ticker)
            if df is not None and day_ts in df.index:
                pos["last_close"] = float(df.loc[day_ts]["close"])

        # Weekly check: exit if close < 50MA
        if day in week_ends:
            for ticker, pos in list(positions.items()):
                df = prices.get(ticker)
                if df is None:
                    continue
                close = pos["last_close"]
                ma50_val = asof_value(df["ma50"], day)
                if ma50_val > 0 and close < ma50_val:
                    pending_exits.add(ticker)

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    last_day = calendar[-1]
    for ticker, pos in list(positions.items()):
        trades.append(_close_trade(ticker, pos, last_day, pos["last_close"], "데이터_종료_미청산",
                                   ticker_reports, record_full_trades, None))

    return _compute_result(nav_series, trades, START_CAPITAL, label, open_positions=positions)


# ──────────────────────────────────────────────────────────────────────────────
# Strategy I: 슈퍼트렌드(10, 3)
# Consensus ≥2 required.
# Entry: Supertrend is bullish on report day OR first bullish flip within 3mo.
# Exit: Supertrend flips bearish.
# Reference: Supertrend indicator (Olivier Seban popularised; standard (10, 3) params).
# ──────────────────────────────────────────────────────────────────────────────

SUPERTREND_WINDOW_DAYS = 90   # 3mo window to wait for bullish flip after report

def run_supertrend(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    label: str,
    ticker_reports: dict[str, list[dict]] | None = None,
    record_full_trades: bool = False,
) -> dict:
    """
    Supertrend(10, 3). 진입: 발간 시 불리시 OR 3개월 내 첫 상향 전환.
    청산: 하향 전환 다음 거래일 시가.
    """
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    pending_exits: set[str] = set()

    # Build per-day ST-watch: tickers waiting for a bullish flip after report
    # st_watch: ticker -> (report_date, expire_date, n_clubs, source)
    st_watch: dict[str, dict] = {}
    pending_entries_direct: dict[dt.date, list[tuple[str, str, int]]] = {}

    for rdate, ticker, source, n_clubs in reports:
        # v8: no consensus gate — single-club OK
        df = prices.get(ticker)
        if df is None:
            continue
        # Check if supertrend is already bullish on report day
        st_val = asof_value(df["supertrend_bull"].astype(float), rdate)
        entry_day = first_trading_day_after(rdate, calendar)
        if st_val >= 0.5:
            # Already bullish → enter immediately
            if entry_day:
                pending_entries_direct.setdefault(entry_day, []).append((ticker, source, n_clubs))
        else:
            # Wait for first bullish flip within 3 months
            expire = rdate + dt.timedelta(days=SUPERTREND_WINDOW_DAYS)
            if ticker not in st_watch or st_watch[ticker]["report_date"] < rdate:
                st_watch[ticker] = {
                    "report_date": rdate, "expire_date": expire,
                    "n_clubs": n_clubs, "source": source,
                }

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
            trades.append(_close_trade(ticker, pos, day, exit_price, "supertrend_bearish_flip",
                                       ticker_reports, record_full_trades, None))
            del positions[ticker]
            pending_exits.discard(ticker)

        # Execute direct entries (supertrend bullish at report)
        if day in pending_entries_direct:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            slots = MAX_POSITIONS - len(positions)
            candidates = list({t: (t, s, nc) for t, s, nc in pending_entries_direct[day] if t not in positions}.values())
            for ticker, source, n_clubs in candidates[:slots]:
                pos, cash = _try_enter(ticker, source, n_clubs, day, prices, positions, cash, nav_now, ticker_reports)
                if pos is not None:
                    positions[ticker] = pos

        # Scan st_watch for bullish flips
        new_direct: list[tuple[str, str, int]] = []
        for ticker, watch in list(st_watch.items()):
            if ticker in positions:
                continue
            if day > watch["expire_date"]:
                del st_watch[ticker]
                continue
            if day < watch["report_date"]:
                continue
            df = prices.get(ticker)
            if df is None or day_ts not in df.index:
                continue
            st_now = bool(df.loc[day_ts]["supertrend_bull"])
            if st_now:
                new_direct.append((ticker, watch["source"], watch["n_clubs"]))
                del st_watch[ticker]

        if new_direct:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            slots = MAX_POSITIONS - len(positions)
            entry_day = first_trading_day_after(day, calendar)
            if entry_day:
                pending_entries_direct.setdefault(entry_day, []).extend(new_direct)

        # Update last_close + check supertrend exit
        for ticker, pos in list(positions.items()):
            df = prices.get(ticker)
            if df is None or day_ts not in df.index:
                continue
            pos["last_close"] = float(df.loc[day_ts]["close"])
            st_now = bool(df.loc[day_ts]["supertrend_bull"])
            if not st_now and ticker not in pending_exits:
                pending_exits.add(ticker)

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    last_day = calendar[-1]
    for ticker, pos in list(positions.items()):
        trades.append(_close_trade(ticker, pos, last_day, pos["last_close"], "데이터_종료_미청산",
                                   ticker_reports, record_full_trades, None))

    return _compute_result(nav_series, trades, START_CAPITAL, label, open_positions=positions)


# ──────────────────────────────────────────────────────────────────────────────
# Strategy J: 코어-새틀라이트 80/20 + 폭락 레버리지 overlay
# Overlay on D (Chandelier) NAV series.
# Allocation: 80% in strategy D, 20% cash buffer.
# When KOSPI drawdown from 52w high ≥ 15%: deploy cash + borrow to 120% equity.
# Borrow cost: 6%/yr accrued daily on borrowed amount.
# Deleverage back to 80/20 when drawdown recovers to < 5%.
# ──────────────────────────────────────────────────────────────────────────────

LEVERAGE_BORROW_RATE = 0.06           # 6% pa
LEVERAGE_DEPLOY_DD = 0.15             # KOSPI -15% from 52w high triggers deploy
LEVERAGE_RECOVER_DD = 0.05            # KOSPI -5% (from 52w high) → deleverage
LEVERAGE_TARGET = 1.20                # 120% of equity at leverage peak
CORE_ALLOCATION = 0.80                # 80% core, 20% cash

def run_core_satellite_leverage(
    chandelier_nav: pd.Series,
    kospi: pd.Series,
    label: str = "J_core_satellite",
) -> dict:
    """
    D 샹들리에 NAV 오버레이.
    80% 코어(D), 20% 현금. KOSPI 52w 고점 대비 -15% 시 레버리지 120% 전개.
    차입비용 6%/년 일 단위 적립. 복구 시(-5% 미만) 디레버.
    """
    START_CAPITAL = 100_000_000
    # Normalise chandelier NAV to returns
    chan_ret = chandelier_nav.pct_change().fillna(0)

    idx = chandelier_nav.index
    kospi_aligned = kospi.reindex(idx).ffill().bfill()
    kospi_hi52 = kospi_aligned.rolling(252, min_periods=1).max()

    equity = float(START_CAPITAL)
    # core_units: how many "shares" of the chandelier strategy we hold
    core_units = equity * CORE_ALLOCATION  # notional
    cash_buffer = equity * (1 - CORE_ALLOCATION)
    borrowed = 0.0
    is_leveraged = False

    nav_series: list[tuple[str, float]] = []

    for i, ts in enumerate(idx):
        day_ts = ts
        day = ts.date()

        # Compute KOSPI drawdown
        kp = float(kospi_aligned.loc[day_ts])
        kp_hi = float(kospi_hi52.loc[day_ts])
        kospi_dd = (kp / kp_hi - 1) if kp_hi > 0 else 0.0

        cr = float(chan_ret.iloc[i])

        if not is_leveraged:
            # Normal 80/20: core grows with chandelier return
            core_units *= (1 + cr)
            # Check if we should leverage
            if kospi_dd <= -LEVERAGE_DEPLOY_DD and cash_buffer > 0:
                # Deploy cash + borrow to get to 120% of current equity
                total_equity = core_units + cash_buffer
                target_core = total_equity * LEVERAGE_TARGET
                additional = target_core - core_units
                # First use cash, then borrow rest
                from_cash = min(cash_buffer, additional)
                from_borrow = additional - from_cash
                core_units += additional
                cash_buffer -= from_cash
                borrowed = from_borrow
                is_leveraged = True
        else:
            # Leveraged: core grows, borrow cost accrues
            core_units *= (1 + cr)
            borrow_cost_daily = borrowed * LEVERAGE_BORROW_RATE / 365
            borrowed += borrow_cost_daily
            cash_buffer -= borrow_cost_daily  # cost comes from cash; can go negative

            # Check if we should deleverage
            if kospi_dd > -LEVERAGE_RECOVER_DD:
                # Sell down core to 80% of net equity and repay borrow
                net_equity = core_units + cash_buffer - borrowed
                target_core = net_equity * CORE_ALLOCATION
                excess = core_units - target_core
                cash_freed = max(0.0, excess)
                core_units = target_core
                cash_buffer += cash_freed
                # Repay borrow with cash
                repay = min(borrowed, cash_buffer)
                borrowed -= repay
                cash_buffer -= repay
                if borrowed < 0:
                    borrowed = 0.0
                is_leveraged = False

        nav = core_units + cash_buffer - borrowed
        nav_series.append((day.isoformat(), nav))

    # Build dummy trades list (overlay has no discrete trades)
    trades: list[dict] = []

    return _compute_result(nav_series, trades, START_CAPITAL, label, open_positions={})


# ──────────────────────────────────────────────────────────────────────────────
# Strategy K: R:R 2.5 추세추종 (risk-defined fast trading)
# Consensus ≥2.
# Entry: open next day after report signal.
# Stop: entry − 1×ATR(20) = 1R.
# Take half at +2.5R.
# Trail remainder with Chandelier ATR×3.
# Max 10 concurrent positions (concentration).
# Reference: Van Tharp "Trade Your Way to Financial Freedom" R-multiple framework.
# ──────────────────────────────────────────────────────────────────────────────

RR_STOP_MULT = 1.0          # 1R stop = 1×ATR(20)
RR_TARGET_MULT = 2.5        # half off at +2.5R
RR_TRAIL_ATR_MULT = 3.0     # trail rest with ATR(42)×3 chandelier
RR_MAX_POSITIONS = 10       # max 10 concurrent positions

def run_rr_trend(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    label: str,
    ticker_reports: dict[str, list[dict]] | None = None,
    record_full_trades: bool = False,
) -> dict:
    """
    R:R 2.5 추세추종. Stop = 1×ATR(20). 반절 +2.5R. 나머지 Chandelier ATR×3 트레일.
    동시 최대 10종목. v8: 단독 커버 포함.
    """
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    pending_exits: dict[str, str] = {}  # ticker -> reason

    pending_entries = build_pending_entries(reports, calendar, consensus_only=False)

    for day in calendar:
        day_ts = pd.Timestamp(day)

        # Execute pending exits
        to_exit = [t for t in list(pending_exits) if t in positions]
        for ticker in to_exit:
            pos = positions[ticker]
            reason = pending_exits.pop(ticker)
            q = _get_quote(prices, ticker, day)
            if q is None or float(q["open"]) <= 0:
                pending_exits[ticker] = reason  # defer
                continue
            exit_price = float(q["open"])
            # How many shares remain?
            shares = pos["shares"]
            cost = pos["cost"] * (shares / pos.get("original_shares", shares))
            cash += shares * exit_price * (1 - COST_PER_SIDE)
            trades.append(_close_trade(ticker, pos, day, exit_price, reason,
                                       ticker_reports, record_full_trades, None,
                                       shares_override=shares, cost_override=cost))
            del positions[ticker]

        # Execute pending entries (max 10 positions)
        if day in pending_entries:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            slots = RR_MAX_POSITIONS - len(positions)
            candidates = list({t: (t, s, nc) for t, s, nc in pending_entries[day] if t not in positions}.values())
            for ticker, source, n_clubs in candidates[:slots]:
                df = prices.get(ticker)
                if df is None or day_ts not in df.index:
                    continue
                q = df.loc[day_ts]
                entry_price = float(q["open"])
                if entry_price <= 0:
                    continue
                atr20_val = asof_value(df["atr20"], day)
                if atr20_val <= 0:
                    continue
                one_r = RR_STOP_MULT * atr20_val
                stop = entry_price - one_r
                take_profit = entry_price + RR_TARGET_MULT * one_r

                budget = min(nav_now * POSITION_WEIGHT, cash)
                if budget < nav_now * POSITION_WEIGHT * 0.5:
                    continue
                shares = budget * (1 - COST_PER_SIDE) / entry_price
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
                    "shares": shares, "original_shares": shares,
                    "entry_price": entry_price, "entry_date": day,
                    "cost": budget, "last_close": entry_price,
                    "highest": entry_price, "stop": stop,
                    "take_profit_price": take_profit,
                    "one_r": one_r, "half_sold": False,
                    "source": source, "n_clubs": n_clubs,
                    "display_name": display_name, "market": market,
                    "target_price": tp,
                }

        # Update positions and check exit conditions
        for ticker, pos in list(positions.items()):
            df = prices.get(ticker)
            if df is None or day_ts not in df.index:
                continue
            close = float(df.loc[day_ts]["close"])
            high_today = float(df.loc[day_ts].get("high", close))
            low_today = float(df.loc[day_ts].get("low", close))
            pos["last_close"] = close
            pos["highest"] = max(pos.get("highest", close), close)

            # Ratchet trail stop (Chandelier ATR×3) for remaining runner
            atr_val = asof_value(df["atr"], day)
            if atr_val:
                trail_stop = pos["highest"] - RR_TRAIL_ATR_MULT * atr_val
                pos["stop"] = max(pos.get("stop", 0.0), trail_stop)

            if ticker in pending_exits:
                continue  # already queued

            # Half-exit at +2.5R
            if not pos.get("half_sold") and high_today >= pos["take_profit_price"]:
                half_price = pos["take_profit_price"]
                half_shares = pos["original_shares"] * 0.5
                half_cost = pos["cost"] * 0.5
                cash += half_shares * half_price * (1 - COST_PER_SIDE)
                trade = _close_trade(
                    ticker, pos, day, half_price, "rr_half_+2.5R",
                    ticker_reports, record_full_trades, None,
                    shares_override=half_shares, cost_override=half_cost,
                )
                trades.append(trade)
                # Keep only runner half
                pos["shares"] = pos["original_shares"] * 0.5
                pos["cost"] = pos["cost"] * 0.5
                pos["half_sold"] = True

            # Stop: low today touched stop
            elif low_today <= pos["stop"]:
                pending_exits[ticker] = "rr_stop"

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    last_day = calendar[-1]
    for ticker, pos in list(positions.items()):
        trades.append(_close_trade(ticker, pos, last_day, pos["last_close"], "데이터_종료_미청산",
                                   ticker_reports, record_full_trades, None))

    return _compute_result(nav_series, trades, START_CAPITAL, label, open_positions=positions)


# ──────────────────────────────────────────────────────────────────────────────
# Chandelier parametric runner (for Optuna tuning)
# ──────────────────────────────────────────────────────────────────────────────

def run_chandelier_parametric(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    label: str,
    atr_period: int,
    atr_mult: float,
    max_positions: int,
    ticker_reports: dict[str, list[dict]] | None = None,
    record_full_trades: bool = False,
) -> dict:
    """Chandelier with configurable ATR period, multiplier, and max positions."""
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    pending_exits: set[str] = set()

    pending_entries = build_pending_entries(reports, calendar, consensus_only=False)

    for day in calendar:
        day_ts = pd.Timestamp(day)

        to_exit = [t for t in list(pending_exits) if t in positions]
        for ticker in to_exit:
            pos = positions[ticker]
            q = _get_quote(prices, ticker, day)
            if q is None or float(q["open"]) <= 0:
                continue
            exit_price = float(q["open"])
            cash += pos["shares"] * exit_price * (1 - COST_PER_SIDE)
            trades.append(_close_trade(ticker, pos, day, exit_price, f"chandelier_ATR{atr_mult}",
                                       ticker_reports, record_full_trades, None))
            del positions[ticker]
            pending_exits.discard(ticker)

        if day in pending_entries:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            slots = max_positions - len(positions)
            candidates = list({t: (t, s, nc) for t, s, nc in pending_entries[day] if t not in positions}.values())
            for ticker, source, n_clubs in candidates[:slots]:
                pos, cash = _try_enter(ticker, source, n_clubs, day, prices, positions, cash, nav_now, ticker_reports)
                if pos is not None:
                    df = prices[ticker]
                    # Use the appropriate ATR column for the given period
                    if atr_period == 20:
                        atr_col = "atr20"
                    else:
                        atr_col = "atr"  # default atr42; recalc inline for non-standard periods
                    atr_val = asof_value(df[atr_col] if atr_col in df.columns else df["atr"], day)
                    stop = pos["entry_price"] - atr_mult * atr_val if atr_val else pos["entry_price"] * 0.75
                    pos["stop"] = stop
                    positions[ticker] = pos

        for ticker, pos in list(positions.items()):
            df = prices.get(ticker)
            if df is None or day_ts not in df.index:
                continue
            close = float(df.loc[day_ts]["close"])
            pos["last_close"] = close
            pos["highest"] = max(pos.get("highest", close), close)
            atr_col = "atr20" if atr_period == 20 else "atr"
            atr_val = asof_value(df[atr_col] if atr_col in df.columns else df["atr"], day)
            if atr_val:
                new_stop = pos["highest"] - atr_mult * atr_val
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
# Optuna robust optimization for chandelier family
# Search space: ATR period {20,42,63}, ATR mult [2.5,7], max_positions {10,20,30}
# Objective: evaluated on IS only, 2-fold (2020-21, 2022-23)
#   = min(fold1_sharpe, fold2_sharpe) − 0.1 × |fold1_sharpe − fold2_sharpe|
# ~120 trials, TPE, fixed seed.
# OOS evaluated ONCE after best params selected.
# ──────────────────────────────────────────────────────────────────────────────

OPTUNA_N_TRIALS = 120
OPTUNA_SEED = 42
# IS folds
IS_FOLD1_START = dt.date(2020, 1, 1)
IS_FOLD1_END   = dt.date(2021, 12, 31)
IS_FOLD2_START = dt.date(2022, 1, 1)
IS_FOLD2_END   = dt.date(2023, 12, 31)

def _chandelier_fold_sharpe(
    nav_df: pd.Series,
    fold_start: dt.date,
    fold_end: dt.date,
) -> float:
    mask = (nav_df.index.date >= fold_start) & (nav_df.index.date <= fold_end)
    sub = nav_df[mask]
    if len(sub) < 20:
        return -9.0
    ret = sub.pct_change().dropna()
    if ret.std() == 0:
        return -9.0
    return float(ret.mean() / ret.std() * math.sqrt(252))


def run_optuna_chandelier(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    ticker_reports: dict[str, list[dict]] | None = None,
) -> dict:
    """Run Optuna optimization on chandelier family. Returns best params + IS/OOS metrics."""
    try:
        import optuna
        optuna.logging.set_verbosity(optuna.logging.WARNING)
    except ImportError:
        print("  WARNING: optuna not installed — skipping D+ optimization", flush=True)
        return {"skipped": True, "reason": "optuna not installed"}

    # IS calendar only
    is_calendar = [d for d in calendar if IS_FOLD1_START <= d <= IS_FOLD2_END]

    def objective(trial: "optuna.Trial") -> float:
        atr_period = trial.suggest_categorical("atr_period", [20, 42, 63])
        # Discretised grid: step=0.25 → values land on {2.50, 2.75, 3.00, …, 7.00}
        atr_mult   = trial.suggest_float("atr_mult", 2.5, 7.0, step=0.25)
        max_pos    = trial.suggest_categorical("max_positions", [10, 20, 30])

        # Need ATR for non-standard periods — compute on the fly if needed
        # atr_period=20 uses atr20, atr_period=42 uses atr (default), 63 we reuse atr (closest)
        result = run_chandelier_parametric(
            prices, reports, is_calendar, "optuna_trial",
            atr_period=atr_period, atr_mult=atr_mult, max_positions=max_pos,
            ticker_reports=ticker_reports, record_full_trades=False,
        )
        nav_df = result["nav_df"]
        s1 = _chandelier_fold_sharpe(nav_df, IS_FOLD1_START, IS_FOLD1_END)
        s2 = _chandelier_fold_sharpe(nav_df, IS_FOLD2_START, IS_FOLD2_END)
        # Objective: worst-fold sharpe with instability penalty
        return min(s1, s2) - 0.1 * abs(s1 - s2)

    sampler = optuna.samplers.TPESampler(seed=OPTUNA_SEED)
    study = optuna.create_study(direction="maximize", sampler=sampler)
    print(f"  Running Optuna ({OPTUNA_N_TRIALS} trials)...", flush=True)
    study.optimize(objective, n_trials=OPTUNA_N_TRIALS, show_progress_bar=False)

    best = study.best_params
    # Round floats to 2 decimal places for deterministic reporting
    best = {k: (round(v, 2) if isinstance(v, float) else v) for k, v in best.items()}
    best_val = study.best_value
    print(f"  Best params (discretised): {best}  obj={best_val:.3f}", flush=True)

    # Evaluate best config on IS (both folds together) for reporting
    is_result = run_chandelier_parametric(
        prices, reports, is_calendar, "D+_optuna_IS",
        atr_period=best["atr_period"], atr_mult=best["atr_mult"],
        max_positions=best["max_positions"],
        ticker_reports=ticker_reports, record_full_trades=False,
    )
    is_nav = is_result["nav_df"]
    fold1_sharpe = _chandelier_fold_sharpe(is_nav, IS_FOLD1_START, IS_FOLD1_END)
    fold2_sharpe = _chandelier_fold_sharpe(is_nav, IS_FOLD2_START, IS_FOLD2_END)

    # Evaluate ONCE on OOS (untouched)
    oos_calendar = [d for d in calendar if d >= OOS_START]
    # Need to run full sim from start to get correct positions for OOS equity
    full_result = run_chandelier_parametric(
        prices, reports, calendar, "D+_chandelier_optuna",
        atr_period=best["atr_period"], atr_mult=best["atr_mult"],
        max_positions=best["max_positions"],
        ticker_reports=ticker_reports, record_full_trades=True,
    )
    oos_sharpe_val = full_result.get("out_of_sample", {}).get("sharpe")
    is_sharpe_val  = full_result.get("in_sample", {}).get("sharpe")

    print(f"  D+ Optuna: IS sharpe={is_sharpe_val}  fold1={fold1_sharpe:.2f}  fold2={fold2_sharpe:.2f}  OOS sharpe={oos_sharpe_val}", flush=True)

    full_result["optuna_meta"] = {
        "best_params": best,
        "best_objective": round(best_val, 4),
        "fold1_sharpe": round(fold1_sharpe, 3),
        "fold2_sharpe": round(fold2_sharpe, 3),
        "n_trials": OPTUNA_N_TRIALS,
        "search_space": {
            "atr_period": [20, 42, 63],
            "atr_mult": {"min": 2.5, "max": 7.0, "step": 0.25},
            "max_positions": [10, 20, 30],
        },
        "methodology": (
            "IS 2-폴드 (2020-21, 2022-23), 목적함수 = min(fold1, fold2) − 0.1×|fold1−fold2|. "
            f"TPE sampler, seed={OPTUNA_SEED}, {OPTUNA_N_TRIALS} trials. OOS는 1회만 평가. "
            "탐색공간 이산화: atr_mult step=0.25 (2-decimal grid). 파라미터 소수점 2자리 반올림."
        ),
    }
    return full_result


# ──────────────────────────────────────────────────────────────────────────────
# Strategy L: 민리버전 (Connors RSI-2 mean reversion)
# Universe: report-validated within last 18 months.
# Entry: RSI(2) < 10 AND close > 200MA (checked daily).
# Exit: RSI(2) > 70 OR 10 trading days.
# Reference: Connors & Alvarez "Short-Term Trading Strategies That Work" (2009).
# ──────────────────────────────────────────────────────────────────────────────

RSI2_ENTRY_THRESHOLD = 10.0   # RSI(2) < 10 to enter
RSI2_EXIT_THRESHOLD  = 70.0   # RSI(2) > 70 to exit
RSI2_MAX_HOLD_DAYS   = 10     # trading days
RSI2_UNIVERSE_MONTHS = 18     # report valid for 18 months

def run_rsi2_mean_reversion(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    label: str,
    ticker_reports: dict[str, list[dict]] | None = None,
    record_full_trades: bool = False,
) -> dict:
    """
    Connors RSI-2 평균회귀. 유니버스: 최근 18개월 내 매수 리포트.
    진입: RSI(2) < 10 AND close > 200MA.
    청산: RSI(2) > 70 OR 10 거래일.
    """
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    pending_exits: dict[str, str] = {}

    # Build universe: per-day set of valid tickers (report within 18mo)
    # For efficiency: precompute per ticker the valid date range
    ticker_valid: dict[str, list[tuple[dt.date, dt.date]]] = {}
    for rdate, ticker, source, n_clubs in reports:
        expire = rdate + dt.timedelta(days=int(RSI2_UNIVERSE_MONTHS * 30.44))
        ticker_valid.setdefault(ticker, []).append((rdate, expire))

    # RSI-2 entry queue: signals detected at close of prev day, filled at next open.
    rsi2_entry_queue: list[tuple[str, str, int]] = []  # (ticker, source, n_clubs)

    for day in calendar:
        day_ts = pd.Timestamp(day)

        # Execute pending exits at open
        to_exit = [t for t in list(pending_exits) if t in positions]
        for ticker in to_exit:
            pos = positions[ticker]
            reason = pending_exits.pop(ticker)
            q = _get_quote(prices, ticker, day)
            if q is None or float(q["open"]) <= 0:
                pending_exits[ticker] = reason
                continue
            exit_price = float(q["open"])
            cash += pos["shares"] * exit_price * (1 - COST_PER_SIDE)
            trades.append(_close_trade(ticker, pos, day, exit_price, reason,
                                       ticker_reports, record_full_trades, None))
            del positions[ticker]

        # Execute queued RSI-2 entries at today's open (signal detected yesterday)
        if rsi2_entry_queue:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            slots = MAX_POSITIONS - len(positions)
            for ticker, source, n_clubs in rsi2_entry_queue:
                if slots <= 0:
                    break
                if ticker in positions:
                    continue
                pos, cash = _try_enter(ticker, source, n_clubs, day, prices, positions, cash, nav_now, ticker_reports)
                if pos is not None:
                    pos["hold_days_remaining"] = RSI2_MAX_HOLD_DAYS
                    positions[ticker] = pos
                    slots -= 1
            rsi2_entry_queue = []

        # Update positions + check exit conditions (end-of-day)
        for ticker, pos in list(positions.items()):
            df = prices.get(ticker)
            if df is None or day_ts not in df.index:
                continue
            close = float(df.loc[day_ts]["close"])
            pos["last_close"] = close
            pos["hold_days_remaining"] = pos.get("hold_days_remaining", RSI2_MAX_HOLD_DAYS) - 1

            if ticker in pending_exits:
                continue
            rsi2_val = float(df["rsi2"].asof(day_ts)) if "rsi2" in df.columns else 50.0
            if rsi2_val > RSI2_EXIT_THRESHOLD:
                pending_exits[ticker] = "rsi2_exit_>70"
            elif pos["hold_days_remaining"] <= 0:
                pending_exits[ticker] = "rsi2_10day_만기"

        # End-of-day entry SIGNAL scan — deferred to next bar's open
        new_rsi2_entries: list[tuple[str, str, int]] = []
        nav_now_eod = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        for ticker, ranges in ticker_valid.items():
            if ticker in positions:
                continue
            # Check if any report range covers today
            valid = any(start <= day <= end for start, end in ranges)
            if not valid:
                continue
            df = prices.get(ticker)
            if df is None or day_ts not in df.index:
                continue
            close = float(df.loc[day_ts]["close"])
            rsi2_val = float(df["rsi2"].asof(day_ts)) if "rsi2" in df.columns else 50.0
            ma200_val = asof_value(df["ma200"], day)
            if rsi2_val < RSI2_ENTRY_THRESHOLD and ma200_val > 0 and close > ma200_val:
                tr_list = (ticker_reports or {}).get(ticker, [])
                past_tr = [r for r in tr_list if r["report_date"] <= day]
                n_clubs = len({r["school"] for r in past_tr}) if past_tr else 1
                source = past_tr[-1]["source_file"] if past_tr else ""
                source = Path(source).name if source else ""
                new_rsi2_entries.append((ticker, source, n_clubs))

        rsi2_entry_queue = new_rsi2_entries

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    last_day = calendar[-1]
    for ticker, pos in list(positions.items()):
        trades.append(_close_trade(ticker, pos, last_day, pos["last_close"], "데이터_종료_미청산",
                                   ticker_reports, record_full_trades, None))

    return _compute_result(nav_series, trades, START_CAPITAL, label, open_positions=positions)


# ──────────────────────────────────────────────────────────────────────────────
# Strategy M: 단기 리버설 (Short-Term Reversal)
# Universe: report-validated stocks (buy report within last 18mo).
# Monthly: buy bottom quintile by trailing 1-month return, hold 1 month.
# Equal weight. Factor-zoo short-term reversal.
# Reference: Jegadeesh (1990), Lehmann (1990), Debondt & Thaler (1985).
# ──────────────────────────────────────────────────────────────────────────────

def run_short_term_reversal(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    label: str,
    ticker_reports: dict[str, list[dict]] | None = None,
    record_full_trades: bool = False,
) -> dict:
    """
    단기 리버설. 월초 리밸런싱: 유니버스 중 직전 1개월 수익률 하위 20% 매수, 1개월 보유.
    """
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []

    REVERSAL_UNIVERSE_MONTHS = 18
    ticker_valid: dict[str, list[tuple[dt.date, dt.date]]] = {}
    for rdate, ticker, source, n_clubs in reports:
        expire = rdate + dt.timedelta(days=int(REVERSAL_UNIVERSE_MONTHS * 30.44))
        ticker_valid.setdefault(ticker, []).append((rdate, expire))

    # Build month-first and month-end days
    cal_s = pd.Series(calendar)
    month_firsts: set[dt.date] = set(
        cal_s.groupby(cal_s.apply(lambda d: (d.year, d.month))).first().values
    )
    month_ends: set[dt.date] = set(
        cal_s.groupby(cal_s.apply(lambda d: (d.year, d.month))).last().values
    )

    # Reversal rebalance queue: bottom-quintile tickers computed at PREVIOUS month-end
    # close, bought at month-first open (eliminates same-bar close→open lookahead).
    # Format: list of (ticker, source, n_clubs)
    reversal_entry_queue: list[tuple[str, str, int]] = []

    for day in calendar:
        day_ts = pd.Timestamp(day)

        if day in month_firsts:
            # Step 1: Close all existing positions at today's open (month-first open)
            # Only clear positions that are successfully exited to avoid cash leakage.
            exited: set[str] = set()
            for ticker in list(positions.keys()):
                pos = positions[ticker]
                q = _get_quote(prices, ticker, day)
                if q is None or float(q["open"]) <= 0:
                    # No valid open price — carry position forward, exit at close
                    close_val = pos.get("last_close", pos["entry_price"])
                    if close_val > 0:
                        cash += pos["shares"] * close_val * (1 - COST_PER_SIDE)
                        trades.append(_close_trade(ticker, pos, day, close_val, "reversal_1mo_만기_no_open",
                                                   ticker_reports, record_full_trades, None))
                        exited.add(ticker)
                    continue
                exit_price = float(q["open"])
                cash += pos["shares"] * exit_price * (1 - COST_PER_SIDE)
                trades.append(_close_trade(ticker, pos, day, exit_price, "reversal_1mo_만기",
                                           ticker_reports, record_full_trades, None))
                exited.add(ticker)
            for t in exited:
                del positions[t]

            # Step 2: Execute the bottom-quintile queue computed at previous month-end
            if reversal_entry_queue:
                nav_now = cash
                if nav_now <= 0:
                    nav_now = float(START_CAPITAL)
                slots = MAX_POSITIONS
                for ticker, source, n_clubs in reversal_entry_queue[:slots]:
                    if ticker in positions:
                        continue
                    pos, cash = _try_enter(ticker, source, n_clubs, day, prices, positions, cash, nav_now, ticker_reports)
                    if pos is not None and pos.get("cost", 0) > 0:
                        positions[ticker] = pos
                reversal_entry_queue = []

        # Update last_close
        for ticker, pos in positions.items():
            df = prices.get(ticker)
            if df is not None and day_ts in df.index:
                pos["last_close"] = float(df.loc[day_ts]["close"])

        # End-of-month: compute bottom-quintile ranking from today's close for next
        # month-first execution (point-in-time: signal at month-end close, fill next open).
        if day in month_ends:
            one_mo_ago = day - dt.timedelta(days=30)
            candidates_m: list[tuple[float, str, str, int]] = []
            for ticker, ranges in ticker_valid.items():
                if ticker in positions:
                    continue
                valid = any(start <= day <= end for start, end in ranges)
                if not valid:
                    continue
                df = prices.get(ticker)
                if df is None or day_ts not in df.index:
                    continue
                close_now = float(df.loc[day_ts]["close"])
                close_1mo = asof_value(df["close"], one_mo_ago)
                if close_1mo <= 0:
                    continue
                ret_1mo = close_now / close_1mo - 1
                tr_list = (ticker_reports or {}).get(ticker, [])
                past_tr = [r for r in tr_list if r["report_date"] <= day]
                n_clubs_val = len({r["school"] for r in past_tr}) if past_tr else 1
                source_val = Path(past_tr[-1]["source_file"]).name if past_tr and past_tr[-1].get("source_file") else ""
                candidates_m.append((ret_1mo, ticker, source_val, n_clubs_val))

            if len(candidates_m) >= 5:
                candidates_m.sort(key=lambda x: x[0])
                n_quintile = max(1, len(candidates_m) // 5)
                reversal_entry_queue = [
                    (ticker, source, nc)
                    for _, ticker, source, nc in candidates_m[:n_quintile]
                ]

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    last_day = calendar[-1]
    for ticker, pos in list(positions.items()):
        trades.append(_close_trade(ticker, pos, last_day, pos["last_close"], "데이터_종료_미청산",
                                   ticker_reports, record_full_trades, None))

    return _compute_result(nav_series, trades, START_CAPITAL, label, open_positions=positions)


# ──────────────────────────────────────────────────────────────────────────────
# Strategy N: 52주 고가 근접 (George & Hwang 2004)
# Enter on report if price ≥ 85% of 52w high.
# Exit when price < 70% of 52w high (monthly check).
# Reference: George & Hwang (2004) "The 52-Week High and Momentum Investing".
# ──────────────────────────────────────────────────────────────────────────────

N52W_ENTRY_PCT  = 0.85   # enter if price ≥ 85% of 52w high
N52W_EXIT_PCT   = 0.70   # exit if price < 70% of 52w high

def run_52w_high_proximity(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    label: str,
    ticker_reports: dict[str, list[dict]] | None = None,
    record_full_trades: bool = False,
) -> dict:
    """
    52주 고가 근접 (George & Hwang 2004).
    진입: 리포트 당일 close ≥ 52w high × 85%.
    청산: 월말 체크 — close < 52w high × 70% → 다음 거래일 시가 청산.
    """
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    pending_exits: set[str] = set()

    # Filter reports: only those where entry condition met on report day
    n52_pending: dict[dt.date, list[tuple[str, str, int]]] = {}
    for rdate, ticker, source, n_clubs in reports:
        df = prices.get(ticker)
        if df is None:
            continue
        close_on_report = asof_value(df["close"], rdate)
        hi52w_on_report  = asof_value(df["hi52w"], rdate)
        if hi52w_on_report <= 0 or close_on_report <= 0:
            continue
        if close_on_report >= N52W_ENTRY_PCT * hi52w_on_report:
            entry_day = first_trading_day_after(rdate, calendar)
            if entry_day:
                n52_pending.setdefault(entry_day, []).append((ticker, source, n_clubs))

    cal_s = pd.Series(calendar)
    month_ends: set[dt.date] = set(
        cal_s.groupby(cal_s.apply(lambda d: (d.year, d.month))).last().values
    )

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
            trades.append(_close_trade(ticker, pos, day, exit_price, "52w_hi_exit",
                                       ticker_reports, record_full_trades, None))
            del positions[ticker]
            pending_exits.discard(ticker)

        # Execute entries
        if day in n52_pending:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            slots = MAX_POSITIONS - len(positions)
            candidates = list({t: (t, s, nc) for t, s, nc in n52_pending[day] if t not in positions}.values())
            for ticker, source, n_clubs in candidates[:slots]:
                pos, cash = _try_enter(ticker, source, n_clubs, day, prices, positions, cash, nav_now, ticker_reports)
                if pos is not None:
                    positions[ticker] = pos

        # Update last_close
        for ticker, pos in positions.items():
            df = prices.get(ticker)
            if df is not None and day_ts in df.index:
                pos["last_close"] = float(df.loc[day_ts]["close"])

        # Monthly exit check: close < 70% of 52w high
        if day in month_ends:
            for ticker, pos in list(positions.items()):
                df = prices.get(ticker)
                if df is None:
                    continue
                close = pos["last_close"]
                hi52w_val = asof_value(df["hi52w"], day)
                if hi52w_val > 0 and close < N52W_EXIT_PCT * hi52w_val:
                    pending_exits.add(ticker)

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    last_day = calendar[-1]
    for ticker, pos in list(positions.items()):
        trades.append(_close_trade(ticker, pos, last_day, pos["last_close"], "데이터_종료_미청산",
                                   ticker_reports, record_full_trades, None))

    return _compute_result(nav_series, trades, START_CAPITAL, label, open_positions=positions)


# ──────────────────────────────────────────────────────────────────────────────
# Strategy O: MTT (alpha16 이식) — Minervini Trend Template
# Universe: report-validated stocks (18-month window, same as L/M).
# RS computation: cross-sectional percentile across OUR price-warehouse universe
#   weighted_rs = 3m×0.5 + 6m×0.3 + 12m×0.2  (alpha16 RobustOpt KRX params)
# MTT filter (all must hold):
#   close > 50MA > 150MA > 200MA
#   200MA rising vs 1-month ago
#   close ≥ 1.9 × 52w low  (alpha16 KRX param)
#   close ≥ 0.95 × 52w high  (alpha16 KRX param)
#   RS ≥ 80
# Buy: RS ≥ 79 (+ MTT active)
# Exits (R-multiple chain, alpha16 KRX params):
#   Initial stop: −8% from entry (1R)
#   Breakeven stop: move to entry at +1R gain
#   Trailing 6% from highest: activated at +1.5R
#   Take profit: +3.5R
#   RS < 82 exit after min 8 holding days
#   Max 115 holding days
# Position sizing: 5%/20-slot equal-weight (skip Kelly for comparability).
#
# PROVENANCE DISCLOSURE: alpha16 RobustOpt KRX params were tuned on the full
# KRX universe, NOT on our report-validated data. These params are used as-is.
# Position sizing kept at our 5%/20-slot convention for comparability; Kelly
# sizing noted as future work.
# ──────────────────────────────────────────────────────────────────────────────

# alpha16 RobustOpt KRX parameters (from config.py / optimize.py)
MTT_STOP_PCT              = 0.08    # initial stop = −8% (1R)
MTT_BE_AT_R               = 1.0    # move stop to breakeven at +1R
MTT_TRAIL_PCT             = 0.06   # 6% trailing from highest
MTT_TRAIL_ACTIVATE_R      = 1.5    # trailing activates at +1.5R
MTT_TAKE_PROFIT_R         = 3.5    # take profit at +3.5R
MTT_RS_BUY_THRESHOLD      = 79     # buy when RS ≥ 79
MTT_RS_MTT_THRESHOLD      = 80     # MTT requires RS ≥ 80
MTT_RS_EXIT_THRESHOLD     = 82     # RS < 82 → exit (post min hold days)
MTT_RS_EXIT_MIN_HOLD_DAYS = 8      # min holding days before RS exit triggers
MTT_MAX_HOLD_DAYS         = 115    # max hold days
MTT_PRICE_FROM_LOW_MULT   = 1.90   # price ≥ 1.9× 52w low (alpha16 KRX)
MTT_PRICE_FROM_HIGH_MULT  = 0.95   # price ≥ 0.95× 52w high (alpha16 KRX)
MTT_UNIVERSE_MONTHS       = 18     # report valid 18 months (same as L/M)

# RS lookback in trading days (alpha16 defaults)
MTT_RS_3M  = 63
MTT_RS_6M  = 126
MTT_RS_12M = 252
MTT_RS_W3  = 0.5
MTT_RS_W6  = 0.3
MTT_RS_W12 = 0.2


def _compute_rs_percentiles(
    prices: dict[str, pd.DataFrame],
    day: dt.date,
) -> dict[str, float]:
    """
    Cross-sectional RS percentile for all tickers in prices on a given day.
    weighted_rs = rank_pct(ret_3m)×0.5 + rank_pct(ret_6m)×0.3 + rank_pct(ret_12m)×0.2
    Returns {ticker: rs_score 0..99} — empty dict if insufficient data.
    """
    day_ts = pd.Timestamp(day)
    day_63  = day - dt.timedelta(days=int(MTT_RS_3M  * 1.45))   # ~91 cal days
    day_126 = day - dt.timedelta(days=int(MTT_RS_6M  * 1.45))   # ~183 cal days
    day_252 = day - dt.timedelta(days=int(MTT_RS_12M * 1.45))   # ~365 cal days

    rets: dict[str, tuple[float, float, float]] = {}
    for ticker, df in prices.items():
        if day_ts not in df.index:
            continue
        close_now = float(df.loc[day_ts]["close"])
        if close_now <= 0:
            continue
        c3  = asof_value(df["close"], day_63)
        c6  = asof_value(df["close"], day_126)
        c12 = asof_value(df["close"], day_252)
        if c3 <= 0 or c6 <= 0 or c12 <= 0:
            continue
        rets[ticker] = (close_now / c3 - 1, close_now / c6 - 1, close_now / c12 - 1)

    if len(rets) < 5:
        return {}

    tickers = list(rets.keys())
    r3  = [rets[t][0] for t in tickers]
    r6  = [rets[t][1] for t in tickers]
    r12 = [rets[t][2] for t in tickers]
    n = len(tickers)

    def rank_pct(vals: list[float]) -> list[float]:
        sorted_v = sorted(vals)
        return [sorted_v.index(v) / max(n - 1, 1) * 99 for v in vals]

    p3  = rank_pct(r3)
    p6  = rank_pct(r6)
    p12 = rank_pct(r12)

    return {
        tickers[i]: round(p3[i] * MTT_RS_W3 + p6[i] * MTT_RS_W6 + p12[i] * MTT_RS_W12, 2)
        for i in range(n)
    }


def run_mtt_alpha16(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    label: str,
    ticker_reports: dict[str, list[dict]] | None = None,
    record_full_trades: bool = False,
) -> dict:
    """
    MTT (alpha16 이식) — Minervini Trend Template on report-validated universe.
    Universe: any ticker with a buy report within the past 18 months.
    RS: cross-sectional percentile across the full price-warehouse (our tickers).
    Exit: R-multiple chain (initial −8%, BE at +1R, trail-6% at +1.5R, TP +3.5R,
          RS<82 post 8d, max 115d).
    Position sizing: 5%/20-slot equal-weight (Kelly: future work).

    PROVENANCE: alpha16 RobustOpt KRX params tuned on full KRX universe,
    not on our report-validated data.
    """
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    pending_exits: dict[str, str] = {}

    # Build eligible pool: per-ticker the date ranges it is valid
    ticker_valid: dict[str, list[tuple[dt.date, dt.date]]] = {}
    for rdate, ticker, source, n_clubs in reports:
        expire = rdate + dt.timedelta(days=int(MTT_UNIVERSE_MONTHS * 30.44))
        ticker_valid.setdefault(ticker, []).append((rdate, expire))

    # Cache of daily RS scores — recomputed once per day lazily
    _rs_cache: dict[dt.date, dict[str, float]] = {}

    def get_rs(day: dt.date) -> dict[str, float]:
        if day not in _rs_cache:
            _rs_cache[day] = _compute_rs_percentiles(prices, day)
        return _rs_cache[day]

    # MTT entry queue: tickers whose signal was detected at close of prev day,
    # to be filled at open of the current day (eliminates same-bar lookahead).
    # Format: list of (ticker, source_val, n_clubs_val, rs_val_at_signal)
    mtt_entry_queue: list[tuple[str, str, int, float]] = []

    for day in calendar:
        day_ts = pd.Timestamp(day)

        # Execute pending exits at open
        to_exit = [t for t in list(pending_exits) if t in positions]
        for ticker in to_exit:
            pos = positions[ticker]
            reason = pending_exits.pop(ticker)
            q = _get_quote(prices, ticker, day)
            if q is None or float(q["open"]) <= 0:
                pending_exits[ticker] = reason   # defer
                continue
            exit_price = float(q["open"])
            cash += pos["shares"] * exit_price * (1 - COST_PER_SIDE)
            trades.append(_close_trade(ticker, pos, day, exit_price, reason,
                                       ticker_reports, record_full_trades, None))
            del positions[ticker]

        # Execute queued MTT entries at today's open (signal was detected yesterday)
        if mtt_entry_queue:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            slots = MAX_POSITIONS - len(positions)
            for ticker, source_val, n_clubs_val, rs_val in mtt_entry_queue:
                if slots <= 0:
                    break
                if ticker in positions:
                    continue
                pos, cash = _try_enter(ticker, source_val, n_clubs_val, day, prices, positions,
                                       cash, nav_now, ticker_reports)
                if pos is not None:
                    entry_p = pos["entry_price"]
                    one_r = entry_p * MTT_STOP_PCT
                    pos["stop"] = entry_p - one_r
                    pos["one_r"] = one_r
                    pos["trail_activated"] = False
                    pos["rs_val"] = rs_val
                    pos["hold_days"] = 0
                    positions[ticker] = pos
                    slots -= 1
            mtt_entry_queue = []

        # RS scores for today (end-of-day close signal generation)
        rs_scores = get_rs(day)

        # End-of-day entry SIGNAL scan — conditions checked at today's close,
        # execution deferred to next bar's open (point-in-time, no same-bar lookahead).
        new_mtt_entries: list[tuple[str, str, int, float]] = []
        for ticker, ranges in ticker_valid.items():
            if ticker in positions:
                continue
            # 18-month validity window
            valid = any(start <= day <= end for start, end in ranges)
            if not valid:
                continue
            df = prices.get(ticker)
            if df is None or day_ts not in df.index:
                continue

            rs_val = rs_scores.get(ticker, 0.0)
            if rs_val < MTT_RS_BUY_THRESHOLD:
                continue

            close = float(df.loc[day_ts]["close"])
            ma50  = asof_value(df["ma50"],  day)
            ma150 = asof_value(df["ma150"], day)
            ma200 = asof_value(df["ma200"], day)
            hi52w = asof_value(df["hi52w"], day)
            lo52w = asof_value(df["lo52w"] if "lo52w" in df.columns else df["close"].rolling(252, min_periods=126).min(), day)

            if any(v <= 0 for v in [ma50, ma150, ma200, hi52w]):
                continue

            # MTT filter (checked at close — point-in-time)
            if not (close > ma50 > ma150 > ma200):
                continue
            # 200MA rising vs 1 month ago
            ma200_1mo = asof_value(df["ma200"], day - dt.timedelta(days=30))
            if ma200_1mo <= 0 or ma200 <= ma200_1mo:
                continue
            # Price ≥ 1.9× 52w low
            if lo52w > 0 and close < MTT_PRICE_FROM_LOW_MULT * lo52w:
                continue
            # Price ≥ 0.95× 52w high
            if close < MTT_PRICE_FROM_HIGH_MULT * hi52w:
                continue
            # RS ≥ 80 (MTT RS gate)
            if rs_val < MTT_RS_MTT_THRESHOLD:
                continue

            # Get source/n_clubs from most recent report
            tr_list = (ticker_reports or {}).get(ticker, [])
            past_tr = [r for r in tr_list if r["report_date"] <= day]
            n_clubs_val = len({r["school"] for r in past_tr}) if past_tr else 1
            source_val = Path(past_tr[-1]["source_file"]).name if past_tr and past_tr[-1].get("source_file") else ""

            new_mtt_entries.append((ticker, source_val, n_clubs_val, rs_val))

        # Queue for execution at next day's open
        mtt_entry_queue = new_mtt_entries

        # Update positions + check exit conditions
        for ticker, pos in list(positions.items()):
            df = prices.get(ticker)
            if df is None or day_ts not in df.index:
                continue
            close = float(df.loc[day_ts]["close"])
            pos["last_close"] = close
            pos["highest"] = max(pos.get("highest", close), close)
            pos["hold_days"] = pos.get("hold_days", 0) + 1

            if ticker in pending_exits:
                continue

            entry_p = pos["entry_price"]
            one_r   = pos["one_r"]
            highest = pos["highest"]
            hold_days = pos["hold_days"]

            # --- Stop management ---
            gain = close - entry_p
            gain_r = gain / one_r if one_r > 0 else 0.0

            # Breakeven stop: move to entry at +1R
            if gain_r >= MTT_BE_AT_R:
                pos["stop"] = max(pos.get("stop", 0.0), entry_p)

            # Trailing 6%: activated at +1.5R
            if gain_r >= MTT_TRAIL_ACTIVATE_R:
                pos["trail_activated"] = True

            if pos.get("trail_activated"):
                trail_stop = highest * (1 - MTT_TRAIL_PCT)
                pos["stop"] = max(pos.get("stop", 0.0), trail_stop)

            # --- Exit checks ---
            # Initial stop hit
            if close < pos["stop"]:
                pending_exits[ticker] = "mtt_stop"
                continue

            # Take profit +3.5R
            if gain_r >= MTT_TAKE_PROFIT_R:
                pending_exits[ticker] = "mtt_take_profit_3.5R"
                continue

            # RS < 82 exit after min 8 holding days
            rs_val_today = rs_scores.get(ticker, 0.0)
            pos["rs_val"] = rs_val_today
            if hold_days >= MTT_RS_EXIT_MIN_HOLD_DAYS and rs_val_today < MTT_RS_EXIT_THRESHOLD:
                pending_exits[ticker] = "mtt_rs_exit_<82"
                continue

            # Max 115 days
            if hold_days >= MTT_MAX_HOLD_DAYS:
                pending_exits[ticker] = "mtt_max_115d"
                continue

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    last_day = calendar[-1]
    for ticker, pos in list(positions.items()):
        trades.append(_close_trade(ticker, pos, last_day, pos["last_close"], "데이터_종료_미청산",
                                   ticker_reports, record_full_trades, None))

    return _compute_result(nav_series, trades, START_CAPITAL, label, open_positions=positions)


# ──────────────────────────────────────────────────────────────────────────────
# Strategy P: 딥바이 샹들리에 하이브리드
# Entry = G 딥바이 (price falls ≥20% below publication-day close within 6mo).
# Scale-in = ONE add-on buy (same 5% slot size) if price falls another 10% below
#   the first entry price WHILE the 6-month thesis window is still open.
#   Combined into a single position with averaged cost; stop tracked from combined
#   highest-high.
# Exit = Optuna-tuned chandelier ATR trailing stop only (no profit cap).
#   Uses D+ Optuna best params if available at runtime; otherwise falls back to
#   ATR(42)×5 (D default).
# Reference: 딥바이 진입은 좋았으나 청산이 큰 winner를 못 먹었다 → trailing stop
#   only, no target cap.
# ──────────────────────────────────────────────────────────────────────────────

# P strategy params
P_DIP_THRESHOLD      = 0.20    # ≥20% below pub-day close → first entry
P_ADDON_DROP         = 0.10    # additional 10% below first entry → scale-in
P_DIP_WINDOW_DAYS    = 180     # 6-month watch window from report date
P_ATR_PERIOD         = 42      # ATR period (same as D default; overridable)
P_ATR_MULT_DEFAULT   = 5.0     # fallback ATR mult if Optuna result not available


def run_deepbuy_chandelier(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    label: str,
    ticker_reports: dict[str, list[dict]] | None = None,
    record_full_trades: bool = False,
    atr_mult: float = P_ATR_MULT_DEFAULT,
    max_positions: int = MAX_POSITIONS,
) -> dict:
    """
    P 딥바이 샹들리에 하이브리드.

    진입: 발간일 종가 대비 ≥20% 하락 (6개월 내), 익일 시가 매수 (5% 슬롯).
    추가매수: 최초 진입가 대비 추가 10% 하락이 발생하면 동일 슬롯에 5% 1회 추가.
      → 평균 단가 재계산, 포지션 합산. 6개월 thesis 창 내에서만 허용.
    청산: 최고점 기준 ATR 트레일링 스탑 (D+ Optuna 파라미터, 기본 ATR42×5).
      타겟가 캡 없음 — winner를 충분히 보유.
    생존 편향 주석: 프라이스 파일이 존재하는 종목만 유니버스에 포함됨.
    """
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    pending_exits: set[str] = set()

    # Build per-ticker dip-watch queue (same structure as G)
    dip_watch: dict[str, list[dict]] = {}
    for rdate, ticker, source, n_clubs in reports:
        if rdate < SIM_START - dt.timedelta(days=P_DIP_WINDOW_DAYS):
            continue
        df = prices.get(ticker)
        if df is None:
            continue
        pub_close = asof_value(df["close"], rdate)
        if pub_close <= 0:
            continue
        tr_list = (ticker_reports or {}).get(ticker, [])
        past_tr = [x for x in tr_list if x["report_date"] <= rdate]
        dn = past_tr[-1]["display_name"] if past_tr else ticker
        market = past_tr[0].get("market", "KR") if past_tr else "KR"
        dip_watch.setdefault(ticker, []).append({
            "report_date": rdate,
            "pub_close": pub_close,
            "expire_date": rdate + dt.timedelta(days=P_DIP_WINDOW_DAYS),
            "display_name": dn,
            "n_clubs": n_clubs,
            "source": source,
            "market": market,
        })

    # dip_entry_queue: (ticker, watch) pairs detected at close, filled at next open
    dip_entry_queue: list[tuple[str, dict]] = []
    # addon_queue: tickers where scale-in was triggered at close, filled at next open
    addon_queue: list[str] = []

    for day in calendar:
        day_ts = pd.Timestamp(day)

        # ── Open-of-day: execute exits ─────────────────────────────────────
        to_exit = [t for t in list(pending_exits) if t in positions]
        for ticker in to_exit:
            pos = positions[ticker]
            q = _get_quote(prices, ticker, day)
            if q is None or float(q["open"]) <= 0:
                continue
            exit_price = float(q["open"])
            cash += pos["shares"] * exit_price * (1 - COST_PER_SIDE)
            trades.append(_close_trade(ticker, pos, day, exit_price,
                                       f"p_chandelier_ATR{atr_mult}",
                                       ticker_reports, record_full_trades, None))
            del positions[ticker]
            pending_exits.discard(ticker)

        # ── Open-of-day: execute deferred scale-in add-ons ─────────────────
        if addon_queue:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            for ticker in addon_queue:
                pos = positions.get(ticker)
                if pos is None:
                    continue
                df = prices.get(ticker)
                if df is None or day_ts not in df.index:
                    continue
                addon_price = float(df.loc[day_ts]["open"])
                if addon_price <= 0:
                    continue
                addon_budget = min(nav_now * POSITION_WEIGHT, cash)
                if addon_budget < nav_now * POSITION_WEIGHT * 0.5:
                    continue
                addon_shares = addon_budget * (1 - COST_PER_SIDE) / addon_price
                cash -= addon_budget
                # Merge into existing position: weighted avg entry, combined shares/cost
                old_shares = pos["shares"]
                old_cost   = pos["cost"]
                new_shares = old_shares + addon_shares
                new_cost   = old_cost + addon_budget
                avg_entry  = (old_shares * pos["entry_price"] + addon_shares * addon_price) / new_shares
                pos["shares"]      = new_shares
                pos["cost"]        = new_cost
                pos["entry_price"] = avg_entry   # blended avg for P&L tracking
                # Stop is reset from combined highest-high (already tracked)
                atr_val = asof_value(df["atr"], day)
                if atr_val:
                    new_stop = pos["highest"] - atr_mult * atr_val
                    pos["stop"] = max(pos.get("stop", 0.0), new_stop)
            addon_queue = []

        # ── Open-of-day: execute new dip entries queued from previous close ─
        if dip_entry_queue:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            slots = max_positions - len(positions)
            for ticker, watch in dip_entry_queue[:slots]:
                if ticker in positions:
                    continue
                df = prices.get(ticker)
                if df is None or day_ts not in df.index:
                    continue
                entry_price = float(df.loc[day_ts]["open"])
                if entry_price <= 0:
                    continue
                budget = min(nav_now * POSITION_WEIGHT, cash)
                if budget < nav_now * POSITION_WEIGHT * 0.5:
                    continue
                shares = budget * (1 - COST_PER_SIDE) / entry_price
                cash -= budget
                atr_val = asof_value(df["atr"], day)
                stop = entry_price - atr_mult * atr_val if atr_val else entry_price * 0.75
                positions[ticker] = {
                    "shares": shares,
                    "entry_price": entry_price,
                    "entry_date": day,
                    "cost": budget,
                    "last_close": entry_price,
                    "highest": entry_price,
                    "stop": stop,
                    "source": watch["source"],
                    "n_clubs": watch["n_clubs"],
                    "display_name": watch["display_name"],
                    "market": watch["market"],
                    "target_price": None,
                    "addon_done": False,
                    "addon_trigger": entry_price * (1 - P_ADDON_DROP),
                    "thesis_expire": watch["expire_date"],
                    "first_entry_price": entry_price,
                }
            dip_entry_queue = []

        # ── End-of-day: scan dip-watch for new first-entry triggers ────────
        new_dip_entries: list[tuple[str, dict]] = []
        for ticker, watches in dip_watch.items():
            if ticker in positions:
                continue
            df = prices.get(ticker)
            if df is None or day_ts not in df.index:
                continue
            close_today = float(df.loc[day_ts]["close"])
            for watch in watches:
                if day < watch["report_date"] or day > watch["expire_date"]:
                    continue
                dip_level = watch["pub_close"] * (1 - P_DIP_THRESHOLD)
                if close_today <= dip_level:
                    new_dip_entries.append((ticker, watch))
                    break
        dip_entry_queue = new_dip_entries

        # ── End-of-day: update positions, check chandelier stop + scale-in ─
        new_addon: list[str] = []
        for ticker, pos in list(positions.items()):
            df = prices.get(ticker)
            if df is None or day_ts not in df.index:
                continue
            close = float(df.loc[day_ts]["close"])
            pos["last_close"] = close
            pos["highest"] = max(pos.get("highest", close), close)

            # Ratchet chandelier stop from highest-high
            atr_val = asof_value(df["atr"], day)
            if atr_val:
                new_stop = pos["highest"] - atr_mult * atr_val
                pos["stop"] = max(pos.get("stop", 0.0), new_stop)

            # Chandelier stop breach → exit at next open
            if pos.get("stop") and close < pos["stop"] and ticker not in pending_exits:
                pending_exits.add(ticker)
                continue

            # Scale-in trigger: price drops P_ADDON_DROP below first entry,
            # thesis window still open, add-on not yet done.
            if (not pos.get("addon_done")
                    and close <= pos.get("addon_trigger", 0.0)
                    and day <= pos.get("thesis_expire", day - dt.timedelta(days=1))):
                pos["addon_done"] = True   # mark immediately to prevent re-trigger
                new_addon.append(ticker)

        addon_queue = new_addon

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    # Force-close remaining at last bar
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
    _tr_raw = nav_df.iloc[-1] / nav_df.iloc[0] - 1
    total_return = float(_tr_raw) if not math.isnan(_tr_raw) else 0.0
    years = (nav_df.index[-1] - nav_df.index[0]).days / 365.25
    _cagr_raw = (nav_df.iloc[-1] / nav_df.iloc[0]) ** (1 / years) - 1 if years > 0 else None
    cagr = _cagr_raw if (_cagr_raw is not None and not math.isnan(_cagr_raw) and not math.isinf(_cagr_raw)) else None
    _sharpe_raw = float(daily_ret.mean() / daily_ret.std() * math.sqrt(252)) if daily_ret.std() else None
    sharpe = _sharpe_raw if (_sharpe_raw is not None and not math.isnan(_sharpe_raw)) else None
    _mdd_raw = float((nav_df / nav_df.cummax() - 1).min())
    mdd = _mdd_raw if not math.isnan(_mdd_raw) else 0.0
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
        _cagr_raw = (sub.iloc[-1] / sub.iloc[0]) ** (1 / _years) - 1 if _years > 0 else None
        _cagr = _cagr_raw if (_cagr_raw is not None and not math.isnan(_cagr_raw) and not math.isinf(_cagr_raw)) else None
        _sharpe_raw = float(ret.mean() / ret.std() * math.sqrt(252)) if ret.std() else None
        _sharpe = _sharpe_raw if (_sharpe_raw is not None and not math.isnan(_sharpe_raw)) else None
        _mdd_raw = float((sub / sub.cummax() - 1).min())
        _mdd = _mdd_raw if not math.isnan(_mdd_raw) else 0.0
        return {
            "start": sub.index[0].date().isoformat(),
            "end": sub.index[-1].date().isoformat(),
            "total_return_pct": round(float(_total) * 100, 2) if not math.isnan(_total) else None,
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
        "yearly": [{"year": ts.year, "return_pct": float(v) if not math.isnan(v) else None} for ts, v in yearly.items()],
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
# Today's signals — keyed off the headline strategy (single source of truth)
# For chandelier: open positions include stop level & distance-to-stop %
# ──────────────────────────────────────────────────────────────────────────────

def compute_today_signals(
    perf: pd.DataFrame,
    prices: dict[str, pd.DataFrame],
    ticker_reports: dict[str, list[dict]],
    calendar: list[dt.date],
    headline_open_positions: dict,   # raw open_positions dict from the headline run
    headline_label: str,
    reports: list[tuple[dt.date, str, str, int]],
    kospi: pd.Series | None = None,
    regime_aware: bool = False,
    max_positions: int = MAX_POSITIONS,
) -> dict:
    """
    오늘의 신호 — "SOTA 전략이 지금 규칙대로 굴러간다면 일어날 매매" (v15 재정의).

      - 매수 임박(imminent_buys): 최근 5거래일 내 발간된 buy 리포트 중
        아직 미보유인 종목 — 익일 시가 진입이 지금 대기 중인 신호.
        슬롯 여유(slots.available)와 함께 보고.
      - 매도 임박(approaching_stop): 트레일링 스탑 3% 이내 포지션
        + 현재가가 이미 스탑 아래인 포지션(stop_hit=True → 다음 시가 청산).
      - 보유 중(open_positions): 현 포지션 + 스탑 레벨 + 과열계수.
      - 레짐(regime): T- 헤드라인일 때 KOSPI vs 200MA 상태.
        OFF = 유휴 현금 파킹 수익 0% (현금 보유). 진입 자체는 차단하지 않음 — 정직하게 명시.
      - watching(대기)은 카운트만 — 리포트 흐름이지 전략의 임박 신호가 아님.
    """
    as_of = calendar[-1] if calendar else dt.date.today()
    as_of_ts = pd.Timestamp(as_of)
    IMMINENT_BUY_TRADING_DAYS = 5    # 매수 임박: 최근 5거래일 내 리포트
    APPROACHING_STOP_PCT = 0.03      # 3% distance-to-stop threshold

    is_chandelier_family = "chandelier" in headline_label.lower() or "regime" in headline_label.lower()

    open_positions: list[dict] = []
    approaching_stop: list[dict] = []   # 매도 임박 (within 3% of stop, incl. stop hit)
    imminent_buys: list[dict] = []

    # ── 레짐 상태 (T- 계열: KOSPI < 200MA → 파킹 수익 0%) ───────────────────
    regime: dict | None = None
    if kospi is not None:
        kospi_close = asof_value(kospi, as_of)
        kospi_ma200 = asof_value(kospi.rolling(200, min_periods=100).mean(), as_of)
        if kospi_close > 0 and kospi_ma200 > 0:
            state = "ON" if kospi_close >= kospi_ma200 else "OFF"
            if regime_aware:
                note = (
                    "레짐 ON — 유휴 현금이 KOSPI 익스포저로 작동 중."
                    if state == "ON" else
                    "레짐 OFF — KOSPI < 200MA. 유휴 현금 파킹 수익 0% (현금 보유). "
                    "신규 진입 규칙 자체는 유지됩니다."
                )
            else:
                note = "레짐 필터 없는 전략 — 참고용 KOSPI 200MA 상태."
            regime = {
                "applies": regime_aware,
                "state": state,
                "kospi_close": round(kospi_close, 2),
                "kospi_ma200": round(kospi_ma200, 2),
                "note": note,
            }

    # ── 보유 중: from headline open_positions dict ──────────────────────────
    already_in: set[str] = set()
    for ticker, pos in (headline_open_positions or {}).items():
        already_in.add(ticker)
        current_price = None
        df = prices.get(ticker)
        if df is not None:
            cv = df["close"].asof(as_of_ts)
            if pd.notna(cv):
                current_price = float(cv)

        entry_price = float(pos.get("entry_price", 0))
        unrealized_pct = round((current_price / entry_price - 1) * 100, 2) if current_price and entry_price else None
        stop_level = pos.get("stop")
        highest = pos.get("highest", entry_price)
        days_elapsed = (as_of - pos["entry_date"]).days if hasattr(pos.get("entry_date"), "date") else (as_of - dt.date.fromisoformat(str(pos.get("entry_date", as_of)))).days

        dist_to_stop_pct = None
        if stop_level and current_price and current_price > 0:
            dist_to_stop_pct = round((current_price - stop_level) / current_price * 100, 2)

        tr_list = ticker_reports.get(ticker, [])
        past_tr = [r for r in tr_list if r["report_date"] <= as_of]
        trigger_schools = sorted({r["school"] for r in past_tr})
        trigger_reports = [
            {
                "school": r["school"],
                "report_date": r["report_date"].isoformat(),
                "target_price": r["target_price"],
                "stated_upside_pct": r["stated_upside_pct"],
            }
            for r in sorted(past_tr, key=lambda x: x["report_date"], reverse=True)[:5]
        ]

        # Extension gauge (visible regardless of strategy family)
        ext_val = compute_extension(df, as_of) if df is not None else None

        pos_info: dict = {
            "ticker": ticker,
            "market": pos.get("market", "KR"),
            "display_name": pos.get("display_name", ticker),
            "entry_date": pos["entry_date"].isoformat() if hasattr(pos.get("entry_date"), "isoformat") else str(pos.get("entry_date", "")),
            "entry_price": round(entry_price, 4),
            "current_price": round(current_price, 4) if current_price else None,
            "unrealized_pct": unrealized_pct,
            "days_elapsed": days_elapsed,
            "highest_since_entry": round(float(highest), 4) if highest else None,
            "extension": ext_val,   # ATR% multiple from 50-MA (과열 게이지)
            "trigger_schools": trigger_schools,
            "trigger_reports": trigger_reports,
        }
        if is_chandelier_family:
            pos_info["stop_level"] = round(float(stop_level), 4) if stop_level else None
            pos_info["dist_to_stop_pct"] = dist_to_stop_pct
            pos_info["stop_hit"] = bool(dist_to_stop_pct is not None and dist_to_stop_pct <= 0)

        open_positions.append(pos_info)

        # 매도 임박: within 3% of stop (스탑 터치 포함 — dist ≤ 0)
        if is_chandelier_family and dist_to_stop_pct is not None and dist_to_stop_pct <= APPROACHING_STOP_PCT * 100:
            approaching_stop.append(pos_info)

    open_positions.sort(key=lambda x: (x.get("dist_to_stop_pct") or 999))
    slots_available = max(0, max_positions - len(open_positions))

    # ── 매수 임박: 최근 5거래일 내 발간 buy 리포트, 미보유 ───────────────────
    recent_days = calendar[-IMMINENT_BUY_TRADING_DAYS:] if len(calendar) >= IMMINENT_BUY_TRADING_DAYS else calendar
    imminent_cutoff = recent_days[0] if recent_days else as_of
    recent_by_ticker: dict[str, list[dict]] = {}
    for rdate, ticker, source, n_clubs in reports:
        if imminent_cutoff <= rdate <= as_of and ticker not in already_in:
            tr_list = ticker_reports.get(ticker, [])
            match = next((r for r in tr_list if r["report_date"] == rdate), None)
            if match is not None:
                bucket = recent_by_ticker.setdefault(ticker, [])
                if not any(r["report_date"] == rdate for r in bucket):
                    bucket.append(match)

    for ticker, recent_reports in recent_by_ticker.items():
        if not recent_reports:
            continue
        latest = max(recent_reports, key=lambda x: x["report_date"])
        market = latest.get("market", "KR")
        latest_rdate = latest["report_date"]
        entry_basis_date = first_trading_day_after(latest_rdate, calendar)
        entry_pending = entry_basis_date is None or entry_basis_date > as_of
        entry_basis_price = None
        if entry_basis_date and ticker in prices:
            df = prices[ticker]
            ts = pd.Timestamp(entry_basis_date)
            if ts in df.index:
                entry_basis_price = float(df.loc[ts]["open"])

        imminent_buys.append({
            "ticker": ticker,
            "market": market,
            "display_name": latest["display_name"],
            "n_schools": len({r["school"] for r in recent_reports}),
            "entry_basis_date": entry_basis_date.isoformat() if entry_basis_date else None,
            "entry_basis_price": round(entry_basis_price, 4) if entry_basis_price else None,
            "entry_pending": entry_pending,   # True = 익일 시가 진입이 아직 미래
            "trigger_schools": sorted({r["school"] for r in recent_reports}),
            "trigger_reports": [
                {
                    "school": r["school"],
                    "report_date": r["report_date"].isoformat(),
                    "target_price": r["target_price"],
                    "stated_upside_pct": r["stated_upside_pct"],
                }
                for r in sorted(recent_reports, key=lambda x: x["report_date"], reverse=True)
            ],
        })

    imminent_buys.sort(key=lambda x: x["entry_basis_date"] or "9999", reverse=True)

    # ── 대기(watching) 카운트만: 유효 리포트 보유 종목 중 미보유 ─────────────
    # 목록은 전략의 "임박 신호"가 아니라 리포트 흐름 — 아카이브로 안내.
    watching_count = 0
    for ticker in set(ticker_reports.keys()) & set(prices.keys()):
        if ticker in already_in:
            continue
        if any(r["report_date"] <= as_of for r in ticker_reports.get(ticker, [])):
            watching_count += 1

    return {
        "as_of": as_of.isoformat(),
        "headline_strategy": headline_label,
        "disclaimer": "백테스트 규칙의 기계적 적용이며 투자 권유가 아닙니다. 과거 데이터 기반 시뮬레이션으로 미래 수익을 보장하지 않습니다.",
        "regime": regime,
        "slots": {
            "max_positions": max_positions,
            "open": len(open_positions),
            "available": slots_available,
        },
        "open_positions": open_positions,
        "approaching_stop": approaching_stop,
        "imminent_buys": imminent_buys,
        "watching_count": watching_count,
        "counts": {
            "open": len(open_positions),
            "approaching_stop": len(approaching_stop),
            "imminent_buys": len(imminent_buys),
            "watching": watching_count,
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

def build_multi_strategy_summary(
    strategies: dict[str, dict],
    kospi_dca_ratios: dict[str, dict] | None = None,
) -> list[dict]:
    """Build comparison table rows for all strategies."""
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
        ratio_info = (kospi_dca_ratios or {}).get(key, {})
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
            "kospi_dca_ratio": ratio_info.get("full_ratio"),      # strategy_final / kospi_final
            "kospi_dca_beats": (ratio_info.get("full_ratio") or 0.0) > 1.0,
        })
    return rows


# ──────────────────────────────────────────────────────────────────────────────
# Strategy Q: 깡토 추세추종 (Korean trend-following blogger system)
#
# 시장 신호등:
#   초록(시장유닛 2) = KOSPI close > 200MA AND 50MA rising (vs 20일 전)
#   빨강(시장유닛 1) = 그 외
# 종목 유닛 = 1.  총 유닛 = 종목유닛 × 시장유닛 (1 or 2).
# 점진적 베팅: 포지션 +3R 도달 후 같은 티커 패밀리 다음 진입에 +1 종목유닛 (최대 3유닛).
# 유닛 사이즈 = 총자본 / 20.  Max 2% Rule: 단일 포지션 리스크 ≤ equity × 2%.
#
# 진입 (단독 커버 포함, 18mo 유효 유니버스):
#   RS 퍼센타일(MTT 방식) ≥ KOSPI RS AND
#   close = 60d high AND volume ≥ 1.5 × 20d avg volume.
#   체결: 익일 시가.
#
# 스탑/청산 (1R = entry × 8%):
#   초기 스탑: entry − 1R (−8%)
#   +1R 시 스탑 → breakeven
#   +1.5R 시 트레일 고점 − 8% 활성화
#   +3R 시 절반 익절 (나머지는 트레일 지속)
#   편도 비용 0.3%
# ──────────────────────────────────────────────────────────────────────────────

Q_STOP_PCT          = 0.08   # 1R = 8%
Q_BE_R              = 1.0    # move stop to BE at +1R
Q_TRAIL_ACTIVATE_R  = 1.5    # trail high−8% activates at +1.5R
Q_HALF_EXIT_R       = 3.0    # take half at +3R
Q_MAX_UNIT_ADD      = 3      # max 3 total units after progressive betting
Q_UNIVERSE_MONTHS   = 18
Q_VOL_MULT          = 1.5    # volume ≥ 1.5× 20d avg
Q_BREAKOUT_DAYS     = 60     # 60d high breakout


def _q_market_units(kospi: pd.Series, day: dt.date) -> int:
    """시장 신호등: 초록=2유닛, 빨강=1유닛."""
    kospi_close = asof_value(kospi, day)
    if kospi_close <= 0:
        return 1
    # 200MA of KOSPI — compute on the fly using rolling
    idx = kospi.index
    day_ts = pd.Timestamp(day)
    sub = kospi[idx <= day_ts]
    if len(sub) < 100:
        return 1
    ma200 = float(sub.iloc[-200:].mean()) if len(sub) >= 200 else float(sub.mean())
    # 50MA — current vs 20 days ago
    ma50_now = float(sub.iloc[-50:].mean()) if len(sub) >= 50 else float(sub.mean())
    sub_20ago = kospi[idx <= day_ts - pd.Timedelta(days=20)]
    if len(sub_20ago) < 50:
        return 1
    ma50_20ago = float(sub_20ago.iloc[-50:].mean()) if len(sub_20ago) >= 50 else float(sub_20ago.mean())
    if kospi_close > ma200 and ma50_now > ma50_20ago:
        return 2
    return 1


def run_kangto_trend(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    label: str,
    ticker_reports: dict[str, list[dict]] | None = None,
    record_full_trades: bool = False,
    kospi: pd.Series | None = None,
) -> dict:
    """
    Q 깡토 추세추종.
    진입: RS ≥ KOSPI RS AND close = 60d high AND volume ≥ 1.5× 20d avg.
    스탑: −8% 초기 / BE at +1R / 트레일 고점−8% at +1.5R / 절반 +3R.
    유닛 사이징: capital/20, max 2% risk rule.
    """
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    equity = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    pending_exits: dict[str, str] = {}

    # Track closed trade returns per ticker family (for progressive betting)
    # ticker -> list of return_r (profit/1R multiple)
    ticker_family_profit: dict[str, list[float]] = {}

    # Build eligible pool
    ticker_valid: dict[str, list[tuple[dt.date, dt.date]]] = {}
    for rdate, ticker, source, n_clubs in reports:
        expire = rdate + dt.timedelta(days=int(Q_UNIVERSE_MONTHS * 30.44))
        ticker_valid.setdefault(ticker, []).append((rdate, expire))

    # Entry signal queue: detected at close, filled at next open
    q_entry_queue: list[tuple[str, str, int, float]] = []  # ticker, source, n_clubs, rs_val

    for day in calendar:
        day_ts = pd.Timestamp(day)
        equity = cash + sum(p["shares"] * p["last_close"] for p in positions.values())

        # Execute pending exits at open
        to_exit = [t for t in list(pending_exits) if t in positions]
        for ticker in to_exit:
            pos = positions[ticker]
            reason = pending_exits.pop(ticker)
            q = _get_quote(prices, ticker, day)
            if q is None or float(q["open"]) <= 0:
                pending_exits[ticker] = reason
                continue
            exit_price = float(q["open"])
            proceeds = pos["shares"] * exit_price * (1 - COST_PER_SIDE)
            cash += proceeds
            one_r = pos.get("one_r", pos["entry_price"] * Q_STOP_PCT)
            ret_r = (exit_price / pos["entry_price"] - 1) * pos["entry_price"] / one_r if one_r > 0 else 0.0
            ticker_family_profit.setdefault(ticker, []).append(ret_r)
            trades.append(_close_trade(ticker, pos, day, exit_price, reason,
                                       ticker_reports, record_full_trades, None))
            del positions[ticker]

        # Execute entry queue at open
        if q_entry_queue:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            market_units = _q_market_units(kospi, day) if kospi is not None else 1
            slots = MAX_POSITIONS - len(positions)
            for ticker, source_val, n_clubs_val, rs_val in q_entry_queue:
                if slots <= 0:
                    break
                if ticker in positions:
                    continue
                df = prices.get(ticker)
                if df is None or day_ts not in df.index:
                    continue
                entry_price = float(df.loc[day_ts]["open"])
                if entry_price <= 0:
                    continue

                # Progressive betting: +1 종목유닛 if last trade on this ticker was profitable ≥+3R
                family_hist = ticker_family_profit.get(ticker, [])
                extra_unit = 1 if family_hist and family_hist[-1] >= Q_HALF_EXIT_R else 0
                stock_units = min(1 + extra_unit, Q_MAX_UNIT_ADD)
                total_units = stock_units * market_units

                unit_size = nav_now / 20.0
                one_r = entry_price * Q_STOP_PCT
                # Max 2% risk rule: shrink if needed
                position_risk = total_units * one_r  # risk per share × (shares from total_units × unit)
                # shares = (unit_size * total_units) / entry_price
                # actual_risk = shares * one_r
                raw_budget = unit_size * total_units
                shares_raw = raw_budget * (1 - COST_PER_SIDE) / entry_price
                actual_risk = shares_raw * one_r
                max_risk = nav_now * 0.02
                if actual_risk > max_risk and actual_risk > 0:
                    scale = max_risk / actual_risk
                    raw_budget *= scale

                budget = min(raw_budget, cash)
                if budget < nav_now * POSITION_WEIGHT * 0.5:
                    continue
                shares = budget * (1 - COST_PER_SIDE) / entry_price
                cash -= budget
                stop = entry_price - one_r

                display_name = ticker
                tp = None
                market = "KR"
                if ticker_reports is not None:
                    tr_list = ticker_reports.get(ticker, [])
                    past_tr = [r for r in tr_list if r["report_date"] < day]
                    if past_tr:
                        latest = max(past_tr, key=lambda x: x["report_date"])
                        display_name = latest["display_name"]
                        tps = [x["target_price"] for x in past_tr if x["target_price"]]
                        tp = max(tps) if tps else None
                        market = past_tr[0].get("market", "KR")

                positions[ticker] = {
                    "shares": shares,
                    "original_shares": shares,
                    "entry_price": entry_price,
                    "entry_date": day,
                    "cost": budget,
                    "last_close": entry_price,
                    "highest": entry_price,
                    "stop": stop,
                    "one_r": one_r,
                    "trail_activated": False,
                    "half_sold": False,
                    "source": source_val,
                    "n_clubs": n_clubs_val,
                    "display_name": display_name,
                    "market": market,
                    "target_price": tp,
                    "total_units": total_units,
                }
                slots -= 1
            q_entry_queue = []

        # Compute cross-sectional RS for entry signals
        rs_scores = _compute_rs_percentiles(prices, day)
        # KOSPI RS percentile benchmark
        kospi_rs_pct = 50.0  # default
        if kospi is not None and rs_scores:
            # Use _compute_rs_percentiles result for a synthetic KOSPI entry
            # Proxy: KOSPI percentile in the cross-section via direct RS calc
            kospi_close_now = asof_value(kospi, day)
            if kospi_close_now > 0:
                day_63  = day - dt.timedelta(days=91)
                day_126 = day - dt.timedelta(days=183)
                day_252 = day - dt.timedelta(days=365)
                c3  = asof_value(kospi, day_63)
                c6  = asof_value(kospi, day_126)
                c12 = asof_value(kospi, day_252)
                if c3 > 0 and c6 > 0 and c12 > 0:
                    ret3  = kospi_close_now / c3 - 1
                    ret6  = kospi_close_now / c6 - 1
                    ret12 = kospi_close_now / c12 - 1
                    # rank this against all tickers in prices
                    all_scores = list(rs_scores.values())
                    if len(all_scores) >= 5:
                        # Recompute raw rets for each ticker and compare
                        raw_r3:  list[float] = []
                        raw_r6:  list[float] = []
                        raw_r12: list[float] = []
                        tickers_list = list(rs_scores.keys())
                        for t in tickers_list:
                            df = prices.get(t)
                            if df is None:
                                raw_r3.append(0.0); raw_r6.append(0.0); raw_r12.append(0.0)
                                continue
                            day_ts2 = pd.Timestamp(day)
                            if day_ts2 not in df.index:
                                raw_r3.append(0.0); raw_r6.append(0.0); raw_r12.append(0.0)
                                continue
                            cn = float(df.loc[day_ts2]["close"])
                            _c3  = asof_value(df["close"], day_63)
                            _c6  = asof_value(df["close"], day_126)
                            _c12 = asof_value(df["close"], day_252)
                            raw_r3.append(cn / _c3 - 1 if _c3 > 0 else 0.0)
                            raw_r6.append(cn / _c6 - 1 if _c6 > 0 else 0.0)
                            raw_r12.append(cn / _c12 - 1 if _c12 > 0 else 0.0)
                        n = len(tickers_list) + 1  # include KOSPI
                        raw_r3.append(ret3); raw_r6.append(ret6); raw_r12.append(ret12)
                        rank3  = sorted(raw_r3).index(ret3)  / max(n - 1, 1) * 99
                        rank6  = sorted(raw_r6).index(ret6)  / max(n - 1, 1) * 99
                        rank12 = sorted(raw_r12).index(ret12) / max(n - 1, 1) * 99
                        kospi_rs_pct = rank3 * MTT_RS_W3 + rank6 * MTT_RS_W6 + rank12 * MTT_RS_W12

        # End-of-day: scan for entry signals
        new_entries: list[tuple[str, str, int, float]] = []
        for ticker, ranges in ticker_valid.items():
            if ticker in positions:
                continue
            valid = any(start <= day <= end for start, end in ranges)
            if not valid:
                continue
            df = prices.get(ticker)
            if df is None or day_ts not in df.index:
                continue

            rs_val = rs_scores.get(ticker, 0.0)
            if rs_val < kospi_rs_pct:
                continue

            close = float(df.loc[day_ts]["close"])
            # 60d high breakout: close == 60d high (close >= rolling 60d high)
            hi60 = float(df["close"].rolling(Q_BREAKOUT_DAYS, min_periods=30).max().asof(day_ts)) if "close" in df else 0.0
            if hi60 <= 0 or close < hi60 * 0.999:  # allow tiny float tolerance
                continue
            # Volume ≥ 1.5× 20d avg
            if "volume" in df.columns and day_ts in df.index:
                vol_now = float(df.loc[day_ts]["volume"])
                vol_20avg = float(df["volume"].rolling(20, min_periods=10).mean().asof(day_ts))
                if vol_20avg <= 0 or vol_now < Q_VOL_MULT * vol_20avg:
                    continue

            tr_list = (ticker_reports or {}).get(ticker, [])
            past_tr = [r for r in tr_list if r["report_date"] <= day]
            n_clubs_val = len({r["school"] for r in past_tr}) if past_tr else 1
            source_val = Path(past_tr[-1]["source_file"]).name if past_tr and past_tr[-1].get("source_file") else ""
            new_entries.append((ticker, source_val, n_clubs_val, rs_val))

        q_entry_queue = new_entries

        # Update positions + check exits
        for ticker, pos in list(positions.items()):
            df = prices.get(ticker)
            if df is None or day_ts not in df.index:
                continue
            close = float(df.loc[day_ts]["close"])
            high_today = float(df.loc[day_ts].get("high", close))
            pos["last_close"] = close
            pos["highest"] = max(pos.get("highest", close), close)

            if ticker in pending_exits:
                continue

            entry_p = pos["entry_price"]
            one_r   = pos["one_r"]
            highest = pos["highest"]
            gain_r  = (close - entry_p) / one_r if one_r > 0 else 0.0
            gain_r_high = (high_today - entry_p) / one_r if one_r > 0 else 0.0

            # Stop management
            # BE at +1R
            if gain_r >= Q_BE_R:
                pos["stop"] = max(pos.get("stop", 0.0), entry_p)
            # Trail high−8% at +1.5R
            if gain_r >= Q_TRAIL_ACTIVATE_R:
                pos["trail_activated"] = True
            if pos.get("trail_activated"):
                trail_stop = highest * (1 - Q_STOP_PCT)
                pos["stop"] = max(pos.get("stop", 0.0), trail_stop)

            # Half-exit at +3R (intraday high check)
            if not pos.get("half_sold") and gain_r_high >= Q_HALF_EXIT_R:
                half_price = entry_p + Q_HALF_EXIT_R * one_r
                half_price = min(half_price, high_today)
                half_shares = pos["original_shares"] * 0.5
                half_cost = pos["cost"] * 0.5
                cash += half_shares * half_price * (1 - COST_PER_SIDE)
                trade = _close_trade(ticker, pos, day, half_price, "q_half_+3R",
                                     ticker_reports, record_full_trades, None,
                                     shares_override=half_shares, cost_override=half_cost)
                trades.append(trade)
                pos["shares"] = pos["original_shares"] * 0.5
                pos["cost"] = pos["cost"] * 0.5
                pos["half_sold"] = True

            # Stop breach
            if close < pos["stop"]:
                pending_exits[ticker] = "q_stop"

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    last_day = calendar[-1]
    for ticker, pos in list(positions.items()):
        trades.append(_close_trade(ticker, pos, last_day, pos["last_close"], "데이터_종료_미청산",
                                   ticker_reports, record_full_trades, None))

    return _compute_result(nav_series, trades, START_CAPITAL, label, open_positions=positions)


# ──────────────────────────────────────────────────────────────────────────────
# Strategy R: Kelly 샹들리에 (D+ chandelier rules + Kelly position sizing)
#
# 규칙: D+ Chandelier (Optuna 파라미터) 진입/청산 로직 동일.
# 포지션 사이즈: rolling 최근 40 거래 win_rate + payoff → fractional Kelly.
#   kelly_raw = win_rate − (1−win_rate) / (avg_win/avg_loss)
#   kelly_frac = kelly_raw × safety(0.5), cap 0.25, floor 1%/trade (= equity/100).
# 충분한 거래 이력 없으면 flat 5% fallback.
# 오버레이 그룹.
# ──────────────────────────────────────────────────────────────────────────────

R_KELLY_LOOKBACK = 40
R_KELLY_CAP      = 0.25
R_KELLY_SAFETY   = 0.5
R_KELLY_FLOOR    = 0.01   # 1% of equity floor
R_KELLY_FALLBACK = 0.05   # flat 5% if insufficient history


def _kelly_fraction(closed_returns: list[float]) -> float:
    """
    Fractional Kelly from rolling trade returns (in %).
    Returns fraction of equity to risk (0..R_KELLY_CAP).
    """
    recent = closed_returns[-R_KELLY_LOOKBACK:]
    if len(recent) < 10:
        return R_KELLY_FALLBACK
    wins   = [r for r in recent if r > 0]
    losses = [r for r in recent if r < 0]
    if not wins or not losses:
        return R_KELLY_FALLBACK
    p = len(wins) / len(recent)
    avg_win  = sum(wins)  / len(wins)
    avg_loss = abs(sum(losses) / len(losses))
    if avg_win <= 0 or avg_loss <= 0:
        return R_KELLY_FALLBACK
    b = avg_win / avg_loss
    kelly_raw = p - (1 - p) / b
    kelly_frac = max(0.0, kelly_raw) * R_KELLY_SAFETY
    return max(R_KELLY_FLOOR, min(kelly_frac, R_KELLY_CAP))


def run_kelly_chandelier(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    label: str,
    ticker_reports: dict[str, list[dict]] | None = None,
    record_full_trades: bool = False,
    atr_period: int = ATR_PERIOD,
    atr_mult: float = CHANDELIER_ATR_MULT,
    max_positions: int = MAX_POSITIONS,
) -> dict:
    """
    R Kelly 샹들리에.
    진입/청산: D+ Chandelier 규칙 동일.
    포지션 사이즈: Kelly (rolling 40 trades), cap 0.25, safety 0.5, floor 1%.
    """
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    pending_exits: set[str] = set()
    closed_returns: list[float] = []   # running history of closed trade returns (%)

    pending_entries = build_pending_entries(reports, calendar, consensus_only=False)

    for day in calendar:
        day_ts = pd.Timestamp(day)

        # Execute pending exits at open
        to_exit = [t for t in list(pending_exits) if t in positions]
        for ticker in to_exit:
            pos = positions[ticker]
            q = _get_quote(prices, ticker, day)
            if q is None or float(q["open"]) <= 0:
                continue
            exit_price = float(q["open"])
            proceeds = pos["shares"] * exit_price * (1 - COST_PER_SIDE)
            ret_pct = (proceeds / pos["cost"] - 1) * 100
            closed_returns.append(ret_pct)
            cash += proceeds
            trades.append(_close_trade(ticker, pos, day, exit_price,
                                       f"r_chandelier_ATR{atr_mult}",
                                       ticker_reports, record_full_trades, None))
            del positions[ticker]
            pending_exits.discard(ticker)

        # Execute pending entries with Kelly sizing
        if day in pending_entries:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            kelly_frac = _kelly_fraction(closed_returns)
            slots = max_positions - len(positions)
            candidates = list({t: (t, s, nc) for t, s, nc in pending_entries[day]
                                if t not in positions}.values())
            for ticker, source, n_clubs in candidates[:slots]:
                df = prices.get(ticker)
                if df is None or day_ts not in df.index:
                    continue
                entry_price = float(df.loc[day_ts]["open"])
                if entry_price <= 0:
                    continue

                budget = min(nav_now * kelly_frac, cash)
                if budget < nav_now * R_KELLY_FLOOR * 0.5:
                    continue
                shares = budget * (1 - COST_PER_SIDE) / entry_price
                cash -= budget

                display_name = ticker
                tp = None
                market = "KR"
                if ticker_reports is not None:
                    tr_list = ticker_reports.get(ticker, [])
                    past_tr = [r for r in tr_list if r["report_date"] < day]
                    if past_tr:
                        latest = max(past_tr, key=lambda x: x["report_date"])
                        display_name = latest["display_name"]
                        tps = [x["target_price"] for x in past_tr if x["target_price"]]
                        tp = max(tps) if tps else None
                        market = past_tr[0].get("market", "KR")

                atr_col = "atr20" if atr_period == 20 else "atr"
                atr_val = asof_value(df[atr_col] if atr_col in df.columns else df["atr"], day)
                stop = entry_price - atr_mult * atr_val if atr_val else entry_price * 0.75

                positions[ticker] = {
                    "shares": shares,
                    "entry_price": entry_price,
                    "entry_date": day,
                    "cost": budget,
                    "last_close": entry_price,
                    "highest": entry_price,
                    "stop": stop,
                    "source": source,
                    "n_clubs": n_clubs,
                    "display_name": display_name,
                    "market": market,
                    "target_price": tp,
                }

        # Update positions + check chandelier stop
        for ticker, pos in list(positions.items()):
            df = prices.get(ticker)
            if df is None or day_ts not in df.index:
                continue
            close = float(df.loc[day_ts]["close"])
            pos["last_close"] = close
            pos["highest"] = max(pos.get("highest", close), close)
            atr_col = "atr20" if atr_period == 20 else "atr"
            atr_val = asof_value(df[atr_col] if atr_col in df.columns else df["atr"], day)
            if atr_val:
                new_stop = pos["highest"] - atr_mult * atr_val
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
# Strategy S: 포트폴리오 최적화 (월간 리밸런스)
#
# 유니버스: 18개월 유효 활성 종목 (buy report within 18mo).
# 가격 데이터: trailing 252d daily returns (점-in-time).
# 세 변형:
#   S_hrp    — HRP (Hierarchical Risk Parity): 직접 구현
#              corr distance → single-linkage → quasi-diag reorder → iv-split
#   S_msharpe — max-Sharpe: mean-variance, LedoitWolf 수축
#              (sklearn if available, else λ=0.3 diagonal shrinkage), long-only w≤15%
#   S_mincvar — min-CVaR 95%: scipy.optimize.linprog LP, long-only w≤15%
#
# 월 리밸런스: 월말 종가로 가중치 계산, 다음 거래일 시가 체결.
# 비용: 전체 NAV × 총 턴오버 × 편도 비용.
# ──────────────────────────────────────────────────────────────────────────────

S_UNIVERSE_MONTHS   = 18
S_LOOKBACK_DAYS     = 252
S_MIN_STOCKS        = 3      # minimum stocks to run optimisation
S_MAX_WEIGHT        = 0.15   # max weight per stock
S_SHRINK_LAMBDA     = 0.3    # simple shrinkage fallback


def _hrp_weights(ret_df: pd.DataFrame) -> dict[str, float]:
    """
    Hierarchical Risk Parity weights.
    Hand-rolled: corr distance → single-linkage → quasi-diag → inverse-variance split.
    Returns {ticker: weight}, sums to 1.
    """
    import numpy as np

    tickers = list(ret_df.columns)
    n = len(tickers)
    if n < 2:
        return {t: 1.0 / n for t in tickers}

    corr = ret_df.corr().values
    # Distance matrix: sqrt(0.5 * (1 - corr))
    dist = np.sqrt(np.maximum(0.5 * (1 - corr), 0))

    # Single-linkage clustering (manual)
    # Use condensed distance form → agglomerative
    clusters: list[list[int]] = [[i] for i in range(n)]
    # Build dendrogram via greedy single-linkage
    merged_order: list[int] = list(range(n))

    def _min_dist_pair(clust: list[list[int]], d: "np.ndarray") -> tuple[int, int]:
        best = float("inf")
        bi, bj = 0, 1
        for ii in range(len(clust)):
            for jj in range(ii + 1, len(clust)):
                # single-linkage: min dist between elements
                d_ij = min(d[a][b] for a in clust[ii] for b in clust[jj])
                if d_ij < best:
                    best = d_ij
                    bi, bj = ii, jj
        return bi, bj

    # Build sorted leaf order via single-linkage
    active = [[i] for i in range(n)]
    while len(active) > 1:
        if len(active) > 50:
            # For large n: use average inter-cluster distance approximation
            best = float("inf")
            bi, bj = 0, 1
            for ii in range(len(active)):
                for jj in range(ii + 1, len(active)):
                    avg_d = float(np.mean([dist[a][b] for a in active[ii] for b in active[jj]]))
                    if avg_d < best:
                        best = avg_d; bi, bj = ii, jj
        else:
            bi, bj = _min_dist_pair(active, dist)
        active[bi] = active[bi] + active[bj]
        active.pop(bj)
    leaf_order: list[int] = active[0]

    # Quasi-diagonal reorder: just use the leaf_order from clustering
    ordered_tickers = [tickers[i] for i in leaf_order]

    # Inverse-variance weights via recursive bisection
    vols = ret_df.std().values  # std of each ticker
    w = {t: 1.0 for t in ordered_tickers}

    def _recursive_bisect(items: list[str]) -> None:
        if len(items) <= 1:
            return
        mid = len(items) // 2
        left = items[:mid]
        right = items[mid:]

        idx_l = [ordered_tickers.index(t) for t in left]
        idx_r = [ordered_tickers.index(t) for t in right]

        # Cluster variance using current weights and covariance
        sub_l = ret_df[left]
        sub_r = ret_df[right]
        w_l = np.array([w[t] for t in left]); w_l /= w_l.sum()
        w_r = np.array([w[t] for t in right]); w_r /= w_r.sum()
        cov_l = sub_l.cov().values
        cov_r = sub_r.cov().values
        var_l = float(w_l @ cov_l @ w_l)
        var_r = float(w_r @ cov_r @ w_r)
        if var_l + var_r <= 0:
            return

        alpha = 1 - var_l / (var_l + var_r)  # proportion to left cluster
        for t in left:
            w[t] *= alpha
        for t in right:
            w[t] *= (1 - alpha)

        _recursive_bisect(left)
        _recursive_bisect(right)

    _recursive_bisect(ordered_tickers)

    total = sum(w.values())
    if total <= 0:
        return {t: 1.0 / n for t in tickers}
    return {t: w.get(t, 0.0) / total for t in tickers}


def _msharpe_weights(ret_df: pd.DataFrame) -> dict[str, float]:
    """
    Maximum Sharpe weights via mean-variance optimisation.
    Covariance: LedoitWolf (sklearn) or simple shrinkage (λ=0.3).
    Long-only, w ≤ 15%, solved with scipy.optimize.minimize.
    """
    import numpy as np
    from scipy.optimize import minimize

    tickers = list(ret_df.columns)
    n = len(tickers)
    mu = ret_df.mean().values * 252  # annualised

    try:
        from sklearn.covariance import LedoitWolf  # type: ignore
        lw = LedoitWolf().fit(ret_df.values)
        cov = lw.covariance_ * 252
    except Exception:
        raw_cov = ret_df.cov().values * 252
        cov = (1 - S_SHRINK_LAMBDA) * raw_cov + S_SHRINK_LAMBDA * np.diag(np.diag(raw_cov))

    w0 = np.ones(n) / n
    bounds = [(0.0, S_MAX_WEIGHT)] * n
    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]

    def neg_sharpe(w: "np.ndarray") -> float:
        port_ret = float(w @ mu)
        port_var = float(w @ cov @ w)
        if port_var <= 0:
            return 1e9
        return -port_ret / (port_var ** 0.5)

    try:
        res = minimize(neg_sharpe, w0, method="SLSQP", bounds=bounds, constraints=constraints,
                       options={"maxiter": 500, "ftol": 1e-9})
        if res.success:
            w_opt = np.maximum(res.x, 0.0)
            total = w_opt.sum()
            if total > 0:
                w_opt /= total
                return {t: float(w_opt[i]) for i, t in enumerate(tickers)}
    except Exception:
        pass
    return {t: 1.0 / n for t in tickers}


def _mincvar_weights(ret_df: pd.DataFrame) -> dict[str, float]:
    """
    Minimum CVaR (95%) via LP formulation.
    min_{w, z, u}  z + 1/(T*(1−α)) * sum(u_t)
    s.t.  u_t ≥ −(R_t @ w) − z  ∀t
          u_t ≥ 0  ∀t
          sum(w) = 1, 0 ≤ w_i ≤ 15%
    Solved with scipy.optimize.linprog.
    """
    import numpy as np
    from scipy.optimize import linprog

    tickers = list(ret_df.columns)
    n = len(tickers)
    R = ret_df.values  # shape (T, n)
    T = R.shape[0]
    alpha = 0.95

    # Variables: [w(n), z(1), u(T)]
    # Objective: min z + 1/(T*(1-alpha)) * sum(u)
    c = np.zeros(n + 1 + T)
    c[n] = 1.0  # z coefficient
    c[n + 1:] = 1.0 / (T * (1 - alpha))  # u coefficients

    # Inequality: u_t ≥ −(R_t @ w) − z  ↔  −R_t @ w − z − u_t ≤ 0
    # → for each t: -R[t,:] @ w - z - u_t ≤ 0
    A_ub = np.zeros((T, n + 1 + T))
    b_ub = np.zeros(T)
    for t in range(T):
        A_ub[t, :n] = -R[t, :]
        A_ub[t, n] = -1.0
        A_ub[t, n + 1 + t] = -1.0

    # Equality: sum(w) = 1
    A_eq = np.zeros((1, n + 1 + T))
    A_eq[0, :n] = 1.0
    b_eq = np.array([1.0])

    # Bounds: 0 ≤ w ≤ 0.15, z free, u ≥ 0
    bounds = [(0.0, S_MAX_WEIGHT)] * n + [(None, None)] + [(0.0, None)] * T

    try:
        res = linprog(c, A_ub=A_ub, b_ub=b_ub, A_eq=A_eq, b_eq=b_eq, bounds=bounds,
                      method="highs")
        if res.success:
            w_opt = np.maximum(res.x[:n], 0.0)
            total = w_opt.sum()
            if total > 0:
                w_opt /= total
                return {t: float(w_opt[i]) for i, t in enumerate(tickers)}
    except Exception:
        pass
    return {t: 1.0 / n for t in tickers}


def run_portfolio_opt(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    label: str,
    variant: str = "hrp",   # "hrp" | "msharpe" | "mincvar"
    ticker_reports: dict[str, list[dict]] | None = None,
    record_full_trades: bool = False,
) -> dict:
    """
    S 포트폴리오 최적화 (월간 리밸런스).
    variant: 'hrp', 'msharpe', 'mincvar'.
    유니버스: 18개월 내 buy report 종목.
    Trailing 252d 일별 수익률로 가중치 계산.
    월말 신호 → 다음 거래일 시가 체결.
    비용: 총 NAV × 턴오버 × 편도 비용.
    """
    # ── v15 프리플라이트: 의존성 누락은 즉시 크게 실패 ──────────────────────
    # (과거 버그: scipy 미설치 시 월별 except가 ImportError를 삼켜
    #  NAV 1.0 평탄·거래 0건의 "유령 전략"이 조용히 출력되었다)
    if variant in ("msharpe", "mincvar"):
        try:
            import scipy.optimize  # noqa: F401
        except ImportError as e:
            raise RuntimeError(
                f"S({variant}) 전략은 scipy가 필요합니다. "
                f"`pip install -r requirements.txt` 후 재실행하세요: {e}"
            ) from e

    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}   # ticker -> {shares, entry_price, cost, last_close, entry_date, ...}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []

    # Build per-ticker valid date ranges
    ticker_valid: dict[str, list[tuple[dt.date, dt.date]]] = {}
    for rdate, ticker, source, n_clubs in reports:
        expire = rdate + dt.timedelta(days=int(S_UNIVERSE_MONTHS * 30.44))
        ticker_valid.setdefault(ticker, []).append((rdate, expire))

    # Calendar helpers
    cal_s = pd.Series(calendar)
    month_ends: set[dt.date] = set(
        cal_s.groupby(cal_s.apply(lambda d: (d.year, d.month))).last().values
    )
    month_firsts: set[dt.date] = set(
        cal_s.groupby(cal_s.apply(lambda d: (d.year, d.month))).first().values
    )

    # Target weights queue: computed at month-end, applied at next month-first open
    target_weights: dict[str, float] = {}   # ticker -> weight (from last month-end)

    for day in calendar:
        day_ts = pd.Timestamp(day)

        # Month-first: execute rebalance
        if day in month_firsts and target_weights:
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            if nav_now <= 0:
                nav_now = float(START_CAPITAL)

            new_positions: dict[str, dict] = {}
            new_cash = 0.0
            total_turnover = 0.0

            # Close positions not in new targets (or weight drops to 0)
            for ticker, pos in list(positions.items()):
                new_w = target_weights.get(ticker, 0.0)
                if new_w == 0.0:
                    q = _get_quote(prices, ticker, day)
                    exit_price = float(q["open"]) if (q is not None and float(q["open"]) > 0) else pos["last_close"]
                    proceeds = pos["shares"] * exit_price * (1 - COST_PER_SIDE)
                    new_cash += proceeds
                    total_turnover += pos["shares"] * exit_price / nav_now
                    trades.append(_close_trade(ticker, pos, day, exit_price, "s_rebalance_exit",
                                               ticker_reports, record_full_trades, None))

            cash_after_close = cash + new_cash

            # Open / resize positions
            for ticker, w in target_weights.items():
                if w <= 0:
                    continue
                target_value = nav_now * w
                cur_pos = positions.get(ticker)
                cur_value = cur_pos["shares"] * cur_pos["last_close"] if cur_pos else 0.0

                df = prices.get(ticker)
                if df is None or day_ts not in df.index:
                    if cur_pos:
                        new_positions[ticker] = cur_pos
                    continue

                trade_price = float(df.loc[day_ts]["open"])
                if trade_price <= 0:
                    if cur_pos:
                        new_positions[ticker] = cur_pos
                    continue

                delta_value = target_value - cur_value
                turnover_frac = abs(delta_value) / nav_now
                total_turnover += turnover_frac

                new_shares = target_value * (1 - COST_PER_SIDE) / trade_price
                new_cost   = target_value

                if cur_pos:
                    # Partial trade record for the delta
                    if delta_value < 0:
                        sell_shares = cur_pos["shares"] - new_shares
                        if sell_shares > 0:
                            proceeds = sell_shares * trade_price * (1 - COST_PER_SIDE)
                            cash_after_close += proceeds
                            trades.append(_close_trade(ticker, cur_pos, day, trade_price,
                                                        "s_rebalance_trim",
                                                        ticker_reports, record_full_trades, None,
                                                        shares_override=sell_shares,
                                                        cost_override=cur_pos["cost"] * (sell_shares / cur_pos["shares"])))
                    else:
                        add_budget = min(delta_value, cash_after_close)
                        if add_budget < 0:
                            add_budget = 0.0
                        cash_after_close -= add_budget
                    new_positions[ticker] = {
                        "shares": new_shares,
                        "entry_price": trade_price,
                        "entry_date": day,
                        "cost": new_cost,
                        "last_close": trade_price,
                        "source": cur_pos["source"],
                        "n_clubs": cur_pos["n_clubs"],
                        "display_name": cur_pos["display_name"],
                        "market": cur_pos["market"],
                        "target_price": cur_pos.get("target_price"),
                    }
                else:
                    buy_budget = min(target_value, cash_after_close)
                    if buy_budget < target_value * 0.5:
                        continue
                    cash_after_close -= buy_budget
                    act_shares = buy_budget * (1 - COST_PER_SIDE) / trade_price
                    dn = ticker
                    mkt = "KR"
                    if ticker_reports:
                        tr_l = ticker_reports.get(ticker, [])
                        past = [r for r in tr_l if r["report_date"] <= day]
                        if past:
                            dn = past[-1]["display_name"]
                            mkt = past[0].get("market", "KR")
                    new_positions[ticker] = {
                        "shares": act_shares,
                        "entry_price": trade_price,
                        "entry_date": day,
                        "cost": buy_budget,
                        "last_close": trade_price,
                        "source": "",
                        "n_clubs": 1,
                        "display_name": dn,
                        "market": mkt,
                        "target_price": None,
                    }

            positions = new_positions
            cash = cash_after_close
            target_weights = {}

        # Update last_close
        for ticker, pos in positions.items():
            df = prices.get(ticker)
            if df is not None and day_ts in df.index:
                pos["last_close"] = float(df.loc[day_ts]["close"])

        # Month-end: compute new target weights (point-in-time signal)
        if day in month_ends:
            lookback_start = day - dt.timedelta(days=S_LOOKBACK_DAYS + 30)
            # Build active universe
            active: list[str] = []
            for ticker, ranges in ticker_valid.items():
                if not any(start <= day <= end for start, end in ranges):
                    continue
                df = prices.get(ticker)
                if df is None or day_ts not in df.index:
                    continue
                active.append(ticker)

            if len(active) >= S_MIN_STOCKS:
                # Build return matrix
                day_ts_start = pd.Timestamp(lookback_start)
                ret_cols: dict[str, pd.Series] = {}
                for ticker in active:
                    df = prices[ticker]
                    sub = df.loc[(df.index >= day_ts_start) & (df.index <= day_ts), "close"]
                    if len(sub) < 30:
                        continue
                    r = sub.pct_change().dropna()
                    ret_cols[ticker] = r

                if len(ret_cols) >= S_MIN_STOCKS:
                    ret_df = pd.DataFrame(ret_cols).dropna(how="any")
                    if len(ret_df) >= 20 and len(ret_df.columns) >= S_MIN_STOCKS:
                        try:
                            if variant == "hrp":
                                w_dict = _hrp_weights(ret_df)
                            elif variant == "msharpe":
                                w_dict = _msharpe_weights(ret_df)
                            else:  # mincvar
                                w_dict = _mincvar_weights(ret_df)
                            target_weights = {t: v for t, v in w_dict.items() if v > 0.001}
                        except Exception as e:
                            print(f"  S({variant}) weight computation failed on {day}: {e}", flush=True)

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    # Force-close at end
    last_day = calendar[-1]
    for ticker, pos in list(positions.items()):
        trades.append(_close_trade(ticker, pos, last_day, pos["last_close"], "데이터_종료_미청산",
                                   ticker_reports, record_full_trades, None))

    # v15 sanity guard: a portfolio-opt run that never traded is a wiring bug, not a result
    if not trades:
        raise RuntimeError(
            f"S({variant}) 백테스트가 거래 0건으로 종료 — 가중치 계산이 매월 실패했을 가능성. "
            "로그의 'weight computation failed' 메시지를 확인하세요."
        )

    return _compute_result(nav_series, trades, START_CAPITAL, label, open_positions=positions)


# ──────────────────────────────────────────────────────────────────────────────
# Strategy T: 코어-KOSPI 샹들리에 (KOSPI-parked idle cash)
#
# 설계 원칙:
#   - D+ Chandelier Optuna 규칙(진입/청산/사이징)과 완전 동일.
#   - 유휴 현금(비어있는 슬롯 현금 + DCA 기여금) → 모두 KOSPI 지수 익스포저로 주차.
#   - NAV = 주식 포지션 + KOSPI 파킹 잔액.
#   - 일별: 파킹 잔액은 KOSPI close-to-close 수익률을 반영.
#   - 진입 시: 필요 금액만큼 KOSPI 익스포저 매도 (비용 0.05%/side 인덱스 ETF 가정)
#             → 해당 금액으로 주식 매수 (비용 0.3%/side 기존과 동일).
#   - 청산 시: 주식 매도 수익금(비용 0.3% 후) → KOSPI 익스포저 매수 (비용 0.05%).
#   - 이 설계에서 전략의 베이스라인 = KOSPI DCA.
#     주식 픽은 KOSPI 대비 순 알파를 더하거나 뺄 뿐.
#   - DCA 기여금: KOSPI 익스포저로 즉시 편입 (이 시뮬레이션은 NAV-only, DCA 없음,
#     같은 START_CAPITAL 100M 사용 — DCA 비교는 wealth_sim에서 처리).
#   - KOSPI 인덱스 ETF 편도 비용 0.05% 가정: 실제 KODEX200 기준 0.02~0.05% 스프레드.
#     이 가정을 method note에 명시.
#
# T  (always-KOSPI): 항상 KOSPI 파킹.
# T- (regime-aware): KOSPI < 200MA이면 파킹 이자율 0% (현금). Faber 레짐.
#
# CSV: 주식 거래만 기록 + 헤더 주석에 "KOSPI 파킹 거래 미포함" 명시.
# ──────────────────────────────────────────────────────────────────────────────

KOSPI_PARK_COST = 0.0005   # 0.05%/side for index ETF switches (KODEX200 기준 가정)


def run_kospi_core_chandelier(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    label: str,
    kospi: pd.Series,
    atr_period: int,
    atr_mult: float,
    max_positions: int,
    ticker_reports: dict[str, list[dict]] | None = None,
    record_full_trades: bool = False,
    regime_aware: bool = False,
) -> dict:
    """
    T 코어-KOSPI 샹들리에.

    D+ Chandelier 규칙 완전 동일; 유휴 현금을 KOSPI 익스포저로 주차.
    진입: KOSPI 파킹 → 주식 (0.05% + 0.3% 편도 각각).
    청산: 주식 → KOSPI 파킹 (0.3% + 0.05% 편도 각각).

    regime_aware=True (T-): KOSPI < 200MA이면 파킹 수익률 0% (현금).

    비용 공시: 인덱스 ETF 전환 비용 0.05%/side는 KODEX200 기준 추정값.
    실제 체결 스프레드·세금·운용보수는 개별 계좌마다 상이할 수 있음.
    """
    START_CAPITAL = 100_000_000
    cash = float(START_CAPITAL)          # this is now the "stock cash" reserve (should stay ~0)
    kospi_parked = 0.0                   # notional KOSPI exposure (in KRW value)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    pending_exits: set[str] = set()

    # Precompute KOSPI 200MA series for regime filter
    kospi_ma200: pd.Series | None = None
    if regime_aware:
        kospi_ma200 = kospi.rolling(200, min_periods=100).mean()

    # Align KOSPI to calendar
    kospi_dates = kospi.index

    # Initialise: all START_CAPITAL goes to KOSPI parking at cost (0.05% entry)
    kospi_parked = START_CAPITAL * (1 - KOSPI_PARK_COST)
    cash = 0.0

    pending_entries = build_pending_entries(reports, calendar, consensus_only=False)

    prev_kospi_close: float | None = None

    for day in calendar:
        day_ts = pd.Timestamp(day)

        # ── Daily KOSPI return on parked balance ──────────────────────────────
        kospi_close_today = asof_value(kospi, day)
        if kospi_close_today > 0:
            if prev_kospi_close is not None and prev_kospi_close > 0:
                # Regime gate: if regime_aware and KOSPI < 200MA, no return (parked at 0%)
                if regime_aware and kospi_ma200 is not None:
                    ma200_val = asof_value(kospi_ma200, day)
                    use_kospi_return = (ma200_val <= 0 or kospi_close_today >= ma200_val)
                else:
                    use_kospi_return = True

                if use_kospi_return and kospi_parked > 0:
                    daily_kospi_ret = kospi_close_today / prev_kospi_close - 1
                    kospi_parked *= (1 + daily_kospi_ret)
            prev_kospi_close = kospi_close_today
        else:
            if prev_kospi_close is None:
                prev_kospi_close = asof_value(kospi, day) or None

        # ── Execute pending exits (next open after stop signal) ───────────────
        to_exit = [t for t in list(pending_exits) if t in positions]
        for ticker in to_exit:
            pos = positions[ticker]
            q = _get_quote(prices, ticker, day)
            if q is None or float(q["open"]) <= 0:
                continue
            exit_price = float(q["open"])
            stock_proceeds = pos["shares"] * exit_price * (1 - COST_PER_SIDE)
            # Park proceeds back into KOSPI (0.05% entry cost)
            kospi_parked += stock_proceeds * (1 - KOSPI_PARK_COST)
            trades.append(_close_trade(ticker, pos, day, exit_price,
                                       f"t_chandelier_ATR{atr_mult}",
                                       ticker_reports, record_full_trades, None))
            del positions[ticker]
            pending_exits.discard(ticker)

        # ── Execute pending entries ───────────────────────────────────────────
        if day in pending_entries:
            nav_now = (
                kospi_parked
                + sum(p["shares"] * p["last_close"] for p in positions.values())
            )
            slots = max_positions - len(positions)
            candidates = list(
                {t: (t, s, nc) for t, s, nc in pending_entries[day]
                 if t not in positions}.values()
            )
            for ticker, source, n_clubs in candidates[:slots]:
                df = prices.get(ticker)
                if df is None or day_ts not in df.index:
                    continue
                entry_price = float(df.loc[day_ts]["open"])
                if entry_price <= 0:
                    continue

                budget = nav_now * POSITION_WEIGHT
                if budget > kospi_parked:
                    budget = kospi_parked
                if budget < nav_now * POSITION_WEIGHT * 0.5:
                    continue

                # Sell KOSPI parking (0.05% cost) → receive cash for stock purchase
                kospi_parked -= budget
                stock_budget = budget * (1 - KOSPI_PARK_COST)  # proceeds after ETF sell cost
                shares = stock_budget * (1 - COST_PER_SIDE) / entry_price
                total_spent = budget   # taken from KOSPI parking

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

                atr_col = "atr20" if atr_period == 20 else "atr"
                atr_val = asof_value(df[atr_col] if atr_col in df.columns else df["atr"], day)
                stop = entry_price - atr_mult * atr_val if atr_val else entry_price * 0.75

                pos = {
                    "shares": shares,
                    "entry_price": entry_price,
                    "entry_date": day,
                    "cost": total_spent,
                    "last_close": entry_price,
                    "highest": entry_price,
                    "stop": stop,
                    "source": source,
                    "n_clubs": n_clubs,
                    "display_name": display_name,
                    "market": market,
                    "target_price": tp,
                }
                positions[ticker] = pos

        # ── Update positions + check chandelier stop ──────────────────────────
        for ticker, pos in list(positions.items()):
            df = prices.get(ticker)
            if df is None or day_ts not in df.index:
                continue
            close = float(df.loc[day_ts]["close"])
            pos["last_close"] = close
            pos["highest"] = max(pos.get("highest", close), close)
            atr_col = "atr20" if atr_period == 20 else "atr"
            atr_val = asof_value(df[atr_col] if atr_col in df.columns else df["atr"], day)
            if atr_val:
                new_stop = pos["highest"] - atr_mult * atr_val
                pos["stop"] = max(pos.get("stop", 0.0), new_stop)
            if pos.get("stop") and close < pos["stop"] and ticker not in pending_exits:
                pending_exits.add(ticker)

        nav = kospi_parked + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    # Force-close remaining positions at end
    last_day = calendar[-1]
    for ticker, pos in list(positions.items()):
        trades.append(_close_trade(ticker, pos, last_day, pos["last_close"],
                                   "데이터_종료_미청산",
                                   ticker_reports, record_full_trades, None))

    result = _compute_result(nav_series, trades, START_CAPITAL, label,
                             open_positions=positions)
    result["kospi_parking_note"] = (
        "T 코어-KOSPI 샹들리에: 유휴 현금을 KOSPI 지수 익스포저로 주차. "
        "인덱스 ETF(KODEX200 기준) 전환 비용 0.05%/side 가정 (실제 스프레드·세금 상이 가능). "
        "주식 편도 비용 0.3% (기존 동일). "
        "CSV는 주식 거래만 기록; KOSPI 파킹 전환은 별도 미기록."
    )
    if regime_aware:
        result["kospi_parking_note"] += (
            " T- 레짐 변형: KOSPI < 200MA 구간에서는 파킹 수익률 0% (현금 보유). "
            "참조: Faber (2007) 10개월 이동평균 레짐 필터."
        )
    return result


# ──────────────────────────────────────────────────────────────────────────────
# Extension gauge helper
# ATR% Multiple from 50-MA (Minervini 커뮤니티 관행, TradingView Fred6724)
#   A = ATR(14) / price   (ATR%)
#   B = (price - 50SMA) / 50SMA  (% gain from 50-SMA)
#   extension = B / A
# Returns None if insufficient data.
# ──────────────────────────────────────────────────────────────────────────────

def compute_extension(df: pd.DataFrame, day: dt.date) -> float | None:
    """
    과열 게이지: ATR% Multiple from 50-MA.
    A = ATR(14)/price,  B = (price-50SMA)/50SMA
    extension = B / A.
    양수 = 50SMA 위 과열; 음수 = 50SMA 아래.
    None = 데이터 불충분.
    """
    price = asof_value(df["close"], day)
    if price <= 0:
        return None
    atr14 = asof_value(df["atr14"], day)
    if not atr14 or atr14 <= 0:
        return None
    ma50 = asof_value(df["ma50"], day)
    if not ma50 or ma50 <= 0:
        return None
    A = atr14 / price          # ATR%
    B = (price - ma50) / ma50  # % from 50SMA
    return round(B / A, 2)


# ──────────────────────────────────────────────────────────────────────────────
# Strategy U: 코어-KOSPI 샹들리에 + 과열 스케일아웃
#
# 설계: T- (regime-aware KOSPI 파킹) 와 완전 동일, 추가 규칙:
#   - 과열 게이지: extension = B/A  (ATR(14)%, 50SMA, Minervini circle)
#   - extension > 8× 시 → 보유 주수의 절반 매도 (1차 스케일아웃)
#     - 나머지 절반은 샹들리에 트레일 계속
#   - extension 나중에 > 12× 시 → 남은 포지션의 절반 다시 매도 (2차 스케일아웃)
#   - 스케일아웃은 포지션당 1회: 1차 완료 후 재발동 없음
#     (단, 진입 때 초기화 — 완전 청산 후 재진입 시 리셋)
#   - 스케일아웃 수익금 → KOSPI 파킹 (T- 규칙과 동일)
# ──────────────────────────────────────────────────────────────────────────────

U_SCALEOUT_EXT_1 = 8.0    # 1차 스케일아웃: extension > 8×
U_SCALEOUT_EXT_2 = 12.0   # 2차 스케일아웃: extension > 12×


def run_kospi_core_chandelier_scaleout(
    prices: dict[str, pd.DataFrame],
    reports: list[tuple[dt.date, str, str, int]],
    calendar: list[dt.date],
    label: str,
    kospi: pd.Series,
    atr_period: int,
    atr_mult: float,
    max_positions: int,
    ticker_reports: dict[str, list[dict]] | None = None,
    record_full_trades: bool = False,
) -> dict:
    """
    U 코어-KOSPI 샹들리에 + 과열 스케일아웃.

    T- (regime-aware) 규칙 완전 동일 +
    extension(ATR%×50SMA) > 8× → 절반 익절 → KOSPI 파킹.
    extension > 12× → 남은 절반 다시 익절 → KOSPI 파킹.
    트리거는 포지션당 1회씩만 발동 (오실레이션 재발동 없음).
    새 포지션 진입 시 카운터 초기화.
    """
    START_CAPITAL = 100_000_000
    cash = 0.0
    kospi_parked = START_CAPITAL * (1 - KOSPI_PARK_COST)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    pending_exits: set[str] = set()

    # Precompute KOSPI 200MA for regime filter
    kospi_ma200 = kospi.rolling(200, min_periods=100).mean()

    pending_entries = build_pending_entries(reports, calendar, consensus_only=False)
    prev_kospi_close: float | None = None

    for day in calendar:
        day_ts = pd.Timestamp(day)

        # ── Daily KOSPI return on parked balance ──────────────────────────────
        kospi_close_today = asof_value(kospi, day)
        if kospi_close_today > 0:
            if prev_kospi_close is not None and prev_kospi_close > 0:
                ma200_val = asof_value(kospi_ma200, day)
                use_kospi_return = (ma200_val <= 0 or kospi_close_today >= ma200_val)
                if use_kospi_return and kospi_parked > 0:
                    daily_kospi_ret = kospi_close_today / prev_kospi_close - 1
                    kospi_parked *= (1 + daily_kospi_ret)
            prev_kospi_close = kospi_close_today
        else:
            if prev_kospi_close is None:
                prev_kospi_close = asof_value(kospi, day) or None

        # ── Execute pending exits (chandelier stop — next open) ───────────────
        to_exit = [t for t in list(pending_exits) if t in positions]
        for ticker in to_exit:
            pos = positions[ticker]
            q = _get_quote(prices, ticker, day)
            if q is None or float(q["open"]) <= 0:
                continue
            exit_price = float(q["open"])
            stock_proceeds = pos["shares"] * exit_price * (1 - COST_PER_SIDE)
            kospi_parked += stock_proceeds * (1 - KOSPI_PARK_COST)
            trades.append(_close_trade(ticker, pos, day, exit_price,
                                       f"u_chandelier_ATR{atr_mult}",
                                       ticker_reports, record_full_trades, None))
            del positions[ticker]
            pending_exits.discard(ticker)

        # ── Execute pending entries ───────────────────────────────────────────
        if day in pending_entries:
            nav_now = (
                kospi_parked
                + sum(p["shares"] * p["last_close"] for p in positions.values())
            )
            slots = max_positions - len(positions)
            candidates = list(
                {t: (t, s, nc) for t, s, nc in pending_entries[day]
                 if t not in positions}.values()
            )
            for ticker, source, n_clubs in candidates[:slots]:
                df = prices.get(ticker)
                if df is None or day_ts not in df.index:
                    continue
                entry_price = float(df.loc[day_ts]["open"])
                if entry_price <= 0:
                    continue

                budget = nav_now * POSITION_WEIGHT
                if budget > kospi_parked:
                    budget = kospi_parked
                if budget < nav_now * POSITION_WEIGHT * 0.5:
                    continue

                kospi_parked -= budget
                stock_budget = budget * (1 - KOSPI_PARK_COST)
                shares = stock_budget * (1 - COST_PER_SIDE) / entry_price
                total_spent = budget

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

                atr_col = "atr20" if atr_period == 20 else "atr"
                atr_val = asof_value(df[atr_col] if atr_col in df.columns else df["atr"], day)
                stop = entry_price - atr_mult * atr_val if atr_val else entry_price * 0.75

                pos = {
                    "shares": shares,
                    "entry_price": entry_price,
                    "entry_date": day,
                    "cost": total_spent,
                    "last_close": entry_price,
                    "highest": entry_price,
                    "stop": stop,
                    "source": source,
                    "n_clubs": n_clubs,
                    "display_name": display_name,
                    "market": market,
                    "target_price": tp,
                    # U-specific: scale-out state (one-time triggers)
                    "scaleout1_done": False,   # extension > 8× triggered
                    "scaleout2_done": False,   # extension > 12× triggered
                }
                positions[ticker] = pos

        # ── Update positions + check chandelier stop + extension scale-out ────
        for ticker, pos in list(positions.items()):
            df = prices.get(ticker)
            if df is None or day_ts not in df.index:
                continue
            close = float(df.loc[day_ts]["close"])
            pos["last_close"] = close
            pos["highest"] = max(pos.get("highest", close), close)

            atr_col = "atr20" if atr_period == 20 else "atr"
            atr_val = asof_value(df[atr_col] if atr_col in df.columns else df["atr"], day)
            if atr_val:
                new_stop = pos["highest"] - atr_mult * atr_val
                pos["stop"] = max(pos.get("stop", 0.0), new_stop)

            # Chandelier stop check
            if pos.get("stop") and close < pos["stop"] and ticker not in pending_exits:
                pending_exits.add(ticker)
                continue  # don't check scale-out on same day as stop trigger

            # Extension-based scale-out (one-time, FIFO check: 1st then 2nd tier)
            ext = compute_extension(df, day)
            if ext is not None:
                # 1차 스케일아웃: extension > 8×, only if not yet done
                if not pos["scaleout1_done"] and ext > U_SCALEOUT_EXT_1:
                    half_shares = pos["shares"] * 0.5
                    half_cost = pos["cost"] * 0.5
                    proceeds = half_shares * close * (1 - COST_PER_SIDE)
                    kospi_parked += proceeds * (1 - KOSPI_PARK_COST)
                    trade = _close_trade(
                        ticker, pos, day, close,
                        f"u_scaleout1_ext{ext:.1f}x",
                        ticker_reports, record_full_trades, None,
                        shares_override=half_shares,
                        cost_override=half_cost,
                    )
                    trades.append(trade)
                    pos["shares"] -= half_shares
                    pos["cost"] -= half_cost
                    pos["scaleout1_done"] = True

                # 2차 스케일아웃: extension > 12×, only if 1st done and not yet 2nd
                elif pos["scaleout1_done"] and not pos["scaleout2_done"] and ext > U_SCALEOUT_EXT_2:
                    quarter_shares = pos["shares"] * 0.5
                    quarter_cost = pos["cost"] * 0.5
                    proceeds = quarter_shares * close * (1 - COST_PER_SIDE)
                    kospi_parked += proceeds * (1 - KOSPI_PARK_COST)
                    trade = _close_trade(
                        ticker, pos, day, close,
                        f"u_scaleout2_ext{ext:.1f}x",
                        ticker_reports, record_full_trades, None,
                        shares_override=quarter_shares,
                        cost_override=quarter_cost,
                    )
                    trades.append(trade)
                    pos["shares"] -= quarter_shares
                    pos["cost"] -= quarter_cost
                    pos["scaleout2_done"] = True

        nav = kospi_parked + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    # Force-close remaining positions at end
    last_day = calendar[-1]
    for ticker, pos in list(positions.items()):
        trades.append(_close_trade(ticker, pos, last_day, pos["last_close"],
                                   "데이터_종료_미청산",
                                   ticker_reports, record_full_trades, None))

    result = _compute_result(nav_series, trades, START_CAPITAL, label,
                             open_positions=positions)
    result["kospi_parking_note"] = (
        "U 코어-KOSPI 샹들리에 + 과열 스케일아웃: T- 레짐 필터 동일 + "
        "ATR% Multiple from 50-MA (extension = B/A, A=ATR14/price, B=(price-50SMA)/50SMA). "
        "extension > 8× → 절반 익절 → KOSPI 파킹; extension > 12× → 나머지 절반 다시 익절. "
        "트리거는 포지션당 1회 (재발동 없음; 재진입 시 초기화). "
        "출처: Minervini 커뮤니티 관행, TradingView Fred6724."
    )
    return result


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

    # ── v8: all reports (single-club included) used as entry signals
    print(f"  Total signal reports (all clubs): {len(reports)}", flush=True)
    print(f"  Consensus (≥2 clubs) subset: {len([(d,t,s,n) for d,t,s,n in reports if n>=2])} reports", flush=True)

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

    print("\n── Running strategy battery (v15: S silent-failure fix, signals rework) ──", flush=True)

    # A. 12개월 보유 (baseline)
    print("A. 12개월 보유...", flush=True)
    result_A = run_fixed_hold(
        prices, reports, calendar, hold_months=12,
        label="A_12mo", ticker_reports=ticker_reports, record_full_trades=True,
    )
    print(f"   IS sharpe={result_A['in_sample'].get('sharpe')}  OOS sharpe={result_A['out_of_sample'].get('sharpe')}", flush=True)

    # B. 36개월 보유
    print("B. 36개월 보유...", flush=True)
    result_B = run_fixed_hold(
        prices, reports, calendar, hold_months=36,
        label="B_36mo", ticker_reports=ticker_reports, record_full_trades=True,
    )
    print(f"   IS sharpe={result_B['in_sample'].get('sharpe')}  OOS sharpe={result_B['out_of_sample'].get('sharpe')}", flush=True)

    # C. 내러티브 홀드
    print("C. 내러티브 홀드 (200MA thesis-break)...", flush=True)
    result_C = run_narrative_hold(
        prices, reports, calendar,
        label="C_narrative", ticker_reports=ticker_reports, record_full_trades=True,
    )
    print(f"   IS sharpe={result_C['in_sample'].get('sharpe')}  OOS sharpe={result_C['out_of_sample'].get('sharpe')}", flush=True)

    # D. 샹들리에 래칫 (ATR42×5 trailing) — literature default
    print("D. 샹들리에 래칫 (ATR×5)...", flush=True)
    result_D = run_chandelier(
        prices, reports, calendar,
        label="D_chandelier", ticker_reports=ticker_reports, record_full_trades=True,
    )
    print(f"   IS sharpe={result_D['in_sample'].get('sharpe')}  OOS sharpe={result_D['out_of_sample'].get('sharpe')}", flush=True)

    # E. 절반익절 + 러너
    print("E. 절반익절 + 러너...", flush=True)
    result_E = run_half_exit_runner(
        prices, reports, calendar,
        label="E_half_runner", ticker_reports=ticker_reports, record_full_trades=True,
    )
    print(f"   IS sharpe={result_E['in_sample'].get('sharpe')}  OOS sharpe={result_E['out_of_sample'].get('sharpe')}", flush=True)

    # F. 모멘텀 필터 + 내러티브 홀드
    print("F. 모멘텀 필터 + 내러티브 홀드...", flush=True)
    result_F = run_narrative_hold(
        prices, reports, calendar,
        label="F_momentum_narrative", ticker_reports=ticker_reports, record_full_trades=True,
        momentum_filter_entry=True,
    )
    print(f"   IS sharpe={result_F['in_sample'].get('sharpe')}  OOS sharpe={result_F['out_of_sample'].get('sharpe')}", flush=True)

    # G. 딥바이
    print("G. 딥바이 (≥20% dip, single-club OK)...", flush=True)
    result_G = run_dip_buy(
        prices, reports, calendar,
        label="G_dip_buy", ticker_reports=ticker_reports, record_full_trades=True,
    )
    print(f"   IS sharpe={result_G['in_sample'].get('sharpe')}  OOS sharpe={result_G['out_of_sample'].get('sharpe')}", flush=True)

    # H. 미너비니 트렌드 템플릿
    print("H. 미너비니 트렌드 템플릿...", flush=True)
    result_H = run_minervini(
        prices, reports, calendar,
        label="H_minervini", ticker_reports=ticker_reports, record_full_trades=True,
        kospi=kospi,
    )
    print(f"   IS sharpe={result_H['in_sample'].get('sharpe')}  OOS sharpe={result_H['out_of_sample'].get('sharpe')}", flush=True)

    # I. 슈퍼트렌드(10, 3)
    print("I. 슈퍼트렌드(10, 3)...", flush=True)
    result_I = run_supertrend(
        prices, reports, calendar,
        label="I_supertrend", ticker_reports=ticker_reports, record_full_trades=True,
    )
    print(f"   IS sharpe={result_I['in_sample'].get('sharpe')}  OOS sharpe={result_I['out_of_sample'].get('sharpe')}", flush=True)

    # J. 코어-새틀라이트 레버리지 (overlay on D)
    print("J. 코어-새틀라이트 레버리지 오버레이 (on D)...", flush=True)
    result_J = run_core_satellite_leverage(
        chandelier_nav=result_D["nav_df"],
        kospi=kospi,
        label="J_core_satellite",
    )
    print(f"   IS sharpe={result_J['in_sample'].get('sharpe')}  OOS sharpe={result_J['out_of_sample'].get('sharpe')}", flush=True)

    # K. R:R 2.5 추세추종
    print("K. R:R 2.5 추세추종 (max 10 positions)...", flush=True)
    result_K = run_rr_trend(
        prices, reports, calendar,
        label="K_rr_trend", ticker_reports=ticker_reports, record_full_trades=True,
    )
    print(f"   IS sharpe={result_K['in_sample'].get('sharpe')}  OOS sharpe={result_K['out_of_sample'].get('sharpe')}", flush=True)

    # L. 민리버전 (Connors RSI-2) — run for diagnosis, EXCLUDED from headline selector
    # v11: same-bar lookahead fixed; still dies from 0.6% round-trip cost × high turnover.
    # Epitaph: RSI-2 민리버전은 거래비용으로 사망 — 구현 검증 후 제외.
    print("L. 민리버전 Connors RSI-2 (비용 사망 진단용, 셀렉터 제외)...", flush=True)
    result_L = run_rsi2_mean_reversion(
        prices, reports, calendar,
        label="L_rsi2_reversion", ticker_reports=ticker_reports, record_full_trades=True,
    )
    print(f"   IS sharpe={result_L['in_sample'].get('sharpe')}  OOS sharpe={result_L['out_of_sample'].get('sharpe')}  trades={result_L['metrics']['trades']}  MDD={result_L['metrics']['mdd_pct']}%", flush=True)

    # M. 단기 리버설 (monthly bottom-quintile) — run for diagnosis, EXCLUDED from headline selector
    # v11: positions.clear() bug fixed, same-bar lookahead fixed; still dies from monthly
    # full-turnover cost (0.6% × ~12 rebalances/yr on full NAV).
    # Epitaph: 단기 리버설은 거래비용으로 사망 — 구현 검증 후 제외.
    print("M. 단기 리버설 monthly bottom-quintile (비용 사망 진단용, 셀렉터 제외)...", flush=True)
    result_M = run_short_term_reversal(
        prices, reports, calendar,
        label="M_short_reversal", ticker_reports=ticker_reports, record_full_trades=True,
    )
    print(f"   IS sharpe={result_M['in_sample'].get('sharpe')}  OOS sharpe={result_M['out_of_sample'].get('sharpe')}  trades={result_M['metrics']['trades']}  MDD={result_M['metrics']['mdd_pct']}%", flush=True)

    # N. 52주 고가 근접 (George & Hwang 2004)
    print("N. 52주 고가 근접 (George & Hwang 2004)...", flush=True)
    result_N = run_52w_high_proximity(
        prices, reports, calendar,
        label="N_52w_high", ticker_reports=ticker_reports, record_full_trades=True,
    )
    print(f"   IS sharpe={result_N['in_sample'].get('sharpe')}  OOS sharpe={result_N['out_of_sample'].get('sharpe')}", flush=True)

    # O. MTT alpha16 이식 — v11: same-bar lookahead fixed (signal at close → fill next open)
    print("O. MTT alpha16 (lookahead-fixed, Minervini RS+MTT+R-multiple exits)...", flush=True)
    result_O = run_mtt_alpha16(
        prices, reports, calendar,
        label="O_mtt_alpha16", ticker_reports=ticker_reports, record_full_trades=True,
    )
    print(f"   IS sharpe={result_O['in_sample'].get('sharpe')}  OOS sharpe={result_O['out_of_sample'].get('sharpe')}", flush=True)

    # P. 딥바이 샹들리에 하이브리드 (new v11)
    # Use D+ Optuna ATR mult if adopted, else D default ATR×5
    print("P. 딥바이 샹들리에 하이브리드 (진입=딥바이, 청산=ATR트레일, 스케일인)...", flush=True)
    # P runs with D default params initially; will be re-run with Optuna params after D+ eval
    result_P_default = run_deepbuy_chandelier(
        prices, reports, calendar,
        label="P_deepbuy_chandelier",
        ticker_reports=ticker_reports, record_full_trades=True,
        atr_mult=P_ATR_MULT_DEFAULT,
    )
    print(f"   IS sharpe={result_P_default['in_sample'].get('sharpe')}  OOS sharpe={result_P_default['out_of_sample'].get('sharpe')}", flush=True)

    # Q. 깡토 추세추종
    print("Q. 깡토 추세추종 (시장신호등+유닛사이징+RS+60d돌파+볼륨)...", flush=True)
    result_Q = run_kangto_trend(
        prices, reports, calendar,
        label="Q_kangto_trend",
        ticker_reports=ticker_reports, record_full_trades=True,
        kospi=kospi,
    )
    print(f"   IS sharpe={result_Q['in_sample'].get('sharpe')}  OOS sharpe={result_Q['out_of_sample'].get('sharpe')}  "
          f"win_rate={result_Q['metrics'].get('win_rate_pct')}%  trades={result_Q['metrics']['trades']}", flush=True)

    # R. Kelly 샹들리에 (D+ 규칙 + Kelly 포지션 사이즈)
    # Will be re-run with Optuna params after D+ eval; for now use D default
    print("R. Kelly 샹들리에 (D+ 규칙 + Kelly sizing)...", flush=True)
    result_R_default = run_kelly_chandelier(
        prices, reports, calendar,
        label="R_kelly_chandelier",
        ticker_reports=ticker_reports, record_full_trades=True,
        atr_mult=CHANDELIER_ATR_MULT,
    )
    print(f"   IS sharpe={result_R_default['in_sample'].get('sharpe')}  OOS sharpe={result_R_default['out_of_sample'].get('sharpe')}", flush=True)

    # S. 포트폴리오 최적화 — three variants
    print("S(a). HRP 포트폴리오 최적화...", flush=True)
    result_S_hrp = run_portfolio_opt(
        prices, reports, calendar,
        label="S_hrp",
        variant="hrp",
        ticker_reports=ticker_reports, record_full_trades=True,
    )
    print(f"   IS sharpe={result_S_hrp['in_sample'].get('sharpe')}  OOS sharpe={result_S_hrp['out_of_sample'].get('sharpe')}", flush=True)

    print("S(b). max-Sharpe 포트폴리오 최적화...", flush=True)
    result_S_msharpe = run_portfolio_opt(
        prices, reports, calendar,
        label="S_msharpe",
        variant="msharpe",
        ticker_reports=ticker_reports, record_full_trades=True,
    )
    print(f"   IS sharpe={result_S_msharpe['in_sample'].get('sharpe')}  OOS sharpe={result_S_msharpe['out_of_sample'].get('sharpe')}", flush=True)

    print("S(c). min-CVaR 포트폴리오 최적화...", flush=True)
    result_S_mincvar = run_portfolio_opt(
        prices, reports, calendar,
        label="S_mincvar",
        variant="mincvar",
        ticker_reports=ticker_reports, record_full_trades=True,
    )
    print(f"   IS sharpe={result_S_mincvar['in_sample'].get('sharpe')}  OOS sharpe={result_S_mincvar['out_of_sample'].get('sharpe')}", flush=True)

    # Best S variant by IS sharpe
    s_variants = {
        "S_hrp": result_S_hrp,
        "S_msharpe": result_S_msharpe,
        "S_mincvar": result_S_mincvar,
    }
    best_s_key = max(s_variants, key=lambda k: (s_variants[k].get("in_sample", {}).get("sharpe") or -999.0))
    best_s_result = s_variants[best_s_key]
    print(f"   Best S variant (IS sharpe): {best_s_key} → IS {best_s_result['in_sample'].get('sharpe')}  OOS {best_s_result['out_of_sample'].get('sharpe')}", flush=True)

    # All strategies for comparison (L/M included for diagnostics but flagged)
    all_strategies: dict[str, dict] = {
        "A_12mo": result_A,
        "B_36mo": result_B,
        "C_narrative": result_C,
        "D_chandelier": result_D,
        "E_half_runner": result_E,
        "F_momentum_narrative": result_F,
        "G_dip_buy": result_G,
        "H_minervini": result_H,
        "I_supertrend": result_I,
        "J_core_satellite": result_J,
        "K_rr_trend": result_K,
        "L_rsi2_reversion": result_L,
        "M_short_reversal": result_M,
        "N_52w_high": result_N,
        "O_mtt_alpha16": result_O,
        "P_deepbuy_chandelier": result_P_default,
        "Q_kangto_trend": result_Q,
        "R_kelly_chandelier": result_R_default,
        # S: all three sub-variants included, best one goes into selector
        "S_hrp": result_S_hrp,
        "S_msharpe": result_S_msharpe,
        "S_mincvar": result_S_mincvar,
        # T / T-: added after D+ Optuna + T runs (see below)
    }
    # Strategies excluded from headline selector (cost-death confirmed or sub-variants)
    # S sub-variants: only best_s_key is eligible; the other two are excluded from selector
    # T-: regime variant — not directly in selector (best of T/T- wins as "T. 코어-KOSPI 샹들리에")
    s_non_best = {k for k in s_variants if k != best_s_key}
    EXCLUDED_FROM_SELECTOR = {"L_rsi2_reversion", "M_short_reversal", "T-_kospi_core_regime", "U_chandelier_scaleout"} | s_non_best

    # ── D+ Optuna optimization ─────────────────────────────────────────────────
    print("\n── Optuna robust optimization (D+ chandelier) ───────────────────", flush=True)
    optuna_result = run_optuna_chandelier(prices, reports, calendar, ticker_reports=ticker_reports)
    optuna_meta = optuna_result.get("optuna_meta", {})
    d_plus_adopted = False
    result_Dplus = None

    if not optuna_result.get("skipped"):
        oos_sharpe_dplus = optuna_result.get("out_of_sample", {}).get("sharpe")
        is_sharpe_dplus  = optuna_result.get("in_sample", {}).get("sharpe")
        oos_sharpe_D     = result_D.get("out_of_sample", {}).get("sharpe")
        is_sharpe_D      = result_D.get("in_sample", {}).get("sharpe")

        # Adoption criteria: OOS within 80% of its own IS AND >= D's OOS
        oos_ok = (
            oos_sharpe_dplus is not None
            and is_sharpe_dplus is not None
            and oos_sharpe_dplus >= 0.8 * is_sharpe_dplus
            and (oos_sharpe_D is None or oos_sharpe_dplus >= oos_sharpe_D)
        )
        d_plus_adopted = oos_ok
        result_Dplus = optuna_result
        if d_plus_adopted:
            result_Dplus["label"] = "D+_chandelier_optuna"
            all_strategies["D+_chandelier_optuna"] = result_Dplus
            print(f"  D+ ADOPTED: IS={is_sharpe_dplus:.2f}  OOS={oos_sharpe_dplus:.2f}  (D OOS={oos_sharpe_D})", flush=True)
        else:
            print(f"  D+ NOT ADOPTED (OOS degraded): IS={is_sharpe_dplus}  OOS={oos_sharpe_dplus}  D OOS={oos_sharpe_D}", flush=True)

    # ── T / T-: 코어-KOSPI 샹들리에 (D+ params if adopted, else D defaults) ──
    # Use D+ Optuna params if available; otherwise fall back to D ATR×5 / 20 pos
    t_atr_period = ATR_PERIOD
    t_atr_mult   = CHANDELIER_ATR_MULT
    t_max_pos    = MAX_POSITIONS
    if d_plus_adopted and result_Dplus is not None:
        _bp = optuna_meta.get("best_params", {})
        t_atr_period = int(_bp.get("atr_period", ATR_PERIOD))
        t_atr_mult   = float(_bp.get("atr_mult", CHANDELIER_ATR_MULT))
        t_max_pos    = int(_bp.get("max_positions", MAX_POSITIONS))

    print(f"\nT. 코어-KOSPI 샹들리에 (always-KOSPI park, ATR{t_atr_mult}, {t_max_pos} slots)...", flush=True)
    result_T = run_kospi_core_chandelier(
        prices, reports, calendar,
        label="T_kospi_core_chandelier",
        kospi=kospi,
        atr_period=t_atr_period,
        atr_mult=t_atr_mult,
        max_positions=t_max_pos,
        ticker_reports=ticker_reports,
        record_full_trades=True,
        regime_aware=False,
    )
    print(f"   IS sharpe={result_T['in_sample'].get('sharpe')}  OOS sharpe={result_T['out_of_sample'].get('sharpe')}", flush=True)

    print(f"T-. 코어-KOSPI 샹들리에 레짐 변형 (KOSPI<200MA → 현금 파킹)...", flush=True)
    result_Tminus = run_kospi_core_chandelier(
        prices, reports, calendar,
        label="T-_kospi_core_regime",
        kospi=kospi,
        atr_period=t_atr_period,
        atr_mult=t_atr_mult,
        max_positions=t_max_pos,
        ticker_reports=ticker_reports,
        record_full_trades=True,
        regime_aware=True,
    )
    print(f"   IS sharpe={result_Tminus['in_sample'].get('sharpe')}  OOS sharpe={result_Tminus['out_of_sample'].get('sharpe')}", flush=True)

    # Add T / T- to all_strategies (after they are computed)
    all_strategies["T_kospi_core_chandelier"] = result_T
    all_strategies["T-_kospi_core_regime"] = result_Tminus

    # ── U: 코어-KOSPI 샹들리에 + 과열 스케일아웃 (T- identical + extension 8×/12×) ──
    print(f"\nU. 코어-KOSPI 샹들리에 + 과열 스케일아웃 (T- + ATR% extension 8×/12×)...", flush=True)
    result_U = run_kospi_core_chandelier_scaleout(
        prices, reports, calendar,
        label="U_chandelier_scaleout",
        kospi=kospi,
        atr_period=t_atr_period,
        atr_mult=t_atr_mult,
        max_positions=t_max_pos,
        ticker_reports=ticker_reports,
        record_full_trades=True,
    )
    print(f"   IS sharpe={result_U['in_sample'].get('sharpe')}  OOS sharpe={result_U['out_of_sample'].get('sharpe')}", flush=True)
    # U tenbagger metrics
    _u_max_single = result_U["metrics"].get("max_single_return_pct")
    _tm_max_single = result_Tminus["metrics"].get("max_single_return_pct")
    print(f"   U max single trade: {_u_max_single}%  vs T- max: {_tm_max_single}%", flush=True)
    all_strategies["U_chandelier_scaleout"] = result_U
    # U is NOT automatically in the selector — evaluated vs T- below

    # ── Re-run P and R with Optuna ATR params if D+ was adopted ────────────
    result_P = result_P_default
    result_R = result_R_default
    p_atr_mult_used = P_ATR_MULT_DEFAULT
    if d_plus_adopted and result_Dplus is not None:
        best_p = optuna_meta.get("best_params", {})
        p_atr_mult_used = float(best_p.get("atr_mult", P_ATR_MULT_DEFAULT))
        p_max_pos = int(best_p.get("max_positions", MAX_POSITIONS))
        print(f"P. 딥바이 샹들리에 재실행 (Optuna ATR mult={p_atr_mult_used}, max_pos={p_max_pos})...", flush=True)
        result_P = run_deepbuy_chandelier(
            prices, reports, calendar,
            label="P_deepbuy_chandelier",
            ticker_reports=ticker_reports, record_full_trades=True,
            atr_mult=p_atr_mult_used,
            max_positions=p_max_pos,
        )
        all_strategies["P_deepbuy_chandelier"] = result_P
        print(f"   P (Optuna params) IS sharpe={result_P['in_sample'].get('sharpe')}  OOS sharpe={result_P['out_of_sample'].get('sharpe')}", flush=True)
        # R uses same Optuna ATR params (it's the D+ rules with Kelly sizing)
        r_atr_period = int(best_p.get("atr_period", ATR_PERIOD))
        print(f"R. Kelly 샹들리에 재실행 (Optuna ATR mult={p_atr_mult_used})...", flush=True)
        result_R = run_kelly_chandelier(
            prices, reports, calendar,
            label="R_kelly_chandelier",
            ticker_reports=ticker_reports, record_full_trades=True,
            atr_period=r_atr_period,
            atr_mult=p_atr_mult_used,
            max_positions=p_max_pos,
        )
        all_strategies["R_kelly_chandelier"] = result_R
        print(f"   R (Optuna params) IS sharpe={result_R['in_sample'].get('sharpe')}  OOS sharpe={result_R['out_of_sample'].get('sharpe')}", flush=True)
        # T and T- were already run with Optuna params above; all_strategies already updated.

    # ── Per-strategy KOSPI DCA ratio (final strategy wealth / KOSPI DCA wealth)
    print("\nComputing per-strategy KOSPI DCA ratios (quick pass)...", flush=True)
    _kospi_dca_ratios: dict[str, dict[str, float | None]] = {}
    for key, r in all_strategies.items():
        ws_tmp = compute_wealth_simulation_multi(r["nav_df"], {"KOSPI": kospi}, strat_start, strat_end)
        strat_final = ws_tmp["final_strategy_value"]
        kospi_final = ws_tmp["final_benchmark_values"].get("KOSPI", 1)
        ratio = round(strat_final / kospi_final, 3) if kospi_final and kospi_final > 0 else None
        # IS-only ratio
        is_nav = r["nav_df"]
        is_mask = is_nav.index.date <= IS_END
        is_sub = is_nav[is_mask]
        oos_sub = is_nav[is_nav.index.date >= OOS_START]
        _kospi_dca_ratios[key] = {
            "full_ratio": ratio,
            "strat_final": round(strat_final),
            "kospi_final": round(kospi_final) if kospi_final else None,
        }

    # ── T promotion: pick better of T / T- (by full-period wealth sim ratio vs KOSPI DCA)
    # If the winner beats KOSPI DCA on full-period wealth sim AND IS+OOS sharpe >= D+'s,
    # it competes as a single "T. 코어-KOSPI 샹들리에" entry in the selector.
    # The loser variant is excluded from the selector.
    # This must run BEFORE the summary table so exclusion flags are correct.
    _dplus_ref = result_Dplus if result_Dplus is not None else result_D
    _dplus_is  = (_dplus_ref.get("in_sample", {}).get("sharpe") or -999.0)
    _dplus_oos = (_dplus_ref.get("out_of_sample", {}).get("sharpe") or -999.0)

    _t_ratio     = (_kospi_dca_ratios.get("T_kospi_core_chandelier", {}).get("full_ratio") or 0.0)
    _tm_ratio    = (_kospi_dca_ratios.get("T-_kospi_core_regime", {}).get("full_ratio") or 0.0)

    # Best T variant = higher full-period wealth ratio; tie-break by IS sharpe
    if _t_ratio >= _tm_ratio:
        _t_best_key, _t_best, _t_best_ratio = "T_kospi_core_chandelier", result_T, _t_ratio
        _t_other_key = "T-_kospi_core_regime"
    else:
        _t_best_key, _t_best, _t_best_ratio = "T-_kospi_core_regime", result_Tminus, _tm_ratio
        _t_other_key = "T_kospi_core_chandelier"

    # T promotion conditions: beats KOSPI DCA on full-period sim AND IS+OOS sharpe >= D+'s
    _t_best_is  = (_t_best.get("in_sample", {}).get("sharpe") or -999.0)
    _t_best_oos = (_t_best.get("out_of_sample", {}).get("sharpe") or -999.0)
    _t_promoted = (
        _t_best_ratio > 1.0
        and _t_best_is  >= _dplus_is
        and _t_best_oos >= _dplus_oos
    )

    # Exclude the losing T variant from selector; winning T stays in selector if promoted
    EXCLUDED_FROM_SELECTOR.add(_t_other_key)
    if _t_promoted:
        # Remove the winning variant from exclusions so it competes in headline selection
        EXCLUDED_FROM_SELECTOR.discard(_t_best_key)
    else:
        EXCLUDED_FROM_SELECTOR.add("T_kospi_core_chandelier")
        EXCLUDED_FROM_SELECTOR.add("T-_kospi_core_regime")

    t_promotion_verdict = (
        f"T_best={_t_best_key}  ratio={_t_best_ratio}x  "
        f"IS={_t_best_is}  OOS={_t_best_oos}  "
        f"D+/D IS={_dplus_is}  OOS={_dplus_oos}  "
        f"promoted={'YES — T becomes headline candidate' if _t_promoted else 'NO — switching costs eat alpha or sharpe below D+'}"
    )
    print(f"\nT promotion verdict: {t_promotion_verdict}", flush=True)

    # ── U vs T- comparison (KOSPI DCA ratio + OOS sharpe) ──────────────────
    # U is promoted to headline ONLY if it beats T- on full-period wealth ratio AND OOS sharpe.
    # Otherwise T- stays headline candidate and U is presented as an honest side note.
    _u_ratio  = (_kospi_dca_ratios.get("U_chandelier_scaleout",  {}).get("full_ratio") or 0.0)
    _tm_ratio_cmp = (_kospi_dca_ratios.get(_t_best_key, {}).get("full_ratio") or 0.0)
    _u_oos    = (result_U.get("out_of_sample", {}).get("sharpe") or -999.0)
    _tm_oos_cmp = (_t_best.get("out_of_sample", {}).get("sharpe") or -999.0)
    _u_is     = (result_U.get("in_sample", {}).get("sharpe") or -999.0)
    _u_max_trade = result_U["metrics"].get("max_single_return_pct")
    _tm_max_trade = result_Tminus["metrics"].get("max_single_return_pct")

    # Tenbagger metrics: top-decile P&L share and avg winner hold days
    def _tenbagger_metrics(strat_result: dict) -> dict:
        closed = [t for t in strat_result.get("trades", []) if not t.get("exit_reason", "").endswith("미청산")]
        returns = sorted([t["return_pct"] for t in closed], reverse=True)
        n = len(returns)
        if not n:
            return {"top_decile_pnl_share_pct": None, "avg_winner_hold_days": None}
        top10_n = max(1, math.ceil(n * 0.1))
        top_decile = returns[:top10_n]
        total_positive = sum(r for r in returns if r > 0)
        td_share = (sum(r for r in top_decile if r > 0) / total_positive * 100) if total_positive > 0 else 0.0
        winners = [t for t in closed if t["return_pct"] > 0]
        avg_hold = round(sum(t["days"] for t in winners) / len(winners), 1) if winners else None
        return {
            "top_decile_pnl_share_pct": round(td_share, 1),
            "avg_winner_hold_days": avg_hold,
            "max_single_return_pct": max((t["return_pct"] for t in closed), default=None),
        }

    _u_tb  = _tenbagger_metrics(result_U)
    _tm_tb = _tenbagger_metrics(result_Tminus)

    _u_beats_tminus = (_u_ratio > _tm_ratio_cmp and _u_oos >= _tm_oos_cmp)
    if _u_beats_tminus:
        # U promoted: remove from exclusions so it competes in headline selection
        EXCLUDED_FROM_SELECTOR.discard("U_chandelier_scaleout")
        u_verdict_str = "PROMOTED — 과열 스케일아웃이 T- 대비 부의 비율과 OOS 샤프 모두 개선"
    else:
        u_verdict_str = (
            "NOT PROMOTED — "
            + ("과열 스케일아웃은 상승 여력을 깎았다" if _u_ratio <= _tm_ratio_cmp else "부의 비율은 앞서나 OOS 샤프 미달")
        )

    u_vs_tminus_verdict = {
        "U_wealth_ratio": _u_ratio,
        "Tminus_wealth_ratio": _tm_ratio_cmp,
        "U_oos_sharpe": _u_oos,
        "Tminus_oos_sharpe": _tm_oos_cmp,
        "U_is_sharpe": _u_is,
        "U_max_single_return_pct": _u_max_trade,
        "Tminus_max_single_return_pct": _tm_max_trade,
        "U_top_decile_pnl_share_pct": _u_tb.get("top_decile_pnl_share_pct"),
        "Tminus_top_decile_pnl_share_pct": _tm_tb.get("top_decile_pnl_share_pct"),
        "U_avg_winner_hold_days": _u_tb.get("avg_winner_hold_days"),
        "Tminus_avg_winner_hold_days": _tm_tb.get("avg_winner_hold_days"),
        "promoted": _u_beats_tminus,
        "verdict": u_verdict_str,
        "extension_formula": "extension = B/A, A=ATR(14)/price (ATR%), B=(price-50SMA)/50SMA. 출처: Minervini 커뮤니티 관행, TradingView Fred6724.",
        "scaleout_thresholds": {"first": U_SCALEOUT_EXT_1, "second": U_SCALEOUT_EXT_2},
        "editorial": (
            "가격-전용(price-only) 데이터로 텐배거를 끝까지 들고 갈 수 있는가? "
            "샹들리에 ATR×5 트레일은 고점이 어디인지 모른다는 사실을 설계로 인정하고 "
            "단지 '가격이 최고점에서 충분히 떨어질 때까지' 기다린다. "
            "이 접근은 삼성전기(+1,400% 구간)처럼 오랜 상승추세를 '끝까지' 타는 것을 허용하는 반면, "
            "PLTR·TSLA·NVDA 유형처럼 extension 10×를 넘어 과열 후 급락하는 패턴에서는 "
            "일부 수익을 고점 근처에서 실현하는 것이 유리하다. "
            "스케일아웃 전략(U)이 T-와 비교해 "
            + ("더 높은 부의 비율을 달성했다 — 과열 구간의 부분 익절이 체계적으로 효과적임을 시사한다." if _u_beats_tminus else
               "더 낮은 부의 비율을 보였다 — 이 유니버스에서는 과열 스케일아웃이 남은 포지션의 상승을 놓치는 비용이 더 컸다. "
               "가격-전용 데이터만으로는 정확한 '과열 고점'을 식별하기 어렵고, "
               "조기 익절은 텐배거의 복리 효과를 희석시킨다.")
        ),
    }
    print(f"\nU vs T- verdict: {u_verdict_str}", flush=True)
    print(f"  U ratio={_u_ratio}x  T- ratio={_tm_ratio_cmp}x  U OOS={_u_oos}  T- OOS={_tm_oos_cmp}", flush=True)
    print(f"  U max_trade={_u_max_trade}%  T- max_trade={_tm_max_trade}%", flush=True)
    print(f"  U top-decile PnL share={_u_tb.get('top_decile_pnl_share_pct')}%  T- {_tm_tb.get('top_decile_pnl_share_pct')}%", flush=True)

    # ── Summary table (all strategies including L/M for transparency)
    print(f"\n── Strategy summary (v15, {len(all_strategies)} strategies; L/M/S-non-best/T-loser/U(if not promoted) excluded from selector) ──", flush=True)
    print(f"{'Strategy':<32} {'IS Shp':>8} {'OOS Shp':>9} {'WinRate':>8} {'vs KOSPI DCA':>13} {'Trades':>7} {'Note':>12}", flush=True)
    for key, r in all_strategies.items():
        is_m  = r.get("in_sample", {})
        oos_m = r.get("out_of_sample", {})
        win_rate = r["metrics"].get("win_rate_pct")
        ratio_info = _kospi_dca_ratios.get(key, {})
        kospi_ratio_str = f"{ratio_info.get('full_ratio','—')}x" if ratio_info.get('full_ratio') else "—"
        note = "[EXCLUDED]" if key in EXCLUDED_FROM_SELECTOR else ""
        if key == best_s_key:
            note = "[S-BEST]"
        if key == _t_best_key and _t_promoted:
            note = "[T-BEST]"
        print(
            f"  {key:<30} {str(is_m.get('sharpe','—')):>8} "
            f"{str(oos_m.get('sharpe','—')):>9} "
            f"{str(win_rate)+'%' if win_rate is not None else '—':>8} "
            f"{kospi_ratio_str:>13} "
            f"{r['metrics']['trades']:>7} {note:>12}",
            flush=True,
        )

    # Beat KOSPI DCA verdict
    beats_kospi_both = [
        k for k, v in _kospi_dca_ratios.items()
        if v.get("full_ratio") and v["full_ratio"] > 1.0
        and k not in EXCLUDED_FROM_SELECTOR
    ]
    if beats_kospi_both:
        print(f"\n  ✓ Strategies beating KOSPI DCA: {beats_kospi_both}", flush=True)
    else:
        print(f"\n  ✗ No eligible strategy beats KOSPI DCA in full-period wealth simulation.", flush=True)

    # ── Headline selection: best IS sharpe among ELIGIBLE strategies only
    def _is_sharpe(r: dict) -> float:
        v = r.get("in_sample", {}).get("sharpe")
        return v if v is not None else -999.0

    eligible_strategies = {k: v for k, v in all_strategies.items() if k not in EXCLUDED_FROM_SELECTOR}
    headline = max(eligible_strategies.values(), key=_is_sharpe)
    headline_label = headline["label"]
    # If headline is the promoted T best variant, relabel it for UI
    headline_key = next(k for k, v in eligible_strategies.items() if v is headline)
    if headline_key in ("T_kospi_core_chandelier", "T-_kospi_core_regime"):
        headline["label"] = "T_kospi_core_chandelier"   # canonical label for UI
        headline_label = "T_kospi_core_chandelier"
    print(f"\nHeadline (best IS sharpe, eligible only): {headline_label} [{headline_key}]", flush=True)
    print(f"  IS sharpe={headline.get('in_sample', {}).get('sharpe')}  OOS sharpe={headline.get('out_of_sample', {}).get('sharpe')}", flush=True)

    # ── Tail stats and consensus stats on headline
    tail_stats = compute_tail_stats(headline.get("trades", []))
    consensus_stats = compute_consensus_stats(headline.get("trades", []))

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
    for key, r in all_strategies.items():
        ws = compute_wealth_simulation_multi(r["nav_df"], benchmarks_for_sim, strat_start, strat_end)
        strat_wealth_sims[key] = {
            "final_strategy_value": ws["final_strategy_value"],
            "strategy_gain_on_contributed_pct": ws["strategy_gain_on_contributed_pct"],
            "strategy_mdd_pct": ws["strategy_mdd_pct"],
            "series": ws["series"],
        }

    # ── Today's signals — keyed off the headline strategy (single source of truth)
    print("\nComputing today's signals (headline: {})...".format(headline_key), flush=True)
    headline_open_pos_raw = headline.get("open_positions", {})
    if not isinstance(headline_open_pos_raw, dict):
        headline_open_pos_raw = {}
    headline_is_t_family = headline_key in ("T_kospi_core_chandelier", "T-_kospi_core_regime")
    today_signals = compute_today_signals(
        perf, prices, ticker_reports, calendar,
        headline_open_positions=headline_open_pos_raw,
        headline_label=headline_label,
        reports=reports,
        kospi=kospi,
        regime_aware=(headline_key == "T-_kospi_core_regime"),
        max_positions=(t_max_pos if headline_is_t_family else MAX_POSITIONS),
    )
    print(f"  Open: {today_signals['counts']['open']}, "
          f"Approaching stop: {today_signals['counts']['approaching_stop']}, "
          f"Imminent buys (5td): {today_signals['counts']['imminent_buys']}, "
          f"Watching: {today_signals['counts']['watching']}, "
          f"Regime: {(today_signals.get('regime') or {}).get('state', '—')}",
          flush=True)

    # ── Export CSVs per strategy
    print("\nExporting trade CSVs...", flush=True)
    export_trades_csv(headline.get("trades", []), CSV_PATH)  # headline CSV
    for key, r in all_strategies.items():
        export_trades_csv(r.get("trades", []), PUBLIC_DIR / f"strategy-trades-{key}.csv")

    # ── Multi-strategy comparison rows
    multi_strategy_summary = build_multi_strategy_summary(all_strategies, kospi_dca_ratios=_kospi_dca_ratios)

    # ── Serialize open positions helper
    def _serialize_open_positions(raw: dict) -> list[dict]:
        result_list = []
        for t, p in raw.items():
            entry_date_val = p.get("entry_date", "")
            entry_date_str = entry_date_val.isoformat() if hasattr(entry_date_val, "isoformat") else str(entry_date_val)
            stop_val = p.get("stop", 0) or 0
            last_close_val = p.get("last_close", p.get("entry_price", 0))
            cost_val = p.get("cost", 1)
            # Compute extension gauge for this position (uses last available data)
            df_pos = prices.get(t)
            last_cal_day = calendar[-1]
            ext_val = compute_extension(df_pos, last_cal_day) if df_pos is not None else None
            result_list.append({
                "ticker": t,
                "market": p.get("market", "KR"),
                "display_name": p.get("display_name", t),
                "entry_date": entry_date_str,
                "entry": round(float(p.get("entry_price", 0)), 4),
                "last_close": round(float(last_close_val), 4),
                "stop": round(float(stop_val), 4),
                "return_pct": round((p["shares"] * float(last_close_val) / float(cost_val) - 1) * 100, 2),
                "source": p.get("source", ""),
                "n_clubs": p.get("n_clubs", 1),
                "extension": ext_val,   # ATR% multiple from 50-MA (과열 게이지)
            })
        return result_list

    open_positions_list = _serialize_open_positions(headline_open_pos_raw)

    # Per-strategy open positions for UI switcher
    open_positions_by_strategy: dict[str, list[dict]] = {}
    for key, r in all_strategies.items():
        raw_op = r.get("open_positions", {})
        if isinstance(raw_op, dict):
            open_positions_by_strategy[key] = _serialize_open_positions(raw_op)
        else:
            open_positions_by_strategy[key] = []

    # Headline closed trades for JSON
    headline_trades_for_json = [
        t for t in headline.get("trades", [])
        if not t.get("exit_reason", "").endswith("미청산")
    ]

    # Build Optuna methodology note for payload
    optuna_note: dict = {}
    if not optuna_result.get("skipped") and optuna_meta:
        optuna_note = {
            "adopted": d_plus_adopted,
            "best_params": optuna_meta.get("best_params", {}),
            "fold1_sharpe": optuna_meta.get("fold1_sharpe"),
            "fold2_sharpe": optuna_meta.get("fold2_sharpe"),
            "oos_sharpe": result_Dplus.get("out_of_sample", {}).get("sharpe") if result_Dplus else None,
            "is_sharpe": result_Dplus.get("in_sample", {}).get("sharpe") if result_Dplus else None,
            "n_trials": optuna_meta.get("n_trials"),
            "search_space": optuna_meta.get("search_space", {}),
            "methodology": optuna_meta.get("methodology", ""),
            "adoption_criteria": "OOS sharpe ≥ 0.8 × IS sharpe AND OOS sharpe ≥ D 기본값 OOS sharpe",
        }

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
            "anti_overfit_note": "파라미터는 문헌 표준값 고정 (200MA, ATR×5). 그리드 서치 없음. D+ Optuna는 별도 방법론 섹션 참조.",
        },
        "metrics": headline["metrics"],
        "in_sample": headline.get("in_sample", {}),
        "out_of_sample": headline.get("out_of_sample", {}),
        "yearly": headline["yearly"],
        "equity": headline["equity"],
        "multi_strategy": {
            "strategies": multi_strategy_summary,
            "headline_key": headline_key,
            "strategy_wealth_sims": strat_wealth_sims,
            "equity_by_strategy": {
                key: r["equity"] for key, r in all_strategies.items()
            },
            "yearly_by_strategy": {
                key: r["yearly"] for key, r in all_strategies.items()
            },
            "open_positions_by_strategy": open_positions_by_strategy,
            "trades_by_strategy": {
                key: [t for t in r.get("trades", []) if not t.get("exit_reason", "").endswith("미청산")]
                for key, r in all_strategies.items()
            },
        },
        "optuna_chandelier": optuna_note,
        "tail_stats": tail_stats,
        "consensus_stats": consensus_stats,
        "wealth_sim": wealth_sim,
        "trades": headline_trades_for_json,
        "best_trades": sorted(headline_trades_for_json, key=lambda t: t["return_pct"], reverse=True)[:5],
        "worst_trades": sorted(headline_trades_for_json, key=lambda t: t["return_pct"])[:5],
        "open_positions": open_positions_list,
        "signals": today_signals,
        # ── v11 감사 결과 ──────────────────────────────────────────────────────
        "v11_audit": {
            "mtt_lookahead_fix": (
                "O MTT: 동일 바 룩어헤드 수정 완료. 진입 시그널은 당일 종가 기준으로 포착, "
                "체결은 익일 시가. _compute_rs_percentiles는 asof(day_63/126/252)로 과거 데이터만 사용 — "
                "점검 결과 lookahead 없음. hi52w/lo52w/MA: load_prices rolling window, look-forward 없음. "
                "생존 편향: 프라이스 파일 존재 종목만 포함 — 상장폐지 후 파일 삭제 시 편향 가능. 방법론 주석 명시."
            ),
            "L_verdict": (
                "L 민리버전 RSI-2: 동일 바 룩어헤드 수정 (시그널→익일 시가). "
                f"수정 후 결과: IS sharpe={result_L['in_sample'].get('sharpe')}, "
                f"OOS sharpe={result_L['out_of_sample'].get('sharpe')}, "
                f"trades={result_L['metrics']['trades']}, MDD={result_L['metrics']['mdd_pct']}%. "
                "판정: RSI-2 민리버전은 거래비용으로 사망 — 구현 검증 후 제외. "
                "원인: 0.3%/side × ~10일 보유 주기 → 연간 약 6-7% 비용 부담으로 알파 소진."
            ),
            "M_verdict": (
                "M 단기 리버설: positions.clear() 미청산 포지션 현금 누락 버그 수정, "
                "동일 바 룩어헤드 수정 (월말 종가 랭킹→월초 시가 체결). "
                f"수정 후 결과: IS sharpe={result_M['in_sample'].get('sharpe')}, "
                f"OOS sharpe={result_M['out_of_sample'].get('sharpe')}, "
                f"trades={result_M['metrics']['trades']}, MDD={result_M['metrics']['mdd_pct']}%. "
                "판정: 단기 리버설은 거래비용으로 사망 — 구현 검증 후 제외. "
                "원인: 0.3%/side × 월별 전체 교체 (연 24회 편도) → 연간 약 7% 비용 부담."
            ),
            "excluded_from_selector": list(EXCLUDED_FROM_SELECTOR),
            "P_strategy": (
                f"P 딥바이 샹들리에: IS sharpe={result_P['in_sample'].get('sharpe')}, "
                f"OOS sharpe={result_P['out_of_sample'].get('sharpe')}, "
                f"trades={result_P['metrics']['trades']}, "
                f"max_single_return={result_P['metrics'].get('max_single_return_pct')}%, "
                f"ATR mult used={p_atr_mult_used}. "
                "설계: 딥바이 진입 + 10% 추가 하락 시 1회 스케일인 + ATR 트레일링 스탑 (타겟가 캡 없음)."
            ),
        },
        # ── v12 신규 전략 결과 ─────────────────────────────────────────────────
        "v12_new_strategies": {
            "Q_kangto": {
                "is_sharpe": result_Q["in_sample"].get("sharpe"),
                "oos_sharpe": result_Q["out_of_sample"].get("sharpe"),
                "win_rate_pct": result_Q["metrics"].get("win_rate_pct"),
                "trades": result_Q["metrics"]["trades"],
                "kospi_dca_ratio": _kospi_dca_ratios.get("Q_kangto_trend", {}).get("full_ratio"),
                "description": (
                    "깡토 추세추종: 시장신호등(KOSPI 200MA+50MA상승→2유닛), "
                    "진입=RS퍼센타일≥KOSPI RS AND 60d고가돌파 AND 거래량≥1.5×20d평균, "
                    "스탑=-8%(1R)/BE at+1R/트레일 고점-8% at+1.5R/절반익절 +3R. "
                    "win rate ~30% 설계 — 손절 많고 대형 위너 추구."
                ),
            },
            "R_kelly": {
                "is_sharpe": result_R["in_sample"].get("sharpe"),
                "oos_sharpe": result_R["out_of_sample"].get("sharpe"),
                "trades": result_R["metrics"]["trades"],
                "kospi_dca_ratio": _kospi_dca_ratios.get("R_kelly_chandelier", {}).get("full_ratio"),
                "kelly_params": {
                    "lookback_trades": R_KELLY_LOOKBACK,
                    "cap": R_KELLY_CAP,
                    "safety_factor": R_KELLY_SAFETY,
                    "floor_pct": R_KELLY_FLOOR,
                    "fallback_pct": R_KELLY_FALLBACK,
                },
                "description": (
                    "Kelly 샹들리에: D+ Chandelier 진입/청산 규칙 + Kelly 포지션 사이징. "
                    f"Kelly rolling {R_KELLY_LOOKBACK} trades, cap {R_KELLY_CAP}, safety {R_KELLY_SAFETY}, "
                    f"floor {R_KELLY_FLOOR*100}%. 충분한 거래 이력 없으면 flat {R_KELLY_FALLBACK*100}% fallback. "
                    "참조: alpha16-main utils.py _safe_kelly_fraction."
                ),
            },
            "S_portfolio_opt": {
                "variants": {
                    k: {
                        "is_sharpe": v["in_sample"].get("sharpe"),
                        "oos_sharpe": v["out_of_sample"].get("sharpe"),
                        "trades": v["metrics"]["trades"],
                        "kospi_dca_ratio": _kospi_dca_ratios.get(k, {}).get("full_ratio"),
                    }
                    for k, v in s_variants.items()
                },
                "best_variant": best_s_key,
                "best_is_sharpe": best_s_result["in_sample"].get("sharpe"),
                "best_oos_sharpe": best_s_result["out_of_sample"].get("sharpe"),
                "best_kospi_dca_ratio": _kospi_dca_ratios.get(best_s_key, {}).get("full_ratio"),
                "description": (
                    "포트폴리오 최적화 월간 리밸런스. 유니버스: 18개월 내 buy report 종목. "
                    "Trailing 252d 일별 수익률 점-in-time. "
                    "S_hrp: HRP (직접 구현, corr distance → single-linkage → quasi-diag → iv-split). "
                    "S_msharpe: max-Sharpe (LedoitWolf 수축, long-only w≤15%). "
                    "S_mincvar: min-CVaR 95% (scipy linprog LP, long-only w≤15%). "
                    "IS 샤프 최상 변형만 셀렉터 포함."
                ),
            },
            "T_kospi_core": {
                "T": {
                    "is_sharpe": result_T["in_sample"].get("sharpe"),
                    "oos_sharpe": result_T["out_of_sample"].get("sharpe"),
                    "trades": result_T["metrics"]["trades"],
                    "kospi_dca_ratio": _kospi_dca_ratios.get("T_kospi_core_chandelier", {}).get("full_ratio"),
                },
                "T_minus": {
                    "is_sharpe": result_Tminus["in_sample"].get("sharpe"),
                    "oos_sharpe": result_Tminus["out_of_sample"].get("sharpe"),
                    "trades": result_Tminus["metrics"]["trades"],
                    "kospi_dca_ratio": _kospi_dca_ratios.get("T-_kospi_core_regime", {}).get("full_ratio"),
                },
                "best_variant": _t_best_key,
                "promoted_to_headline": _t_promoted,
                "promotion_verdict": t_promotion_verdict,
                "atr_params": {
                    "atr_period": t_atr_period,
                    "atr_mult": t_atr_mult,
                    "max_positions": t_max_pos,
                    "source": "D+ Optuna best params" if d_plus_adopted else "D default (ATR42×5, 20 slots)",
                },
                "cost_disclosure": (
                    "인덱스 ETF(KODEX200 기준) 전환 비용 0.05%/side 가정. "
                    "주식 매수·매도 비용 0.3%/side (기존 동일). "
                    "실제 KODEX200 스프레드·세금·운용보수는 계좌마다 상이할 수 있음."
                ),
                "interpretation": (
                    "T의 베이스라인 = KOSPI DCA. 주식 픽이 KOSPI 대비 순 알파를 더하면 ratio>1, "
                    "전환 비용이 알파를 삼키면 ratio≤1. "
                    "T-는 KOSPI<200MA 구간에서 파킹 수익 0%(현금) — 약세장 방어 레이어. "
                    "참조: Faber (2007) 10개월 이동평균 레짐 필터."
                ),
                "csv_note": (
                    "CSV는 주식 거래만 기록. KOSPI 파킹 전환(ETF 매수/매도)은 별도 미기록."
                ),
            },
            "U_chandelier_scaleout": {
                "is_sharpe": result_U["in_sample"].get("sharpe"),
                "oos_sharpe": result_U["out_of_sample"].get("sharpe"),
                "trades": result_U["metrics"]["trades"],
                "kospi_dca_ratio": _kospi_dca_ratios.get("U_chandelier_scaleout", {}).get("full_ratio"),
                "max_single_return_pct": result_U["metrics"].get("max_single_return_pct"),
                "top_decile_pnl_share_pct": _u_tb.get("top_decile_pnl_share_pct"),
                "avg_winner_hold_days": _u_tb.get("avg_winner_hold_days"),
                "vs_tminus": u_vs_tminus_verdict,
                "description": (
                    "U 코어-KOSPI 샹들리에 + 과열 스케일아웃. T- 레짐 필터 완전 동일 + "
                    f"ATR% Multiple from 50-MA extension 게이지 (ATR14, 50SMA). "
                    f"extension > {U_SCALEOUT_EXT_1}× → 절반 익절 → KOSPI 파킹 (1차). "
                    f"extension > {U_SCALEOUT_EXT_2}× → 남은 절반 다시 익절 (2차). "
                    "트리거 포지션당 1회. 출처: Minervini 커뮤니티 관행, TradingView Fred6724."
                ),
            },
            "beats_kospi_dca": beats_kospi_both,
            "kospi_dca_verdict": (
                f"KOSPI 적립식 DCA를 전체 기간 자산 기준으로 초과한 전략: {beats_kospi_both if beats_kospi_both else '없음'}. "
                "KOSPI 적립식 매수는 현재도 강력한 베이스라인입니다."
            ),
            "intraday_declined": (
                "장중(intraday) 데이터는 도입 범위 외: 한국 주식 1분봉/tick 데이터 미수집으로 "
                "장중 진입/청산 시뮬레이션 불가. 일봉(daily close) 기반 전략만 구현."
            ),
            "spo_deferred": (
                "SPO(Secondary Public Offering) 이벤트 기반 전략은 미래 작업으로 보류: "
                "SPO 공시 데이터 수집 파이프라인 미구축."
            ),
        },
        "kospi_dca_ratios": _kospi_dca_ratios,
        # ── 재매수 규칙 ───────────────────────────────────────────────────────
        "reentry_rule": {
            "rule": (
                "청산 후 동일 티커 재진입 허용: 각 패밀리의 진입 조건이 다시 충족되면 재매수. "
                "현재 보유 중인 경우에만 차단 (open_positions 중복 방지). "
                "리포트 구동 패밀리(A~K, N, P): 신규 리포트 발간 시 또는 유효창 내 기술적 조건 재충족 시 재진입. "
                "MTT 계열(O): 유효창 내 기술적 시그널 재발생 시 재진입. "
                "어느 패밀리도 청산 후 영구 차단하지 않음."
            ),
            "families_changed": ["v11: L/M 셀렉터 제외, P 신규 추가"],
            "audit_note": (
                "v11 엔진 전 패밀리 검토: _try_enter()는 ticker in positions 조건만 확인 (현재 보유 여부). "
                "청산 후 positions에서 제거되므로 재진입 자동 허용. 영구 차단 패밀리 없음."
            ),
        },
        # ── MTT O 출처 공시 ───────────────────────────────────────────────────
        "mtt_provenance": {
            "source": "alpha16-main (Minervini MTT RobustOpt KRX params)",
            "params": {
                "stop_pct": MTT_STOP_PCT,
                "be_at_r": MTT_BE_AT_R,
                "trail_pct": MTT_TRAIL_PCT,
                "trail_activate_r": MTT_TRAIL_ACTIVATE_R,
                "take_profit_r": MTT_TAKE_PROFIT_R,
                "rs_buy_threshold": MTT_RS_BUY_THRESHOLD,
                "rs_mtt_threshold": MTT_RS_MTT_THRESHOLD,
                "rs_exit_threshold": MTT_RS_EXIT_THRESHOLD,
                "rs_exit_min_hold_days": MTT_RS_EXIT_MIN_HOLD_DAYS,
                "max_hold_days": MTT_MAX_HOLD_DAYS,
                "price_from_low_mult": MTT_PRICE_FROM_LOW_MULT,
                "price_from_high_mult": MTT_PRICE_FROM_HIGH_MULT,
            },
            "disclaimer": (
                "alpha16 RobustOpt KRX 파라미터는 전체 KRX 종목 대상으로 튜닝된 값입니다. "
                "OUR 리포트 검증 데이터에서 최적화하지 않았습니다 (데이터 오염 방지). "
                "포지션 사이징은 비교 가능성을 위해 당사 5%/20슬롯 동일비중 유지. "
                "Kelly 사이징은 미래 작업으로 남겨둡니다."
            ),
        },
    }

    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nWrote {OUT_PATH.relative_to(ROOT).as_posix()}", flush=True)
    print(f"  Trades in JSON: {len(headline_trades_for_json)}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
