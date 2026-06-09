"""종목 페이지용 가격 차트 데이터를 public/prices/{slug}.json으로 내보낸다.

- 소스: data/prices/{MARKET}_{ticker}.csv (build_report_performance.py가 채운 캐시)
- 용량을 위해 주간(금요일) 종가로 다운샘플하고, 최근 60거래일은 일별로 유지한다.
- slug 규칙은 웹과 동일: {market}-{ticker} 소문자 (예: kr-252990)

사용:
    python scripts/export_stock_charts.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PRICE_DIR = ROOT / "data" / "prices"
OUT_DIR = ROOT / "public" / "prices"
DAILY_TAIL = 60

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def main() -> int:
    dataset = json.loads((ROOT / "src" / "data" / "report-performance.json").read_text(encoding="utf-8"))
    slugs: dict[str, tuple[str, str]] = {}
    for record in dataset["records"]:
        if record.get("ticker") and record.get("market"):
            slug = f"{record['market']}-{record['ticker']}".lower()
            slugs[slug] = (record["market"], record["ticker"])

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    written = 0
    for slug, (market, ticker) in sorted(slugs.items()):
        csv_path = PRICE_DIR / f"{market}_{ticker}.csv"
        if not csv_path.exists():
            continue
        df = pd.read_csv(csv_path, index_col=0, parse_dates=True).sort_index()
        if df.empty or "close" not in df:
            continue
        df = df[~df.index.duplicated(keep="last")]
        closes = df["close"].dropna()
        if len(closes) < 2:
            continue
        cut = closes.index[-DAILY_TAIL] if len(closes) > DAILY_TAIL else closes.index[0]
        weekly = closes[closes.index < cut].resample("W-FRI").last().dropna()
        daily = closes[closes.index >= cut]
        series = pd.concat([weekly, daily])
        series = series[~series.index.duplicated(keep="last")].sort_index()
        payload = {
            "slug": slug,
            "points": [{"d": ts.date().isoformat(), "c": round(float(v), 4)} for ts, v in series.items()],
        }
        (OUT_DIR / f"{slug}.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        written += 1
    print(f"wrote {written} chart files -> public/prices/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
