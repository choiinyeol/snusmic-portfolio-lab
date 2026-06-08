from __future__ import annotations

import json
import math
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import pandas as pd

Status = Literal["accepted", "rejected", "diagnostic", "warning"]

MOTIF_FIELDS: dict[str, set[str]] = {
    "change_top_n": {"top_n"},
    "change_rebalance_cadence": {"rebalance", "quarter_offset_months"},
    "change_freshness_window": {"max_report_age_days", "min_report_age_days", "entry_max_report_age_days"},
    "switch_score_field": {"score_field", "entry_score_field", "retention_score_field", "rank_mode"},
    "change_entry_gate": {
        "entry_confirmation_rank",
        "entry_confirmation_rebalances",
        "min_return_1m",
        "min_return_3m",
        "min_return_6m",
        "min_return_1y",
        "min_distance_from_52w_high",
        "min_distance_from_52w_low",
        "min_relative_strength_percentile",
        "require_above_50ma",
        "require_above_150ma",
        "require_above_200ma",
        "require_ma_stack",
        "require_macd_bullish",
        "require_mtt_template",
    },
    "change_replacement_timing": {"replacement_delay_rebalances", "rotate_on_exit", "rank_exit_threshold"},
    "change_winner_retention": {"allow_rebalance_sell_down", "min_holding_days"},
    "change_retained_cap": {
        "retained_weight_cap",
        "retained_weight_cap_trigger",
        "retained_weight_cap_cadence",
        "retained_weight_cap_min_unrealized_return",
    },
    "change_trailing_trim": {
        "trail_stop_min_unrealized_return",
        "trail_stop_drawdown_pct",
        "trail_trim_min_unrealized_return",
        "trail_trim_drawdown_pct",
        "trail_trim_weight_cap",
        "trail_trim_cooldown_days",
    },
    "change_redeploy_after_trim": {
        "redeploy_after_trailing_trim",
        "redeploy_after_trailing_trim_min_cash_pct",
        "redeploy_after_trailing_trim_buy_fraction",
    },
    "change_exposure_control": {
        "weighting",
        "max_weight",
        "target_gross_exposure",
        "volatility_lookback_days",
        "volatility_target_annual",
        "market_gate",
        "market_gate_symbol",
    },
    "change_cost_or_cashflow_stress": {"fees", "contribution_timing"},
}

FAILURE_STATUSES = {"rejected", "warning"}


@dataclass(frozen=True)
class StrategyEdge:
    parent_account_id: str
    child_account_id: str
    status: Status
    evidence: str = ""


@dataclass(frozen=True)
class MemoryRecord:
    parent_account_id: str
    child_account_id: str
    context_key: str
    motif: str
    status: Status
    residual: float
    changed_fields: tuple[str, ...]
    evidence: str


@dataclass(frozen=True)
class SkippedEdge:
    parent_account_id: str
    child_account_id: str
    reason: str


@dataclass(frozen=True)
class MotifStats:
    context_key: str
    motif: str
    n: int
    mean_residual: float
    variance: float
    confidence: float
    failure_probability: float
    veto: bool


