"""종목 페이지용 가격 차트 데이터를 public/prices/{slug}.json으로 내보낸다.

- 소스: data/prices/{MARKET}_{ticker}.csv (build_report_performance.py가 채운 캐시)
- 일별 OHLCV 캔들 전체를 emits한다 (주간 다운샘플 없음).
- slug 규칙은 웹과 동일: {market}-{ticker} 소문자 (예: kr-252990)

JSON shape:
  {
    "slug": "kr-252990",
    "candles": [
      {"time": "YYYY-MM-DD", "open": 1234.0, "high": 1300.0, "low": 1200.0, "close": 1280.0, "volume": 123456},
      ...
    ],
    "report_dates": ["YYYY-MM-DD", ...]   // dates where a report was published for this ticker
  }

  - open/high/low/close/volume 값이 NaN이거나 소스에 열이 없는 경우 해당 필드를 null 로 emit.
  - 모든 float 값은 소수 4자리로 반올림.
  - volume 이 없거나 0인 경우에도 레코드는 유지한다.

사용:
    python scripts/export_stock_charts.py
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PRICE_DIR = ROOT / "data" / "prices"
OUT_DIR = ROOT / "public" / "prices"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def _round_or_null(value: object) -> float | None:
    """float → 소수 4자리 반올림; NaN/None → None."""
    if value is None:
        return None
    try:
        f = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    if math.isnan(f):
        return None
    return round(f, 4)


def _int_or_null(value: object) -> int | None:
    if value is None:
        return None
    try:
        f = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    if math.isnan(f):
        return None
    return int(f)


def main() -> int:
    dataset = json.loads((ROOT / "src" / "data" / "report-performance.json").read_text(encoding="utf-8"))

    # Build slug → (market, ticker) and slug → set of report dates
    slugs: dict[str, tuple[str, str]] = {}
    slug_report_dates: dict[str, set[str]] = {}
    for record in dataset["records"]:
        if record.get("ticker") and record.get("market"):
            slug = f"{record['market']}-{record['ticker']}".lower()
            slugs[slug] = (record["market"], record["ticker"])
            date = record.get("report_date") or record.get("filename_date")
            if date:
                slug_report_dates.setdefault(slug, set()).add(date)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    written = 0
    for slug, (market, ticker) in sorted(slugs.items()):
        csv_path = PRICE_DIR / f"{market}_{ticker}.csv"
        if not csv_path.exists():
            continue
        df = pd.read_csv(csv_path, index_col=0, parse_dates=True).sort_index()
        if df.empty or "close" not in df.columns:
            continue
        df = df[~df.index.duplicated(keep="last")]

        # Determine available OHLCV columns
        has_open = "open" in df.columns
        has_high = "high" in df.columns
        has_low = "low" in df.columns
        has_volume = "volume" in df.columns

        candles: list[dict] = []
        for ts, row in df.iterrows():
            close_val = _round_or_null(row["close"])
            if close_val is None:
                continue  # skip rows where close is missing
            candle: dict = {
                "time": ts.date().isoformat(),  # type: ignore[union-attr]
                "open": _round_or_null(row["open"]) if has_open else None,
                "high": _round_or_null(row["high"]) if has_high else None,
                "low": _round_or_null(row["low"]) if has_low else None,
                "close": close_val,
                "volume": _int_or_null(row["volume"]) if has_volume else None,
            }
            candles.append(candle)

        if len(candles) < 2:
            continue

        report_dates = sorted(slug_report_dates.get(slug, set()))
        payload = {
            "slug": slug,
            "candles": candles,
            "report_dates": report_dates,
        }
        (OUT_DIR / f"{slug}.json").write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        written += 1
    print(f"wrote {written} chart files -> public/prices/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
