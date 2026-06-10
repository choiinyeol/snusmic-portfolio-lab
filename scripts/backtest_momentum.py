"""학회 리포트 × 추세추종(모멘텀) 전략 백테스트 v3.

전략 규칙 (v3 변경사항):
- 유니버스: rating_class == 'buy' 리포트가 커버한 KR 종목만 (soft_buy/sell 제외)
- 진입: 발간 후 10거래일 이상 지난 시점에 종가가 '발간 후 최고 종가'를 경신하면
        다음 거래일 시가에 매수 (발간 후 180일 이내에 신호가 없으면 소멸)
        → "늦은 모멘텀도 큰 수익을 낼 수 있다"는 가설 검증: 신호 지연은 손해가 아님
- 청산: 래칫형 ATR 트레일링 스탑
        - 진입가 기준 +30% 미달: k × ATR(42) 스탑 (기존)
        - 진입가 기준 +30% 이상: (k+1) × ATR(42)로 스탑 폭 자동 확대 (Winner 보호)
        - 진입가 기준 +100% 이상: (k+2) × ATR(42)로 추가 확대 (Tenbagger 후보 보호)
- 포지션: 동일비중 5%, 최대 20종목. 슬롯 부족 시 신호일 기준 90일 샤프비율 순
- 컨센서스 가중: ≥2개 학회 커버 종목은 추가 슬롯 1개 우선 배정 (검증 목적)
- 시장 국면 필터: KOSPI 종가가 200일 이동평균 아래면 신규 진입 중단 (청산은 항상 동작)
- 비용: 매수/매도 각 0.3%

추가 분석:
- 테일 캡처 통계: 상위 10% 거래가 전체 P&L에서 차지하는 비중
- 컨센서스 통계: ≥2개 학회 종목 vs 단독 커버 종목 수익률 비교
- 부의 시뮬레이션 (DCA): 월 1,000만원 초기 + 월 100만원 적립 (2년마다 100만원 추가)
  초기: 0~23개월 100만원, 24~47개월 200만원, 48~71개월 300만원, ...
  벤치마크: 동일 DCA로 KOSPI 지수 추종

헤드라인 = ATR×3 래칫 + 국면 필터 ON. 민감도 그리드(ATR 2/3/4/5 × 필터 on/off)를 함께 보고한다.
출력: src/data/strategy-backtest.json
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

MIN_DAYS_BEFORE_SIGNAL = 10
SIGNAL_WINDOW_DAYS = 180
ATR_PERIOD = 42
HEADLINE_ATR_MULT = 4.0
HEADLINE_REGIME = False
MAX_POSITIONS = 20
POSITION_WEIGHT = 0.05
COST_PER_SIDE = 0.003
REGIME_MA = 200

# 래칫 스탑 확대 임계값 (진입가 대비)
RATCHET_THRESHOLD_1 = 0.30   # +30% → 스탑 폭 +1 ATR
RATCHET_THRESHOLD_2 = 1.00   # +100% → 스탑 폭 +2 ATR

# DCA 파라미터
DCA_INITIAL = 10_000_000       # 초기 자본 1천만원
DCA_BASE_MONTHLY = 1_000_000   # 기본 월 적립 100만원
DCA_STEP = 1_000_000           # 2년마다 추가되는 금액
DCA_STEP_MONTHS = 24           # 2년 = 24개월

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def asof_value(series: pd.Series, day: dt.date) -> float:
    value = series.asof(pd.Timestamp(day))
    return float(value) if pd.notna(value) else 0.0


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


def load_regime() -> pd.Series | None:
    """KOSPI 종가 > MA200 여부 (True = 신규 진입 허용)."""
    path = PRICE_DIR / "IDX_KOSPI.csv"
    if not path.exists():
        return None
    idx = pd.read_csv(path, index_col=0, parse_dates=True).sort_index()
    if idx.empty or "close" not in idx:
        return None
    ma = idx["close"].rolling(REGIME_MA, min_periods=REGIME_MA // 2).mean()
    return idx["close"] > ma


def load_kospi_index() -> pd.Series | None:
    """KOSPI 종가 시리즈 반환."""
    path = PRICE_DIR / "IDX_KOSPI.csv"
    if not path.exists():
        return None
    idx = pd.read_csv(path, index_col=0, parse_dates=True).sort_index()
    if idx.empty or "close" not in idx:
        return None
    return idx["close"]


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


def run_backtest(
    prices: dict[str, pd.DataFrame],
    by_signal_date: dict[dt.date, list[tuple[str, str, int]]],  # (ticker, source, n_clubs)
    calendar: list[dt.date],
    atr_mult: float,
    regime: pd.Series | None,
    use_ratchet: bool = True,
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
        """래칫: 수익률에 따라 스탑 폭 자동 확대."""
        if not use_ratchet:
            return atr_mult
        gain = pos["highest"] / pos["entry_price"] - 1
        if gain >= RATCHET_THRESHOLD_2:
            return atr_mult + 2
        if gain >= RATCHET_THRESHOLD_1:
            return atr_mult + 1
        return atr_mult

    for day in calendar:
        # 1) 예약 매도 — 거래정지 시 실제 거래 재개일까지 이연
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
            trades.append(
                {
                    "ticker": ticker,
                    "source": pos["source"],
                    "n_clubs": pos["n_clubs"],
                    "entry_date": pos["entry_date"].isoformat(),
                    "exit_date": day.isoformat(),
                    "entry": round(pos["entry_price"], 2),
                    "exit": round(price, 2),
                    "return_pct": round((proceeds / pos["cost"] - 1) * 100, 2),
                    "days": (day - pos["entry_date"]).days,
                }
            )
        pending_sells = deferred_sells

        # 2) 예약 매수 (전일 신고가 신호)
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
                # 컨센서스 종목(≥2개 학회)을 같은 샤프 점수라면 우선 배정
                ranked = sorted(
                    candidates,
                    key=lambda item: (
                        item[2] >= 2,  # consensus priority
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

        # 3) 스탑 갱신 + 이탈 판정 (래칫 적용)
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

        # 4) 오늘 신호 → 내일 시가 매수 예약
        pending_buys = by_signal_date.get(day, [])

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    nav_df = pd.Series({pd.Timestamp(d): v for d, v in nav_series}).sort_index()
    daily_ret = nav_df.pct_change().dropna()
    total_return = nav_df.iloc[-1] / nav_df.iloc[0] - 1
    years = (nav_df.index[-1] - nav_df.index[0]).days / 365.25
    cagr = (nav_df.iloc[-1] / nav_df.iloc[0]) ** (1 / years) - 1 if years > 0 else None
    sharpe = float(daily_ret.mean() / daily_ret.std() * math.sqrt(252)) if daily_ret.std() else None
    mdd = float((nav_df / nav_df.cummax() - 1).min())
    wins = [t for t in trades if t["return_pct"] > 0]
    year_last = nav_df.resample("YE").last().dropna()
    yearly = year_last.pct_change()
    if len(year_last):
        yearly.iloc[0] = year_last.iloc[0] / nav_df.iloc[0] - 1
    yearly = (yearly * 100).round(2)

    return {
        "metrics": {
            "start": nav_series[0][0],
            "end": nav_series[-1][0],
            "total_return_pct": round(total_return * 100, 2),
            "cagr_pct": round(cagr * 100, 2) if cagr is not None else None,
            "sharpe": round(sharpe, 2) if sharpe is not None else None,
            "mdd_pct": round(mdd * 100, 2),
            "trades": len(trades),
            "open_positions": len(positions),
            "win_rate_pct": round(len(wins) / len(trades) * 100, 1) if trades else None,
            "avg_hold_days": round(sum(t["days"] for t in trades) / len(trades), 1) if trades else None,
        },
        "yearly": [{"year": ts.year, "return_pct": float(v)} for ts, v in yearly.items()],
        "equity": [
            {"date": ts.date().isoformat(), "nav": round(v / START_CAPITAL, 4)}
            for ts, v in nav_df.resample("W-FRI").last().dropna().items()
        ],
        "trades": trades,
        "positions": positions,
        "nav_df": nav_df,
    }


def compute_tail_stats(trades: list[dict]) -> dict:
    """상위 10% 거래의 P&L 기여도 등 테일 캡처 통계."""
    if not trades:
        return {}

    # 거래별 절대 수익 (return_pct 기준; cost 정보 없으므로 단순 % 기준)
    returns = sorted([t["return_pct"] for t in trades], reverse=True)
    n = len(returns)
    top10_n = max(1, math.ceil(n * 0.1))
    top_decile = returns[:top10_n]

    # 양수 수익만 집계 (손실 거래는 tail capture 계산에서 분리)
    total_positive = sum(r for r in returns if r > 0)
    top_decile_positive = sum(r for r in top_decile if r > 0)
    top_decile_pnl_share = (top_decile_positive / total_positive * 100) if total_positive > 0 else 0

    # 5배 이상 수익 거래 (>400%)
    multibaggers = [t for t in trades if t["return_pct"] >= 400]
    doublers = [t for t in trades if t["return_pct"] >= 100]

    # 평균 보유일 (상위 10% vs 전체)
    top_trades = sorted(trades, key=lambda t: t["return_pct"], reverse=True)[:top10_n]
    avg_hold_top = round(sum(t["days"] for t in top_trades) / len(top_trades), 1) if top_trades else None

    return {
        "total_trades": n,
        "top_decile_n": top10_n,
        "top_decile_pnl_share_pct": round(top_decile_pnl_share, 1),
        "top_decile_avg_return_pct": round(sum(top_decile) / len(top_decile), 1) if top_decile else None,
        "multibagger_count": len(multibaggers),  # >400%
        "doubler_count": len(doublers),            # >100%
        "top_decile_avg_hold_days": avg_hold_top,
        "top10_trades": [
            {"ticker": t["ticker"], "return_pct": t["return_pct"], "days": t["days"], "n_clubs": t.get("n_clubs", 1)}
            for t in top_trades[:10]
        ],
    }


def compute_consensus_stats(trades: list[dict]) -> dict:
    """≥2개 학회 커버 종목 vs 단독 커버 종목 수익률 비교."""
    if not trades:
        return {}
    single = [t for t in trades if t.get("n_clubs", 1) == 1]
    multi = [t for t in trades if t.get("n_clubs", 1) >= 2]

    def stats(group: list[dict]) -> dict:
        if not group:
            return {"count": 0, "avg_return_pct": None, "win_rate_pct": None, "median_return_pct": None}
        returns = [t["return_pct"] for t in group]
        wins = [r for r in returns if r > 0]
        returns_sorted = sorted(returns)
        n = len(returns_sorted)
        median = returns_sorted[n // 2] if n % 2 == 1 else (returns_sorted[n // 2 - 1] + returns_sorted[n // 2]) / 2
        return {
            "count": len(group),
            "avg_return_pct": round(sum(returns) / len(returns), 2),
            "win_rate_pct": round(len(wins) / len(returns) * 100, 1),
            "median_return_pct": round(median, 2),
        }

    return {
        "single_club": stats(single),
        "multi_club": stats(multi),
        "alpha_multi_vs_single": round(
            (stats(multi)["avg_return_pct"] or 0) - (stats(single)["avg_return_pct"] or 0), 2
        ) if single and multi else None,
        "note": "≥2개 학회가 동시에 Buy 의견을 낸 종목이 단독 커버 종목 대비 더 높은 수익률을 보이는지 검증합니다.",
    }


def compute_wealth_simulation(
    nav_df: pd.Series,
    kospi: pd.Series,
    backtest_start: dt.date,
    backtest_end: dt.date,
) -> dict:
    """
    월 DCA 기반 부의 시뮬레이션.
    - 초기 자본: 1천만원
    - 월 적립: 0~23개월 100만원, 24~47개월 200만원, ...
    - 전략: 매월 초 현금을 전략 NAV 비례로 투입
    - 벤치마크: 동일 DCA로 KOSPI 지수 추종 (비례 매수)
    """
    # 전략 일별 수익률 (nav_df는 누적 자산)
    strat_daily_ret = nav_df.pct_change().fillna(0)

    # KOSPI 일별 수익률
    kospi_aligned = kospi.reindex(nav_df.index).ffill().bfill()
    bench_daily_ret = kospi_aligned.pct_change().fillna(0)

    # 월별 첫 거래일 리스트 (backtest 기간 내)
    all_dates = nav_df.index
    # group by year-month, take first trading day of each month
    _dates_series = pd.Series(all_dates.date, index=all_dates)
    monthly_dates = set(
        _dates_series.groupby(_dates_series.index.to_period("M")).first().values
    )

    strat_wealth = float(DCA_INITIAL)
    bench_wealth = float(DCA_INITIAL)
    total_contributed = float(DCA_INITIAL)

    # 초기 자본 KOSPI 투입: 첫 날 KOSPI 가격으로 가상 유닛 구매
    first_ts = all_dates[0]
    kospi_first = float(kospi_aligned.iloc[0]) if len(kospi_aligned) else 1.0
    bench_units = DCA_INITIAL / kospi_first  # 가상 지수 유닛 수

    series: list[dict] = []
    month_idx = 0

    for day in all_dates:
        day_date = day.date()
        is_month_first = day_date in monthly_dates

        # 해당 날이 월 첫 거래일이면 DCA 적립 (첫 번째 월은 initial capital로 처리)
        if is_month_first and month_idx > 0:
            contribution = DCA_BASE_MONTHLY + DCA_STEP * (month_idx // DCA_STEP_MONTHS)
            total_contributed += contribution
            strat_wealth += contribution
            kospi_price_today = float(kospi_aligned.loc[day]) if day in kospi_aligned.index else kospi_first
            bench_units += contribution / kospi_price_today

        if is_month_first:
            month_idx += 1

        # 일별 수익 반영
        sr = float(strat_daily_ret.loc[day])
        strat_wealth *= (1 + sr)
        kospi_price_now = float(kospi_aligned.loc[day]) if day in kospi_aligned.index else kospi_first
        bench_wealth = bench_units * kospi_price_now

        # 월간 스냅샷만 저장
        if is_month_first:
            series.append({
                "month": month_idx - 1,
                "date": day_date.isoformat(),
                "contributed": round(total_contributed),
                "strategy_value": round(strat_wealth),
                "benchmark_value": round(bench_wealth),
            })

    # 최종값
    # Use last monthly snapshot as canonical final values (consistent with series)
    final_strat = series[-1]["strategy_value"] if series else round(strat_wealth)
    final_bench = series[-1]["benchmark_value"] if series else round(bench_wealth)
    final_contrib = series[-1]["contributed"] if series else round(total_contributed)
    years = (backtest_end - backtest_start).days / 365.25

    # 단순 수익률: 최종자산 / 총납입금 - 1 (CAGR은 납입금 기준으로 계산하지 않음 — 오해 소지)
    # 대신 전략의 순수익 (최종자산 - 납입금) / 납입금 을 표시
    strat_gain_pct = round((final_strat - final_contrib) / final_contrib * 100, 1) if final_contrib else None
    bench_gain_pct = round((final_bench - final_contrib) / final_contrib * 100, 1) if final_contrib else None

    # 전략 MDD (부의 시뮬레이션 기준)
    wealth_series_vals = pd.Series([s["strategy_value"] for s in series])
    if len(wealth_series_vals) > 1:
        sim_mdd = round(float((wealth_series_vals / wealth_series_vals.cummax() - 1).min()) * 100, 2)
    else:
        sim_mdd = 0.0

    return {
        "schedule_desc": (
            "초기 자본 1,000만원 + 월 적립 (0~23개월: 100만원, 24~47개월: 200만원, "
            "48~71개월: 300만원, …). 유휴 현금 이자 없음. "
            "벤치마크는 동일 일정으로 KOSPI 지수를 추종합니다."
        ),
        "final_contributed": final_contrib,
        "final_strategy_value": final_strat,
        "final_benchmark_value": final_bench,
        "strategy_gain_on_contributed_pct": strat_gain_pct,
        "benchmark_gain_on_contributed_pct": bench_gain_pct,
        "strategy_mdd_pct": sim_mdd,
        "series": series,
    }


def main() -> int:
    # rating_class == 'buy'만 사용 (v3 핵심 변경)
    perf = pd.read_csv(ROOT / "data" / "report_performance.csv", encoding="utf-8-sig")
    perf = perf[
        (perf["market"] == "KR")
        & perf["ticker"].notna()
        & perf["report_date"].notna()
        & (perf["rating_class"] == "buy")
    ]
    perf["ticker"] = perf["ticker"].astype(str).str.zfill(6)

    # 컨센서스: 종목별 커버 학회 수
    ticker_club_count: dict[str, int] = (
        perf.groupby("ticker")["school"].nunique().to_dict()
    )

    prices: dict[str, pd.DataFrame] = {}
    signals: list[tuple[dt.date, str, str, int]] = []
    for _, row in perf.iterrows():
        ticker = row["ticker"]
        if ticker not in prices:
            df = load_prices(ticker)
            if df is None:
                continue
            prices[ticker] = df
        try:
            report_date = dt.date.fromisoformat(str(row["report_date"]))
        except ValueError:
            continue
        signal = find_signal(prices[ticker], report_date)
        if signal:
            n_clubs = ticker_club_count.get(ticker, 1)
            signals.append((signal, ticker, Path(str(row["source_file"])).name, n_clubs))
    signals.sort()

    by_signal_date: dict[dt.date, list[tuple[str, str, int]]] = {}
    for date, ticker, source, n_clubs in signals:
        by_signal_date.setdefault(date, []).append((ticker, source, n_clubs))

    calendar = sorted({ts.date() for df in prices.values() for ts in df.index})
    calendar = [d for d in calendar if d >= min(s[0] for s in signals)]
    regime = load_regime()
    kospi = load_kospi_index()

    print(f"signals: {len(signals)} (unique tickers {len({s[1] for s in signals})}) | regime data: {regime is not None}")
    consensus_tickers = {s[1] for s in signals if s[3] >= 2}
    print(f"consensus tickers (>=2 clubs, buy only): {len(consensus_tickers)}")

    # 민감도 그리드
    sensitivity: list[dict] = []
    headline: dict | None = None
    for atr_mult in (2.0, 3.0, 4.0, 5.0):
        for use_regime in (False, True):
            result = run_backtest(prices, by_signal_date, calendar, atr_mult, regime if use_regime else None, use_ratchet=True)
            entry = {"atr_mult": atr_mult, "regime_filter": use_regime, **result["metrics"]}
            sensitivity.append(entry)
            print(
                f"  ATR x{atr_mult} regime={'on' if use_regime else 'off'}: "
                f"total {entry['total_return_pct']}% | sharpe {entry['sharpe']} | mdd {entry['mdd_pct']}% | trades {entry['trades']}"
            )
            if atr_mult == HEADLINE_ATR_MULT and use_regime == HEADLINE_REGIME:
                headline = result

    assert headline is not None
    trades = headline["trades"]
    positions = headline["positions"]
    nav_df: pd.Series = headline["nav_df"]

    # 테일 캡처 통계
    tail_stats = compute_tail_stats(trades)
    print(f"tail: top10% trades={tail_stats.get('top_decile_n')} | pnl_share={tail_stats.get('top_decile_pnl_share_pct')}% | multibaggers={tail_stats.get('multibagger_count')}")

    # 컨센서스 통계
    consensus_stats = compute_consensus_stats(trades)
    if consensus_stats.get("multi_club") and consensus_stats["multi_club"]["count"] > 0:
        print(f"consensus: multi_club avg={consensus_stats['multi_club']['avg_return_pct']}% vs single={consensus_stats['single_club']['avg_return_pct']}%")

    # 부의 시뮬레이션 (DCA)
    backtest_start = dt.date.fromisoformat(headline["metrics"]["start"])
    backtest_end = dt.date.fromisoformat(headline["metrics"]["end"])
    wealth_sim: dict = {}
    if kospi is not None:
        wealth_sim = compute_wealth_simulation(nav_df, kospi, backtest_start, backtest_end)
        print(
            f"wealth sim: contributed={wealth_sim['final_contributed']:,} | "
            f"strategy={wealth_sim['final_strategy_value']:,} | "
            f"benchmark={wealth_sim['final_benchmark_value']:,}"
        )

    payload = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "params": {
            "min_days_before_signal": MIN_DAYS_BEFORE_SIGNAL,
            "signal_window_days": SIGNAL_WINDOW_DAYS,
            "atr_period": ATR_PERIOD,
            "atr_mult": HEADLINE_ATR_MULT,
            "regime_filter": HEADLINE_REGIME,
            "regime_ma": REGIME_MA,
            "max_positions": MAX_POSITIONS,
            "position_weight": POSITION_WEIGHT,
            "cost_per_side": COST_PER_SIDE,
            "ratchet_thresholds": [RATCHET_THRESHOLD_1, RATCHET_THRESHOLD_2],
            "universe_filter": "rating_class == buy",
        },
        "metrics": {**headline["metrics"], "signals": len(signals)},
        "yearly": headline["yearly"],
        "equity": headline["equity"],
        "sensitivity": sensitivity,
        "tail_stats": tail_stats,
        "consensus_stats": consensus_stats,
        "wealth_sim": wealth_sim,
        "best_trades": sorted(trades, key=lambda t: t["return_pct"], reverse=True)[:5],
        "worst_trades": sorted(trades, key=lambda t: t["return_pct"])[:5],
        "open_positions": [
            {
                "ticker": t,
                "entry_date": p["entry_date"].isoformat(),
                "entry": round(p["entry_price"], 2),
                "last_close": round(p["last_close"], 2),
                "stop": round(p["stop"], 2),
                "return_pct": round((p["shares"] * p["last_close"] / p["cost"] - 1) * 100, 2),
                "source": p["source"],
                "n_clubs": p.get("n_clubs", 1),
            }
            for t, p in positions.items()
        ],
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {OUT_PATH.relative_to(ROOT).as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