DEFAULT_RESEARCH_EDGES: tuple[StrategyEdge, ...] = (
    StrategyEdge("pit_score_top5", "pit_trend_top5", "accepted", "001 trend ranking beat score ranking."),
    StrategyEdge("pit_trend_top5", "pit_trend_top7", "rejected", "002/005/010/019/028/050/062 Top7 dilution repeatedly failed."),
    StrategyEdge("pit_trend_top5", "pit_trend_persist20_top5", "accepted", "004 rank persistence improved churn-adjusted behavior."),
    StrategyEdge("pit_trend_persist20_top5", "pit_trend_persist20_top3", "rejected", "005 Top3 concentration failed."),
    StrategyEdge("pit_trend_persist20_quarterly_top5", "pit_trend_quarterly_fresh540_top5", "accepted", "009 540-day freshness cap became best quarterly rule."),
    StrategyEdge("pit_trend_quarterly_fresh540_top5", "pit_trend_quarterly_fresh540_top3", "rejected", "010 Top3 failed around fresh540."),
    StrategyEdge("pit_trend_quarterly_fresh540_top5", "pit_trend_quarterly_fresh540_top7", "rejected", "010 Top7 failed around fresh540."),
    StrategyEdge("pit_trend_quarterly_fresh540_top5", "pit_trend_quarterly_fresh540_runwinners_top5", "accepted", "018 run-winners stopped premature sell-downs."),
    StrategyEdge("pit_trend_quarterly_fresh540_runwinners_top5", "pit_trend_quarterly_fresh540_runwinners_top3", "rejected", "019 Top3 failed under run-winners."),
    StrategyEdge("pit_trend_quarterly_fresh540_runwinners_top5", "pit_trend_quarterly_fresh540_runwinners_top7", "rejected", "019 Top7 failed under run-winners."),
    StrategyEdge("pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5", "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5", "accepted", "032 candidate score improved Profit60 shell."),
    StrategyEdge("pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5", "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top3", "rejected", "033 Candidate Top3 failed."),
    StrategyEdge("pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5", "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top7", "rejected", "033 Candidate Top7 failed."),
    StrategyEdge("pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5", "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_delay1_top5", "rejected", "042 blanket delayed replacement killed the mechanism."),
    StrategyEdge("pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5", "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_confirm10_top5", "rejected", "044 confirmation gates starved entries."),
    StrategyEdge("pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5", "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5", "accepted", "049 partial trailing trim improved path."),
    StrategyEdge("pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5", "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top3", "rejected", "050 Top3 failed under TrailTrim."),
    StrategyEdge("pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5", "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top7", "rejected", "050 Top7 failed under TrailTrim."),
    StrategyEdge("pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5", "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5", "accepted", "055 cap20 improved the trim branch."),
    StrategyEdge("pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5", "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploy_top5", "rejected", "058 blanket same-day redeploy raised churn and lost."),
    StrategyEdge("pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5", "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5", "accepted", "061 cash-gated redeploy became local best before stress."),
    StrategyEdge("pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5", "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5", "warning", "063 narrow base-cost gain; overfit and cost-sensitivity warning."),
)


