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

from snusmic_pipeline.sim.contracts import StockRulePersonaConfig  # noqa: E402
from snusmic_pipeline.sim.stock_admission import (  # noqa: E402
    StockAdmissionArtifact,
    StockAdmissionDecision,
    StockAdmissionWindow,
    StockRuleCandidate,
    StockRuleMetrics,
    StockRuleParam,
)
from snusmic_pipeline.sim.stock_rule_search import (  # noqa: E402
    admit_oos,
    default_stock_rule_configs,
    search_is,
)


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
    parser.add_argument(
        "--max-configs",
        type=int,
        default=0,
        help="Limit the deterministic rule grid before IS search; 0 searches the full bounded grid.",
    )
    parser.add_argument("--admit-top", type=int, default=0, help="0 means evaluate all IS finalists")
    parser.add_argument("--benchmark-total-return", type=float, default=0.0)
    parser.add_argument("--min-oos-excess-return", type=float, default=0.0)
    parser.add_argument("--min-is-total-return", type=float, default=0.0)
    parser.add_argument("--min-is-sharpe", type=float, default=None)
    parser.add_argument("--min-oos-sharpe", type=float, default=None)
    parser.add_argument("--persona-top", type=int, default=10)
    parser.add_argument("--goal-min-sharpe", type=float, default=1.5)
    parser.add_argument("--goal-min-sortino", type=float, default=1.5)
    parser.add_argument("--goal-min-return", type=float, default=5.0)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    is_start = date.fromisoformat(args.is_start)
    is_end = date.fromisoformat(args.is_end)
    oos_start = date.fromisoformat(args.oos_start)
    oos_end = date.fromisoformat(args.oos_end)
    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)

    configs = default_stock_rule_configs()
    if args.max_configs > 0:
        configs = configs[: args.max_configs]
    is_result = search_is(
        warehouse_dir=args.warehouse,
        start_date=is_start,
        end_date=is_end,
        configs=configs,
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
    goal_rows = _goal_rows(
        admitted.trial_rows,
        persona_top=args.persona_top,
        min_sharpe=args.goal_min_sharpe,
        min_sortino=args.goal_min_sortino,
        min_return=args.goal_min_return,
    )
    persona_configs = _stock_persona_configs(
        goal_rows,
        search_start=is_start,
        search_end=is_end,
        oos_start=oos_start,
        oos_end=oos_end,
    )
    artifact = _stock_admission_artifact(
        admitted.trial_rows,
        selected_rule_ids={config.rule_id for config in persona_configs},
        search_start=is_start,
        search_end=is_end,
        oos_start=oos_start,
        oos_end=oos_end,
        benchmark_total_return=args.benchmark_total_return,
        min_oos_excess_return=args.min_oos_excess_return,
        min_sharpe=args.goal_min_sharpe,
        min_sortino=args.goal_min_sortino,
        min_return=args.goal_min_return,
    )
    (out / "stock-rule-personas.json").write_text(
        json.dumps(
            [_json_safe(config.model_dump(mode="json")) for config in persona_configs],
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    (out / "stock-admission.json").write_text(
        json.dumps(_json_safe(artifact.model_dump(mode="json")), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
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
        "goal_persona_count": len(persona_configs),
        "accepted_rule_ids": [config.rule_id for config in admitted.configs],
        "goal_persona_ids": [config.persona_name for config in persona_configs],
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
        f"{len(is_result.configs)} finalists, {len(admitted.configs)} OOS admissions, "
        f"{len(persona_configs)} goal personas"
    )
    if not accepted.empty:
        print(
            accepted[["rule_id", "oos_total_return", "oos_annualized_sharpe"]].head(10).to_string(index=False)
        )
    return 0


def _goal_rows(
    frame: pd.DataFrame,
    *,
    persona_top: int,
    min_sharpe: float,
    min_sortino: float,
    min_return: float,
) -> list[dict[str, Any]]:
    if frame.empty:
        return []
    rows = [
        row
        for row in frame.to_dict("records")
        if bool(row.get("accepted"))
        and _passes_goal(row, min_sharpe=min_sharpe, min_sortino=min_sortino, min_return=min_return)
    ]
    rows.sort(
        key=lambda row: (
            float(row.get("oos_annualized_sharpe") or 0.0),
            float(row.get("oos_annualized_sortino") or 0.0),
            float(row.get("oos_total_return") or 0.0),
            str(row.get("rule_id") or ""),
        ),
        reverse=True,
    )
    return rows[:persona_top] if persona_top > 0 else rows


def _passes_goal(
    row: dict[str, Any],
    *,
    min_sharpe: float,
    min_sortino: float,
    min_return: float,
) -> bool:
    return (
        float(row.get("oos_annualized_sharpe") or 0.0) >= min_sharpe
        or float(row.get("oos_annualized_sortino") or 0.0) >= min_sortino
        or float(row.get("oos_total_return") or 0.0) >= min_return
    )


def _stock_persona_configs(
    rows: list[dict[str, Any]],
    *,
    search_start: date,
    search_end: date,
    oos_start: date,
    oos_end: date,
) -> list[StockRulePersonaConfig]:
    configs: list[StockRulePersonaConfig] = []
    for index, row in enumerate(rows, start=1):
        rule_id = str(row["rule_id"])
        family_label = str(row["family"]).replace("_", " ").title()
        configs.append(
            StockRulePersonaConfig(
                persona_name=_stock_rule_persona_id(rule_id),
                label=f"Stock Rule {index:02d}: {family_label}",
                rule_id=rule_id,
                family=row["family"],
                fast_ma_days=int(row["fast_ma_days"]),
                slow_ma_days=int(row["slow_ma_days"]),
                min_report_age_days=int(row["min_report_age_days"]),
                max_report_age_days=int(row["max_report_age_days"]),
                rebalance=row["rebalance"],
                top_pool=int(row["top_pool"]),
                hold_top=int(row["hold_top"]),
                weight_mode=row["weight_mode"],
                score_mode=row["score_mode"],
                min_dynamic_upside=float(row.get("min_dynamic_upside") or 0.0),
                min_momentum_return=float(row.get("min_momentum_return") or -1.0),
                min_pullback_pct=float(row.get("min_pullback_pct") or 0.0),
                source_search_start=search_start,
                source_search_end=search_end,
                source_oos_start=oos_start,
                source_oos_end=oos_end,
                source_oos_total_return=float(row.get("oos_total_return") or 0.0),
                source_oos_sharpe=float(row.get("oos_annualized_sharpe") or 0.0),
                source_oos_sortino=float(row.get("oos_annualized_sortino") or 0.0),
            )
        )
    return configs


def _stock_admission_artifact(
    frame: pd.DataFrame,
    *,
    selected_rule_ids: set[str],
    search_start: date,
    search_end: date,
    oos_start: date,
    oos_end: date,
    benchmark_total_return: float,
    min_oos_excess_return: float,
    min_sharpe: float,
    min_sortino: float,
    min_return: float,
) -> StockAdmissionArtifact:
    window = StockAdmissionWindow(
        search_start=search_start,
        search_end=search_end,
        oos_start=oos_start,
        oos_end=oos_end,
    )
    decisions: list[StockAdmissionDecision] = []
    for row in frame.to_dict("records"):
        rule_id = str(row["rule_id"])
        selected = rule_id in selected_rule_ids
        passes_goal = _passes_goal(row, min_sharpe=min_sharpe, min_sortino=min_sortino, min_return=min_return)
        status = "accepted" if selected else _artifact_status(row, passes_goal=passes_goal)
        reasons = ["beats_oos_benchmark"] if status == "accepted" else _artifact_reasons(row)
        candidate = StockRuleCandidate(
            rule_id=rule_id,
            family=_artifact_family(str(row["family"])),
            symbol=_representative_symbol(row),
            company=None,
            window=window,
            params=tuple(
                StockRuleParam(name=name, value=row.get(name))
                for name in (
                    "family",
                    "fast_ma_days",
                    "slow_ma_days",
                    "min_report_age_days",
                    "max_report_age_days",
                    "rebalance",
                    "top_pool",
                    "hold_top",
                    "weight_mode",
                    "score_mode",
                    "min_dynamic_upside",
                    "min_momentum_return",
                    "min_pullback_pct",
                )
            ),
            in_sample_metrics=_metrics(row, "is"),
        )
        decisions.append(
            StockAdmissionDecision(
                candidate=candidate,
                status=status,
                reason_codes=tuple(reasons),
                out_of_sample_metrics=_metrics(row, "oos"),
                benchmark_oos_money_weighted_return=benchmark_total_return,
                excess_return_vs_benchmark=float(row.get("oos_total_return") or 0.0) - benchmark_total_return,
                min_excess_return=min_oos_excess_return,
                min_trades=1,
                min_sharpe=None,
                min_sortino=None,
            )
        )
    return StockAdmissionArtifact(
        window=window,
        benchmark_persona="cash_or_selected_benchmark",
        decisions=tuple(decisions),
        methodology=(
            "search_is ranks stock rules using only the in-sample window",
            "admit_oos replays frozen IS finalists on the later OOS window",
            "portfolio personas are materialized only when OOS Sharpe >= 1.5, Sortino >= 1.5, or return >= 500%",
        ),
    )


def _metrics(row: dict[str, Any], prefix: str) -> StockRuleMetrics:
    total_return = float(row.get(f"{prefix}_total_return") or 0.0)
    return StockRuleMetrics(
        money_weighted_return=total_return,
        net_profit_krw=total_return,
        final_equity_krw=max(0.0, 1.0 + total_return),
        max_drawdown=abs(float(row.get(f"{prefix}_max_drawdown") or 0.0)),
        trade_count=int(row.get(f"{prefix}_active_days") or 0),
        sharpe=float(row.get(f"{prefix}_annualized_sharpe") or 0.0),
        sortino=float(row.get(f"{prefix}_annualized_sortino") or 0.0),
    )


def _artifact_status(row: dict[str, Any], *, passes_goal: bool) -> str:
    if not bool(row.get("accepted")):
        status = str(row.get("admission_status") or "")
        if "duplicate" in status:
            return "duplicate_behavior"
        if "activity" in status:
            return "insufficient_trades"
        if "benchmark" in status:
            return "below_benchmark"
    return "below_risk_gate" if not passes_goal else "duplicate_behavior"


def _artifact_reasons(row: dict[str, Any]) -> list[str]:
    status = str(row.get("admission_status") or "")
    if "duplicate" in status:
        return ["duplicate_behavior"]
    if "benchmark" in status:
        return ["below_oos_benchmark"]
    if "activity" in status:
        return ["insufficient_trades"]
    return ["below_sharpe_gate", "below_sortino_gate"]


def _artifact_family(family: str) -> str:
    return {
        "target_upside_momentum": "relative_strength",
        "fresh_report_momentum": "mtt",
        "target_gap_reversal": "rsi_reversal",
    }.get(family, "relative_strength")


def _representative_symbol(row: dict[str, Any]) -> str:
    holdings = row.get("current_holdings")
    if isinstance(holdings, dict) and holdings:
        return str(next(iter(holdings)))
    if isinstance(holdings, str):
        try:
            parsed = json.loads(holdings)
        except json.JSONDecodeError:
            parsed = {}
        if isinstance(parsed, dict) and parsed:
            return str(next(iter(parsed)))
    return "multi_stock"


def _stock_rule_persona_id(rule_id: str) -> str:
    safe = "".join(ch if ch.isalnum() else "_" for ch in rule_id.lower()).strip("_")
    return f"stock_rule_{safe}"


if __name__ == "__main__":
    raise SystemExit(main())
