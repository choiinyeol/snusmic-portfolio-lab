#!/usr/bin/env python3
"""Run stock-level IS search and OOS admission.

Example:
    uv run python scripts/run_stock_rule_search.py \
      --warehouse data/warehouse --is-start 2021-01-04 --is-end 2023-12-31 \
      --oos-start 2024-01-02 --oos-end 2026-05-11 --out .omx/quant-insights/stock-rule-search
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import pandas as pd  # noqa: E402

from snusmic_pipeline.sim.stock_rule_search import admit_oos, search_is  # noqa: E402


def _json_safe(value: Any) -> Any:
    if isinstance(value, float):
        if value != value or value in {float("inf"), float("-inf")}:
            return None
        return value
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    if isinstance(value, tuple):
        return [_json_safe(v) for v in value]
    return value


def _write_rows(frame: pd.DataFrame, csv_path: Path, json_path: Path) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(csv_path, index=False)
    rows = [_json_safe(row) for row in frame.to_dict("records")]
    json_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--warehouse", type=Path, default=ROOT / "data" / "warehouse")
    parser.add_argument("--is-start", type=str, default="2021-01-04")
    parser.add_argument("--is-end", type=str, default="2023-12-31")
    parser.add_argument("--oos-start", type=str, default="2024-01-02")
    parser.add_argument("--oos-end", type=str, default=date.today().isoformat())
    parser.add_argument("--out", type=Path, default=ROOT / ".omx" / "quant-insights" / "stock-rule-search")
    parser.add_argument("--is-top", type=int, default=75)
    parser.add_argument("--admit-top", type=int, default=0, help="0 means evaluate all IS finalists")
    parser.add_argument("--benchmark-total-return", type=float, default=0.0)
    parser.add_argument("--min-oos-excess-return", type=float, default=0.0)
    parser.add_argument("--min-is-total-return", type=float, default=0.0)
    parser.add_argument("--min-is-sharpe", type=float, default=None)
    parser.add_argument("--min-oos-sharpe", type=float, default=None)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    is_start = date.fromisoformat(args.is_start)
    is_end = date.fromisoformat(args.is_end)
    oos_start = date.fromisoformat(args.oos_start)
    oos_end = date.fromisoformat(args.oos_end)
    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)

    is_result = search_is(
        warehouse_dir=args.warehouse,
        start_date=is_start,
        end_date=is_end,
        top_n=args.is_top,
    )
    admitted = admit_oos(
        warehouse_dir=args.warehouse,
        configs=is_result,
        is_start=is_start,
        is_end=is_end,
        oos_start=oos_start,
        oos_end=oos_end,
        benchmark_total_return=args.benchmark_total_return,
        top_n=args.admit_top,
        min_oos_excess_return=args.min_oos_excess_return,
        min_is_total_return=args.min_is_total_return,
        min_is_sharpe=args.min_is_sharpe,
        min_oos_sharpe=args.min_oos_sharpe,
    )

    _write_rows(is_result.trial_rows, out / "is-search.csv", out / "is-search.json")
    _write_rows(admitted.trial_rows, out / "oos-admission.csv", out / "oos-admission.json")

    accepted = (
        admitted.trial_rows[admitted.trial_rows["accepted"]]
        if not admitted.trial_rows.empty
        else pd.DataFrame()
    )
    summary = {
        "schema_version": "1.0.0",
        "generated_at": datetime.now(UTC).isoformat(),
        "data_sources": [str(args.warehouse / "daily_prices.csv"), str(args.warehouse / "reports.csv")],
        "windows": {
            "is": {"start": args.is_start, "end": args.is_end},
            "oos": {"start": args.oos_start, "end": args.oos_end},
        },
        "searched_count": int(len(is_result.trial_rows)),
        "is_finalist_count": int(len(is_result.configs)),
        "accepted_count": int(len(admitted.configs)),
        "accepted_rule_ids": [config.rule_id for config in admitted.configs],
        "methodology": (
            "Stock-level report rules rank individual symbols from report/price data available at "
            "rebalance close, shift holdings one trading day, then require separate OOS admission."
        ),
    }
    (out / "summary.json").write_text(
        json.dumps(_json_safe(summary), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"stock-rule search: {len(is_result.trial_rows)} IS rows, "
        f"{len(is_result.configs)} finalists, {len(admitted.configs)} OOS admissions"
    )
    if not accepted.empty:
        print(
            accepted[["rule_id", "oos_total_return", "oos_annualized_sharpe"]].head(10).to_string(index=False)
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
