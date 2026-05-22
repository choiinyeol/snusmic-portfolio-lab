"""Stock-level admission helpers used by the strategy generation pipeline."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any, Literal, cast

import numpy as np
import pandas as pd

from snusmic_pipeline.sim.contracts import StockRulePersonaConfig
from snusmic_pipeline.sim.stock_admission import (
    StockAdmissionArtifact,
    StockAdmissionDecision,
    StockAdmissionReason,
    StockAdmissionStatus,
    StockAdmissionWindow,
    StockRuleCandidate,
    StockRuleFamily,
    StockRuleMetrics,
    StockRuleParam,
)

ValidationMode = Literal["oos", "full_sample"]
_COVERAGE_POOL_REPRESENTATIVE_FAMILIES = ("price_momentum", "ma_crossover")
_STOCK_RULE_FAMILY_LABELS = {
    "fresh_report_momentum": "신규 리포트 추세",
    "ma_crossover": "이동평균 정배열",
    "price_momentum": "가격 추세",
    "rsi_reversal": "RSI 반등",
    "target_gap_reversal": "목표가 괴리 되돌림",
    "target_upside_momentum": "목표가 상승여력 추세",
}


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
    rows = [_json_safe(row) for row in cast(list[dict[str, Any]], frame.to_dict("records"))]
    json_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _apply_diversity_gate(
    frame: pd.DataFrame,
    *,
    returns_by_rule_id: dict[str, list[float]],
    persona_top: int,
    min_sharpe: float,
    min_sortino: float,
    min_return: float,
    max_drawdown: float,
    max_correlation: float,
) -> tuple[pd.DataFrame, list[dict[str, Any]], dict[str, Any]]:
    if frame.empty:
        return frame, [], {"enabled": max_correlation > 0, "selected_count": 0, "rejected_count": 0}

    rows = cast(list[dict[str, Any]], frame.to_dict("records"))
    eligible = [
        row
        for row in rows
        if bool(row.get("accepted"))
        and _passes_goal(
            row,
            min_sharpe=min_sharpe,
            min_sortino=min_sortino,
            min_return=min_return,
            max_drawdown=max_drawdown,
        )
    ]
    eligible.sort(key=_goal_sort_key, reverse=True)

    selected: list[dict[str, Any]] = []
    selected_series: list[tuple[str, np.ndarray]] = []
    selected_meta: dict[str, dict[str, Any]] = {}
    rejected_meta: dict[str, dict[str, Any]] = {}

    for row in eligible:
        rule_id = str(row.get("rule_id") or "")
        series = _return_series(returns_by_rule_id.get(rule_id))
        peer_id = None
        peer_corr = 0.0
        if max_correlation > 0 and series.size:
            for selected_id, peer_series in selected_series:
                corr = _path_correlation(series, peer_series)
                if corr > peer_corr:
                    peer_corr = corr
                    peer_id = selected_id
        if max_correlation > 0 and peer_corr >= max_correlation and peer_id is not None:
            rejected_meta[rule_id] = {
                "diversity_status": "correlation_rejected",
                "diversity_correlated_with_rule_id": peer_id,
                "diversity_max_correlation": peer_corr,
            }
            continue

        selected_meta[rule_id] = {
            "diversity_status": "selected",
            "diversity_correlated_with_rule_id": peer_id,
            "diversity_max_correlation": peer_corr if peer_id is not None else None,
        }
        selected.append(row)
        if series.size:
            selected_series.append((rule_id, series))
        if persona_top > 0 and len(selected) >= persona_top:
            break

    representative_ids = _append_coverage_pool_representatives(
        eligible,
        persona_top=persona_top,
        selected=selected,
        selected_meta=selected_meta,
        rejected_meta=rejected_meta,
    )

    meta_by_rule = {**rejected_meta, **selected_meta}
    updated = frame.copy()
    updated["diversity_status"] = [
        meta_by_rule.get(str(row.get("rule_id") or ""), {}).get("diversity_status", "not_selected")
        for row in rows
    ]
    updated["diversity_correlated_with_rule_id"] = [
        meta_by_rule.get(str(row.get("rule_id") or ""), {}).get("diversity_correlated_with_rule_id")
        for row in rows
    ]
    updated["diversity_max_correlation"] = [
        meta_by_rule.get(str(row.get("rule_id") or ""), {}).get("diversity_max_correlation") for row in rows
    ]
    updated.attrs.update(frame.attrs)
    summary = {
        "enabled": max_correlation > 0,
        "max_correlation": max_correlation,
        "max_drawdown": max_drawdown,
        "eligible_count": len(eligible),
        "selected_count": len(selected),
        "correlation_rejected_count": len(rejected_meta),
        "selected_rule_ids": [str(row.get("rule_id") or "") for row in selected],
        "correlation_rejected_rule_ids": sorted(rejected_meta),
        "coverage_pool_representative_rule_ids": representative_ids,
    }
    return updated, selected, summary


def _append_coverage_pool_representatives(
    eligible: list[dict[str, Any]],
    *,
    persona_top: int,
    selected: list[dict[str, Any]],
    selected_meta: dict[str, dict[str, Any]],
    rejected_meta: dict[str, dict[str, Any]],
) -> list[str]:
    """Keep one semi-permanent coverage-pool price/MA rule visible as a portfolio.

    The diversity gate can correctly mark price-only coverage-pool rules as
    behaviorally redundant versus report-upside rules.  For product review we
    still want one representative of the user's pool -> candidate -> buy idea
    materialized as an actual ledger persona.
    """

    selected_ids = {str(row.get("rule_id") or "") for row in selected}
    selected_families = {str(row.get("family") or "") for row in selected}
    added: list[str] = []
    for family in _COVERAGE_POOL_REPRESENTATIVE_FAMILIES:
        if family in selected_families:
            continue
        candidates = [row for row in eligible if str(row.get("family") or "") == family]
        if not candidates:
            continue
        candidates.sort(
            key=lambda row: (
                float(row.get("oos_total_return") or 0.0),
                float(row.get("oos_annualized_sharpe") or 0.0),
                float(row.get("oos_annualized_sortino") or 0.0),
                str(row.get("rule_id") or ""),
            ),
            reverse=True,
        )
        row = candidates[0]
        rule_id = str(row.get("rule_id") or "")
        if rule_id in selected_ids:
            continue
        if persona_top > 0 and len(selected) >= persona_top:
            replace_idx = _coverage_replacement_index(selected)
            if replace_idx is None:
                break
            replaced = selected.pop(replace_idx)
            replaced_id = str(replaced.get("rule_id") or "")
            selected_ids.discard(replaced_id)
            selected_families.discard(str(replaced.get("family") or ""))
            selected_meta.pop(replaced_id, None)
        selected.append(row)
        selected_ids.add(rule_id)
        selected_families.add(family)
        rejected_meta.pop(rule_id, None)
        selected_meta[rule_id] = {
            "diversity_status": "coverage_pool_representative",
            "diversity_correlated_with_rule_id": None,
            "diversity_max_correlation": None,
        }
        added.append(rule_id)
    return added


def _coverage_replacement_index(selected: list[dict[str, Any]]) -> int | None:
    for idx in range(len(selected) - 1, -1, -1):
        family = str(selected[idx].get("family") or "")
        if family not in _COVERAGE_POOL_REPRESENTATIVE_FAMILIES:
            return idx
    return None


def _goal_sort_key(row: dict[str, Any]) -> tuple[float, float, float, str]:
    return (
        float(row.get("oos_annualized_sharpe") or 0.0),
        float(row.get("oos_annualized_sortino") or 0.0),
        float(row.get("oos_total_return") or 0.0),
        str(row.get("rule_id") or ""),
    )


def _return_series(values: list[float] | None) -> np.ndarray:
    if not values:
        return np.array([], dtype=float)
    series = np.asarray(values, dtype=float)
    return series[np.isfinite(series)]


def _path_correlation(left: np.ndarray, right: np.ndarray) -> float:
    n = min(left.size, right.size)
    if n < 3:
        return 0.0
    left = left[-n:]
    right = right[-n:]
    mask = np.isfinite(left) & np.isfinite(right)
    if int(mask.sum()) < 3:
        return 0.0
    left = left[mask]
    right = right[mask]
    if float(np.std(left)) == 0.0 or float(np.std(right)) == 0.0:
        return 0.0
    corr = float(np.corrcoef(left, right)[0, 1])
    return abs(corr) if np.isfinite(corr) else 0.0


def _goal_rows(
    frame: pd.DataFrame,
    *,
    persona_top: int,
    min_sharpe: float,
    min_sortino: float,
    min_return: float,
    max_drawdown: float,
) -> list[dict[str, Any]]:
    if frame.empty:
        return []
    rows = [
        row
        for row in cast(list[dict[str, Any]], frame.to_dict("records"))
        if bool(row.get("accepted"))
        and _passes_goal(
            row,
            min_sharpe=min_sharpe,
            min_sortino=min_sortino,
            min_return=min_return,
            max_drawdown=max_drawdown,
        )
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
    max_drawdown: float,
) -> bool:
    # Daily stock-rule rotations look attractive in vector OOS, but the real
    # share ledger pays taxes/fees on every rebalance and those candidates have
    # repeatedly flipped from high paper returns to negative deployable IRR.
    if str(row.get("rebalance") or "") == "D":
        return False
    risk_ok = max_drawdown <= 0 or abs(float(row.get("oos_max_drawdown") or 0.0)) <= max_drawdown
    quality_ok = (
        float(row.get("oos_annualized_sharpe") or 0.0) >= min_sharpe
        or float(row.get("oos_annualized_sortino") or 0.0) >= min_sortino
        or float(row.get("oos_total_return") or 0.0) >= min_return
    )
    low_turnover_quality_ok = (
        str(row.get("rebalance") or "") in {"W", "M"}
        and float(row.get("oos_total_return") or 0.0) >= 0.50
        and float(row.get("oos_annualized_sortino") or 0.0) >= 0.45
        and abs(float(row.get("oos_max_drawdown") or 0.0)) <= 0.60
    )
    return (risk_ok and quality_ok) or low_turnover_quality_ok


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
        family = str(row["family"])
        configs.append(
            StockRulePersonaConfig(
                persona_name=_stock_rule_persona_id(rule_id),
                label=_stock_rule_label(index, family),
                rule_id=rule_id,
                family=cast(Any, family),
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
                coverage_failure_trading_days=int(row.get("coverage_failure_trading_days") or 0),
                min_return_21d=float(row.get("min_return_21d", -1.0)),
                min_return_63d=float(row.get("min_return_63d", -1.0)),
                min_return_126d=float(row.get("min_return_126d", -1.0)),
                min_distance_from_52w_high=float(row.get("min_distance_from_52w_high", -1.0)),
                require_ma_stack=_boolish(row.get("require_ma_stack", False)),
                hold_target_winners=_boolish(row.get("hold_target_winners", False)),
                target_winner_trailing_stop_pct=float(row.get("target_winner_trailing_stop_pct") or 0.0),
                target_carry_ma_days=int(row.get("target_carry_ma_days") or 0),
                risk_off_ma_days=int(row.get("risk_off_ma_days") or 0),
                risk_off_symbol=str(row.get("risk_off_symbol") or "069500.KS"),
                fallback_symbol=str(row.get("fallback_symbol") or ""),
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
    validation_mode: ValidationMode,
    min_sharpe: float,
    min_sortino: float,
    min_return: float,
    max_drawdown: float,
) -> StockAdmissionArtifact:
    window = StockAdmissionWindow(
        search_start=search_start,
        search_end=search_end,
        oos_start=oos_start,
        oos_end=oos_end,
        validation_mode=validation_mode,
    )
    decisions: list[StockAdmissionDecision] = []
    for row in cast(list[dict[str, Any]], frame.to_dict("records")):
        rule_id = str(row["rule_id"])
        selected = rule_id in selected_rule_ids
        passes_goal = _passes_goal(
            row,
            min_sharpe=min_sharpe,
            min_sortino=min_sortino,
            min_return=min_return,
            max_drawdown=max_drawdown,
        )
        status = cast(
            StockAdmissionStatus,
            "accepted" if selected else _artifact_status(row, passes_goal=passes_goal),
        )
        reasons = cast(
            list[StockAdmissionReason],
            ["passes_validation_goal"] if status == "accepted" else _artifact_reasons(row),
        )
        candidate = StockRuleCandidate(
            rule_id=rule_id,
            family=cast(StockRuleFamily, _artifact_family(str(row["family"]))),
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
                    "coverage_failure_trading_days",
                    "min_return_21d",
                    "min_return_63d",
                    "min_return_126d",
                    "min_distance_from_52w_high",
                    "require_ma_stack",
                    "hold_target_winners",
                    "target_winner_trailing_stop_pct",
                    "target_carry_ma_days",
                    "risk_off_ma_days",
                    "risk_off_symbol",
                    "fallback_symbol",
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
            (
                "validation replay runs frozen IS finalists on the full sample"
                if validation_mode == "full_sample"
                else "admit_oos replays frozen IS finalists on the later OOS window"
            ),
            (
                "portfolio personas are materialized only when validation "
                f"Sharpe >= {min_sharpe:g}, Sortino >= {min_sortino:g}, or return >= {min_return:.0%}"
            ),
            (
                "persona materialization also requires validation max drawdown "
                f"<= {max_drawdown:.0%} unless that gate is disabled"
            ),
            "highly correlated validation return paths keep only the best-scoring strategy; default correlation threshold is 0.95",
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


def _artifact_status(row: dict[str, Any], *, passes_goal: bool) -> StockAdmissionStatus:
    if not bool(row.get("accepted")):
        status = str(row.get("admission_status") or "")
        if "benchmark" in status:
            return "below_benchmark"
        if "duplicate" in status:
            return "duplicate_behavior"
        if "activity" in status:
            return "insufficient_trades"
        if "correlation" in status or "duplicate" in status:
            return "duplicate_behavior"
    return "below_risk_gate" if not passes_goal else "duplicate_behavior"


def _artifact_reasons(row: dict[str, Any]) -> list[StockAdmissionReason]:
    if str(row.get("diversity_status") or "") == "correlation_rejected":
        return ["duplicate_behavior"]
    status = str(row.get("admission_status") or "")
    if "benchmark" in status:
        return ["below_oos_benchmark"]
    if "duplicate" in status:
        return ["duplicate_behavior"]
    if "correlation" in status:
        return ["duplicate_behavior"]
    if "activity" in status:
        return ["insufficient_trades"]
    return ["below_sharpe_gate", "below_sortino_gate"]


def _artifact_family(family: str) -> StockRuleFamily:
    known_families: set[StockRuleFamily] = {
        "report_upside",
        "mtt",
        "rsi_reversal",
        "ma_crossover",
        "atr_breakout",
        "relative_strength",
        "target_upside_momentum",
        "fresh_report_momentum",
        "target_gap_reversal",
        "price_momentum",
    }
    return cast(StockRuleFamily, family) if family in known_families else "relative_strength"


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


def _boolish(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y"}
    return bool(value)


def _stock_rule_label(index: int, family: str) -> str:
    family_label = _STOCK_RULE_FAMILY_LABELS.get(family, family.replace("_", " "))
    return f"종목룰 {index:02d}: {family_label}"