def load_account_configs(path: Path) -> dict[str, dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    accounts = payload.get("accounts", [])
    return {str(account["account_id"]): dict(account) for account in accounts if "account_id" in account}


def load_summary(path: Path) -> dict[str, dict[str, float]]:
    frame = pd.read_csv(path)
    return {
        str(row.account_id): {
            "money_weighted_return": float(row.money_weighted_return),
            "sharpe": float(row.sharpe),
            "sortino": float(row.sortino),
            "max_drawdown": float(row.max_drawdown),
            "trade_count": float(row.trade_count),
            "final_equity_krw": float(row.final_equity_krw),
        }
        for row in frame.itertuples(index=False)
    }


def changed_fields(parent: dict[str, Any], child: dict[str, Any]) -> tuple[str, ...]:
    ignored = {"account_id", "label"}
    keys = (set(parent) | set(child)) - ignored
    return tuple(sorted(key for key in keys if parent.get(key) != child.get(key)))


def motif_for_changed_fields(fields: tuple[str, ...]) -> str:
    if not fields:
        return "no_config_change"
    field_set = set(fields)
    matched = [motif for motif, motif_fields in MOTIF_FIELDS.items() if field_set & motif_fields]
    if len(matched) == 1 and field_set <= MOTIF_FIELDS[matched[0]]:
        return matched[0]
    if len(matched) > 0:
        return "mixed_config_change"
    return "other_config_change"


def strategy_family(account: dict[str, Any]) -> str:
    if account.get("redeploy_after_trailing_trim"):
        return "trailtrim_redeploy"
    if account.get("trail_trim_weight_cap") is not None:
        return "trailtrim"
    if account.get("retained_weight_cap") is not None:
        return "retained_cap"
    if account.get("allow_rebalance_sell_down") is False:
        return "runwinners"
    if account.get("rebalance") == "quarterly" and account.get("max_report_age_days") == 540:
        return "quarterly_fresh540"
    if str(account.get("account_id", "")).startswith("pit_trend"):
        return "pit_trend"
    return "other"


def _bucket(value: float | None, boundaries: tuple[float, ...], labels: tuple[str, ...]) -> str:
    if value is None or not math.isfinite(value):
        return "unknown"
    for boundary, label in zip(boundaries, labels, strict=False):
        if value <= boundary:
            return label
    return labels[-1]


def context_key(account: dict[str, Any], metrics: dict[str, float] | None) -> str:
    metrics = metrics or {}
    family = strategy_family(account)
    mwr = _bucket(metrics.get("money_weighted_return"), (0.25, 0.5, 0.7), ("low", "medium", "high", "very_high"))
    drawdown = _bucket(metrics.get("max_drawdown"), (0.2, 0.3, 0.4), ("low_dd", "medium_dd", "high_dd", "very_high_dd"))
    trades = _bucket(metrics.get("trade_count"), (100, 250, 500), ("low_turnover", "medium_turnover", "high_turnover", "very_high_turnover"))
    return f"{family}|{mwr}|{drawdown}|{trades}"


def quality_score(metrics: dict[str, float] | None) -> float:
    if not metrics:
        return 0.0
    return (
        metrics["money_weighted_return"]
        + 0.12 * metrics["sharpe"]
        + 0.08 * metrics["sortino"]
        - 0.35 * metrics["max_drawdown"]
        - 0.00025 * metrics["trade_count"]
    )


def build_memory_records(
    accounts: dict[str, dict[str, Any]],
    summary: dict[str, dict[str, float]],
    edges: tuple[StrategyEdge, ...] = DEFAULT_RESEARCH_EDGES,
) -> tuple[list[MemoryRecord], list[SkippedEdge]]:
    records: list[MemoryRecord] = []
    skipped: list[SkippedEdge] = []
    for edge in edges:
        parent = accounts.get(edge.parent_account_id)
        child = accounts.get(edge.child_account_id)
        if parent is None:
            skipped.append(SkippedEdge(edge.parent_account_id, edge.child_account_id, "missing parent config in sim artifact"))
            continue
        if child is None:
            skipped.append(SkippedEdge(edge.parent_account_id, edge.child_account_id, "missing child config in sim artifact"))
            continue
        parent_metrics = summary.get(edge.parent_account_id)
        child_metrics = summary.get(edge.child_account_id)
        if parent_metrics is None:
            skipped.append(SkippedEdge(edge.parent_account_id, edge.child_account_id, "missing parent summary row in sim artifact"))
            continue
        if child_metrics is None:
            skipped.append(SkippedEdge(edge.parent_account_id, edge.child_account_id, "missing child summary row in sim artifact"))
            continue
        fields = changed_fields(parent, child)
        records.append(
            MemoryRecord(
                parent_account_id=edge.parent_account_id,
                child_account_id=edge.child_account_id,
                context_key=context_key(parent, parent_metrics),
                motif=motif_for_changed_fields(fields),
                status=edge.status,
                residual=quality_score(child_metrics) - quality_score(parent_metrics),
                changed_fields=fields,
                evidence=edge.evidence,
            )
        )
    return records, skipped


def confidence(n: int, mean: float, variance: float, *, kappa: float = 3.0) -> float:
    sigma = math.sqrt(max(variance, 0.0))
    stability = 1.0 if sigma == 0 else min(1.0, abs(mean) / (sigma + 1e-9))
    return (n / (n + kappa)) * stability


def build_motif_stats(records: list[MemoryRecord], *, veto_confidence: float = 0.45, veto_failure_probability: float = 0.65) -> list[MotifStats]:
    grouped: dict[tuple[str, str], list[MemoryRecord]] = defaultdict(list)
    for record in records:
        if record.motif == "mixed_config_change":
            continue
        grouped[(record.context_key, record.motif)].append(record)

    stats: list[MotifStats] = []
    for (ctx, motif), rows in sorted(grouped.items()):
        residuals = [row.residual for row in rows]
        mean = sum(residuals) / len(residuals)
        variance = sum((value - mean) ** 2 for value in residuals) / max(len(rows) - 1, 1)
        fail_count = sum(1 for row in rows if row.status in FAILURE_STATUSES)
        fail_prob = (1.0 + fail_count) / (2.0 + len(rows))
        conf = confidence(len(rows), mean, variance)
        stats.append(
            MotifStats(
                context_key=ctx,
                motif=motif,
                n=len(rows),
                mean_residual=mean,
                variance=variance,
                confidence=conf,
                failure_probability=fail_prob,
                veto=conf > veto_confidence and fail_prob > veto_failure_probability,
            )
        )
    return stats


def build_strategy_memory(sim_dir: Path) -> tuple[list[MemoryRecord], list[MotifStats], list[SkippedEdge]]:
    accounts = load_account_configs(sim_dir / "account-configs.json")
    summary = load_summary(sim_dir / "summary.csv")
    records, skipped = build_memory_records(accounts, summary)
    return records, build_motif_stats(records), skipped


def render_strategy_memory_report(records: list[MemoryRecord], stats: list[MotifStats], skipped: list[SkippedEdge]) -> str:
    total_edges = len(records) + len(skipped)
    lines = [
        "# Strategy Process Memory",
        "",
        "AlphaMemo-style research-only memory over `PitSignalRuleConfig` diffs. Positive residuals are guidance only; high-confidence repeated failure motifs can veto future search branches.",
        "",
        "## Coverage",
        "",
        f"- curated edges: {total_edges}",
        f"- extracted from current sim artifacts: {len(records)}",
        f"- extracted single-motif stats rows: {len(stats)}",
        f"- skipped because the current `data/sim` shortlist lacks required parent/child config or summary rows: {len(skipped)}",
        "- `mixed_config_change` edges remain visible in Extracted Edges but are excluded from motif/veto statistics to avoid false precision.",
        "- this report is research-only and must not be used for product promotion or automatic branch admission.",
        "",
        "## Context/Motif Statistics",
        "",
        "| context | motif | n | mean residual | confidence | failure p | veto |",
        "| --- | --- | ---: | ---: | ---: | ---: | --- |",
    ]
    for stat in stats:
        lines.append(
            f"| `{stat.context_key}` | `{stat.motif}` | {stat.n} | {stat.mean_residual:.4f} | {stat.confidence:.3f} | {stat.failure_probability:.3f} | {'yes' if stat.veto else 'no'} |"
        )
    if not stats:
        lines.append("| _none_ | _none_ | 0 | 0.0000 | 0.000 | 0.000 | no |")
    lines.extend(
        [
            "",
            "## Extracted Edges",
            "",
            "| parent | child | motif | status | residual | changed fields | evidence |",
            "| --- | --- | --- | --- | ---: | --- | --- |",
        ]
    )
    for record in records:
        lines.append(
            f"| `{record.parent_account_id}` | `{record.child_account_id}` | `{record.motif}` | {record.status} | {record.residual:.4f} | `{', '.join(record.changed_fields)}` | {record.evidence} |"
        )
    if not records:
        lines.append("| _none_ | _none_ | _none_ | _none_ | 0.0000 | _none_ | no extracted edges |")
    lines.extend(
        [
            "",
            "## Skipped Curated Edges",
            "",
            "| parent | child | reason |",
            "| --- | --- | --- |",
        ]
    )
    for skipped_edge in skipped:
        lines.append(f"| `{skipped_edge.parent_account_id}` | `{skipped_edge.child_account_id}` | {skipped_edge.reason} |")
    if not skipped:
        lines.append("| _none_ | _none_ | all curated edges had supporting sim artifacts |")
    return "\n".join(lines) + "\n"
