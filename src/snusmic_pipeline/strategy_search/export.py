"""Export local strategy-search outputs as web artifacts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

import pandas as pd

from snusmic_pipeline.web_artifacts import write_web_manifest


def export_strategy_artifacts(
    trials_csv: Path, out_dir: Path, *, study_name: str = "smic-follower-v1", top_n: int = 20
) -> dict[str, Path]:
    """Write strategy-runs, trial rows, and simple parameter importance JSON."""
    if not trials_csv.exists():
        raise FileNotFoundError(f"Missing trials CSV: {trials_csv}")
    out_dir.mkdir(parents=True, exist_ok=True)
    trials = pd.read_csv(trials_csv)
    if trials.empty:
        raise ValueError(f"No trials found in {trials_csv}")
    trials = trials.sort_values("score", ascending=False).reset_index(drop=True)
    best = trials.iloc[0].to_dict()
    scope = str(best.get("scope", "unknown"))
    strategy_runs = {
        "schema_version": 1,
        "study_name": study_name,
        "scope": scope,
        "disclaimer": "Local-only research artifact. Strategy search is generated offline and is not run by the web app.",
        "best_run_id": _run_id(study_name, int(best["trial_number"])),
        "runs": [
            _strategy_run(study_name, cast(dict[str, Any], row))
            for row in trials.head(top_n).to_dict("records")
        ],
    }
    importance = {
        "schema_version": 1,
        "study_name": study_name,
        "method": "absolute Pearson correlation with objective score over exported trials",
        "parameters": _parameter_importance(trials),
    }
    paths = {
        "strategy_runs": out_dir / "strategy-runs.json",
        "optuna_trials": out_dir / "optuna-trials.json",
        "parameter_importance": out_dir / "parameter-importance.json",
    }
    _write_json(paths["strategy_runs"], strategy_runs)
    _write_json(
        paths["optuna_trials"],
        {
            "schema_version": 1,
            "study_name": study_name,
            "trials": [_json_safe(row) for row in trials.to_dict("records")],
        },
    )
    _write_json(paths["parameter_importance"], importance)
    if (out_dir / "overview.json").exists():
        write_web_manifest(out_dir)
    return paths


def _strategy_run(study_name: str, row: dict[str, Any]) -> dict[str, Any]:
    params = {key: _param_json_safe(row[key]) for key in _PARAMETER_COLUMNS if key in row}
    metrics = {key: _json_safe(row[key]) for key in _METRIC_COLUMNS if key in row}
    return {
        "run_id": _run_id(study_name, int(row["trial_number"])),
        "trial_number": int(row["trial_number"]),
        "label": f"{study_name} trial {int(row['trial_number'])}",
        "scope": str(row.get("scope", "in-sample")),
        "sampler": str(row.get("sampler", "unknown")),
        "params": params,
        "metrics": metrics,
        "warnings": _warnings(metrics),
    }


def _warnings(metrics: dict[str, Any]) -> list[str]:
    warnings = ["train-selected research result; validate against live forward data before trusting"]
    mdd = metrics.get("max_drawdown")
    max_weight = metrics.get("max_single_position_weight")
    if isinstance(mdd, (int, float)) and mdd > 0.35:
        warnings.append("high max drawdown")
    if isinstance(max_weight, (int, float)) and max_weight > 0.30:
        warnings.append("concentrated position sizing")
    return warnings


def _parameter_importance(trials: pd.DataFrame) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    score = pd.to_numeric(trials["score"], errors="coerce")
    for column in _PARAMETER_COLUMNS:
        if column not in trials.columns:
            continue
        series = trials[column]
        encoded = (
            series.astype("category").cat.codes
            if series.dtype == object
            else pd.to_numeric(series, errors="coerce")
        )
        corr = encoded.corr(score) if encoded.nunique(dropna=True) > 1 else 0.0
        out.append({"parameter": column, "importance": 0.0 if pd.isna(corr) else abs(float(corr))})
    return sorted(out, key=lambda item: item["importance"], reverse=True)


def _run_id(study_name: str, trial_number: int) -> str:
    return f"{study_name.replace('_', '-').replace(' ', '-')}-trial-{trial_number}"


def _write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _json_safe(value: Any) -> Any:
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    return value


def _param_json_safe(value: Any) -> Any:
    safe = _json_safe(value)
    if isinstance(safe, float):
        return round(safe, 2)
    return safe


_PARAMETER_COLUMNS = [
    "target_hit_multiplier",
    "min_target_upside_at_pub",
    "max_target_upside_at_pub",
    "max_report_age_days",
    "time_loss_days",
    "stop_loss_pct",
    "take_profit_pct",
    "rebalance",
    "max_positions",
    "weighting",
    "universe",
    "exclude_missing_confidence_rows",
    "require_publication_price",
    "require_mtt",
    "min_price_vs_52w_low",
    "max_pct_below_52w_high",
    "min_ma200_1m_return",
]
_METRIC_COLUMNS = [
    "score",
    "final_equity_krw",
    "net_profit_krw",
    "money_weighted_return",
    "cagr",
    "max_drawdown",
    "trade_count",
    "turnover",
    "average_holding_days",
    "win_rate",
    "hit_rate",
    "max_single_position_weight",
    "open_positions",
    "excess_return_vs_smic_follower",
    "excess_return_vs_smic_follower_v2",
    "excess_return_vs_all_weather",
    "robust_score",
    "selection_rank",
    "candidate_pool_size",
    "selected_candidate_count",
    "train_score",
    "train_money_weighted_return",
    "train_max_drawdown",
    "train_trade_count",
    "train_turnover",
    "full_score",
    "full_money_weighted_return",
    "full_max_drawdown",
    "full_trade_count",
    "full_turnover",
    "holdout_score",
    "holdout_money_weighted_return",
    "holdout_max_drawdown",
    "holdout_trade_count",
    "holdout_turnover",
    "score_decay",
    "return_decay",
    "train_to_holdout_score_decay",
    "train_to_holdout_return_decay",
]
