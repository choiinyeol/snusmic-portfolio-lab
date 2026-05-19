#!/usr/bin/env python3
"""Export OMX quant strategy search results into web-consumable artifacts."""

from __future__ import annotations

import csv
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".omx" / "quant" / "leader-meta-search-fixed.json"
JSON_OUT = ROOT / "data" / "web" / "strategies" / "quant-search-top.json"
CSV_OUT = ROOT / "apps" / "web" / "public" / "downloads" / "snusmic-quant-strategy-search.csv"


def finite_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed != parsed or parsed in (float("inf"), float("-inf")):
        return None
    return parsed


def fmt_params(params: dict[str, Any]) -> str:
    order = [
        "family",
        "persona",
        "lookback",
        "top_k",
        "score",
        "gate",
        "filter",
        "vol_target",
        "max_leverage",
    ]
    parts: list[str] = []
    for key in order:
        if key in params:
            parts.append(f"{key}={params[key]}")
    for key in sorted(params):
        if key not in order:
            parts.append(f"{key}={params[key]}")
    return ", ".join(parts)


def metric(row: dict[str, Any], key: str) -> float | None:
    return finite_float(row.get("metrics", {}).get(key))


def split_metric(row: dict[str, Any], split: str, key: str) -> float | None:
    return finite_float(row.get("split_metrics", {}).get(split, {}).get(key))


def build_row(rank: int, row: dict[str, Any]) -> dict[str, Any]:
    sharpe = metric(row, "annualized_sharpe")
    sortino_lpm0 = metric(row, "annualized_sortino_lpm0")
    sortino_downside_std = metric(row, "annualized_sortino_downside_std")
    robust_hit = (sharpe is not None and sharpe >= 2) or (
        sortino_downside_std is not None and sortino_downside_std >= 2
    )
    goal_hit = robust_hit or (sortino_lpm0 is not None and sortino_lpm0 >= 2)
    params = dict(row.get("params") or {})
    return {
        "rank": rank,
        "strategy_id": row.get("strategy_id", ""),
        "family": params.get("family", "unknown"),
        "params": params,
        "params_summary": fmt_params(params),
        "days": metric(row, "days"),
        "annualized_sharpe": sharpe,
        "annualized_sortino_lpm0": sortino_lpm0,
        "annualized_sortino_downside_std": sortino_downside_std,
        "cagr": metric(row, "cagr"),
        "total_return": metric(row, "total_return"),
        "max_drawdown": metric(row, "max_drawdown"),
        "ann_vol": metric(row, "ann_vol"),
        "score": max(
            [v for v in [sharpe, sortino_lpm0, sortino_downside_std] if v is not None], default=None
        ),
        "goal_hit": goal_hit,
        "robust_goal_hit": robust_hit,
        "hit_basis": "Sharpe/Sortino(Downside Std)"
        if robust_hit
        else ("Sortino(LPM0)" if goal_hit else "none"),
        "split_2021_2023_sharpe": split_metric(row, "2021_2023", "annualized_sharpe"),
        "split_2021_2023_sortino_lpm0": split_metric(row, "2021_2023", "annualized_sortino_lpm0"),
        "split_2021_2023_sortino_downside_std": split_metric(
            row, "2021_2023", "annualized_sortino_downside_std"
        ),
        "split_2024_2026_sharpe": split_metric(row, "2024_2026", "annualized_sharpe"),
        "split_2024_2026_sortino_lpm0": split_metric(row, "2024_2026", "annualized_sortino_lpm0"),
        "split_2024_2026_sortino_downside_std": split_metric(
            row, "2024_2026", "annualized_sortino_downside_std"
        ),
    }


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"missing source artifact: {SOURCE}")
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    seen: set[str] = set()
    input_rows: list[dict[str, Any]] = []
    for bucket in ("top_candidates", "goal_hits"):
        for row in source.get(bucket, []):
            key = row.get("strategy_id") or json.dumps(row.get("params", {}), sort_keys=True)
            if key in seen:
                continue
            seen.add(key)
            input_rows.append(row)
    rows = [build_row(index, row) for index, row in enumerate(input_rows, start=1)]

    artifact = {
        "schema_version": "1.0.0",
        "generated_at": datetime.now(UTC).isoformat(),
        "source_artifact": str(SOURCE.relative_to(ROOT)),
        "rerun_command": source.get("rerun_command"),
        "candidate_count": source.get("candidate_count"),
        "goal_hit_count": source.get("goal_hit_count"),
        "display_count": len(rows),
        "goal": "annualized Sharpe >= 2 or annualized Sortino >= 2",
        "metric_definitions": source.get("metric_definitions", {}),
        "excluded": source.get("excluded", []),
        "caveats": [
            "Research candidates only; not live trading advice.",
            "Rows are selected from a 2,772-candidate search and can be overfit.",
            "Signals are shifted to avoid same-day lookahead; weak_oracle is excluded.",
            "Sortino(LPM0) and Sortino(downside-std) use different denominators; both are shown.",
        ],
        "rows": rows,
    }

    JSON_OUT.parent.mkdir(parents=True, exist_ok=True)
    JSON_OUT.write_text(json.dumps(artifact, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    CSV_OUT.parent.mkdir(parents=True, exist_ok=True)
    headers = [
        "rank",
        "strategy_id",
        "family",
        "hit_basis",
        "goal_hit",
        "robust_goal_hit",
        "annualized_sharpe",
        "annualized_sortino_lpm0",
        "annualized_sortino_downside_std",
        "cagr",
        "total_return",
        "max_drawdown",
        "ann_vol",
        "days",
        "split_2021_2023_sharpe",
        "split_2021_2023_sortino_lpm0",
        "split_2021_2023_sortino_downside_std",
        "split_2024_2026_sharpe",
        "split_2024_2026_sortino_lpm0",
        "split_2024_2026_sortino_downside_std",
        "params_summary",
    ]
    with CSV_OUT.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    print(f"wrote {JSON_OUT.relative_to(ROOT)} ({len(rows)} rows)")
    print(f"wrote {CSV_OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
