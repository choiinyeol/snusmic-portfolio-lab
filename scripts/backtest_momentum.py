"""학회 리포트 × 추세추종(모멘텀) 전략 백테스트.

전략 규칙 (Does Trend Following Still Work on Stocks? 의 변형):
- 유니버스: 4개 학회 리포트가 커버한 KR 종목 (발간일 이후만 후보 — point-in-time 보장)
- 진입: 발간 후 10거래일 이상 지난 시점에 종가가 '발간 후 최고 종가'를 경신하면
        다음 거래일 시가에 매수 (발간 후 180일 이내에 신호가 없으면 소멸)
- 청산: 진입 후 최고 종가 - 3 × ATR(42) 트레일링 스탑을 종가가 하향 이탈하면
        다음 거래일 시가에 매도
- 포지션: 동일비중 5%, 최대 20종목. 슬롯 부족 시 90일 샤프비율 높은 순으로 선별
- 비용: 매수/매도 각 0.3% (수수료+세금+슬리피지 근사)

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
ATR_MULT = 3.0
MAX_POSITIONS = 20
POSITION_WEIGHT = 0.05
COST_PER_SIDE = 0.003
START_CAPITAL = 100_000_000

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


def find_signals(df: pd.DataFrame, report_date: dt.date) -> dt.date | None:
    """발간 후 신고가(종가) 돌파일을 반환. 없으면 None."""
    window = df[df.index >= pd.Timestamp(report_date)]
    if len(window) <= MIN_DAYS_BEFORE_SIGNAL:
        return None
    closes = window["close"]
    running_max = closes.cummax().shift(1)
    eligible = closes.index[MIN_DAYS_BEFORE_SIGNAL :]
    cutoff = pd.Timestamp(report_date) + pd.Timedelta(days=SIGNAL_WINDOW_DAYS)
    for ts in eligible:
        if ts > cutoff:
            return None
        if closes.loc[ts] > running_max.loc[ts]:
            return ts.date()
    return None


def main() -> int:
    perf = pd.read_csv(ROOT / "data" / "report_performance.csv", encoding="utf-8-sig")
    perf = perf[(perf["market"] == "KR") & perf["ticker"].notna() & perf["report_date"].notna()]
    perf["ticker"] = perf["ticker"].astype(str).str.zfill(6)

    prices: dict[str, pd.DataFrame] = {}
    signals: list[tuple[dt.date, str, str]] = []  # (signal_date, ticker, source_name)
    for _, row in perf.iterrows():
        ticker = row["ticker"]
        if ticker not in prices:
            df = load_prices(ticker)
            if df is None:
                continue
            prices[ticker] = df
        report_date = dt.date.fromisoformat(str(row["report_date"]))
        signal = find_signals(prices[ticker], report_date)
        if signal:
            signals.append((signal, ticker, Path(str(row["source_file"])).name))

    signals.sort()
    by_signal_date: dict[dt.date, list[tuple[str, str]]] = {}
    for date, ticker, source in signals:
        by_signal_date.setdefault(date, []).append((ticker, source))
    print(f"signals: {len(signals)} (unique tickers {len({s[1] for s in signals})})")

    calendar = sorted({ts.date() for df in prices.values() for ts in df.index})
    calendar = [d for d in calendar if d >= min(s[0] for s in signals)]

    cash = float(START_CAPITAL)
    positions: dict[str, dict] = {}
    nav_series: list[tuple[str, float]] = []
    trades: list[dict] = []
    pending_buys: list[tuple[str, str]] = []
    pending_sells: list[str] = []

    def quote(ticker: str, day: dt.date) -> pd.Series | None:
        df = prices[ticker]
        ts = pd.Timestamp(day)
        if ts in df.index:
            return df.loc[ts]
        return None

    for day in calendar:
        # 1) 예약 매도 (전일 종가가 스탑 이탈). 거래정지 등으로 시세가 없으면
        #    실제 거래 재개일까지 이연한다 (정지 직전 종가로 파는 낙관 편향 방지).
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
            nav_now = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
            slots = MAX_POSITIONS - len(positions)
            candidates = [(t, s) for t, s in pending_buys if t not in positions]
            if slots > 0 and candidates:
                # 신호일(전일) 종가 기준 샤프 — 매수일 종가는 아직 알 수 없으므로 사용 금지
                signal_cutoff = day - dt.timedelta(days=1)
                ranked = sorted(
                    candidates,
                    key=lambda item: asof_value(prices[item[0]]["sharpe90"], signal_cutoff),
                    reverse=True,
                )
                for ticker, source in ranked[:slots]:
                    q = quote(ticker, day)
                    if q is None or q["open"] <= 0:
                        continue
                    budget = min(nav_now * POSITION_WEIGHT, cash)
                    if budget < nav_now * POSITION_WEIGHT * 0.5:
                        continue
                    price = float(q["open"])
                    cost = budget
                    shares = budget * (1 - COST_PER_SIDE) / price
                    cash -= budget
                    atr = asof_value(prices[ticker]["atr"], day - dt.timedelta(days=1))
                    positions[ticker] = {
                        "shares": shares,
                        "entry_price": price,
                        "entry_date": day,
                        "cost": cost,
                        "highest": price,
                        "stop": price - ATR_MULT * atr if atr else price * 0.85,
                        "last_close": price,
                        "source": source,
                    }
        pending_buys = []

        # 3) 보유 종목 스탑 갱신 + 이탈 판정, NAV 산출
        for ticker, pos in positions.items():
            q = quote(ticker, day)
            if q is None:
                continue
            close = float(q["close"])
            pos["last_close"] = close
            pos["highest"] = max(pos["highest"], close)
            atr = asof_value(prices[ticker]["atr"], day)
            if atr:
                pos["stop"] = max(pos["stop"], pos["highest"] - ATR_MULT * atr)
            if close < pos["stop"] and ticker not in pending_sells:
                pending_sells.append(ticker)

        # 4) 오늘 발생한 신호는 내일 시가 매수 예약
        pending_buys = by_signal_date.get(day, [])

        nav = cash + sum(p["shares"] * p["last_close"] for p in positions.values())
        nav_series.append((day.isoformat(), nav))

    nav_df = pd.Series({pd.Timestamp(d): v for d, v in nav_series}).sort_index()
    daily_ret = nav_df.pct_change().dropna()
    total_return = nav_df.iloc[-1] / nav_df.iloc[0] - 1
    years = (nav_df.index[-1] - nav_df.index[0]).days / 365.25
    cagr = (nav_df.iloc[-1] / nav_df.iloc[0]) ** (1 / years) - 1 if years > 0 else None
    sharpe = float(daily_ret.mean() / daily_ret.std() * math.sqrt(252)) if daily_ret.std() else None
    drawdown = nav_df / nav_df.cummax() - 1
    mdd = float(drawdown.min())
    wins = [t for t in trades if t["return_pct"] > 0]
    year_last = nav_df.resample("YE").last().dropna()
    yearly = year_last.pct_change()
    if len(year_last):
        yearly.iloc[0] = year_last.iloc[0] / nav_df.iloc[0] - 1
    yearly = (yearly * 100).round(2)

    payload = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "params": {
            "min_days_before_signal": MIN_DAYS_BEFORE_SIGNAL,
            "signal_window_days": SIGNAL_WINDOW_DAYS,
            "atr_period": ATR_PERIOD,
            "atr_mult": ATR_MULT,
            "max_positions": MAX_POSITIONS,
            "position_weight": POSITION_WEIGHT,
            "cost_per_side": COST_PER_SIDE,
        },
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
            "signals": len(signals),
        },
        "yearly": [{"year": ts.year, "return_pct": float(v)} for ts, v in yearly.items()],
        "equity": [
            {"date": ts.date().isoformat(), "nav": round(v / START_CAPITAL, 4)}
            for ts, v in nav_df.resample("W-FRI").last().dropna().items()
        ],
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
            }
            for t, p in positions.items()
        ],
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(
        f"total {payload['metrics']['total_return_pct']}% | CAGR {payload['metrics']['cagr_pct']}% | "
        f"Sharpe {payload['metrics']['sharpe']} | MDD {payload['metrics']['mdd_pct']}% | trades {len(trades)}"
    )
    print(f"wrote {OUT_PATH.relative_to(ROOT).as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
