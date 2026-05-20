"""Structural strategy-generation pipeline for approved portfolio personas.

The pipeline has one approval source of truth: a generated strategy is not
promoted unless the *final portfolio simulation ledger* beats the strongest
non-oracle benchmark and survives a high-correlation compression gate.  Search
replay metrics are only a cheap candidate generator.
"""

from __future__ import annotations

import importlib.util
import json
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .broker_strategy_search import find_top_broker_strategy_configs
from .contracts import PersonaConfig, SimulationConfig, SimulationResult, StockRulePersonaConfig
from .runner import run_simulation
from .stock_rule_search import admit_oos, default_stock_rule_configs, search_is
from .visualize import plot_drawdowns, plot_equity_curves, plot_net_profit_bars, plot_portfolio_composition

ROUND_NDIGITS = 4
BENCHMARK_PERSONAS = {"all_weather", "benchmark_qqq", "benchmark_spy", "benchmark_kodex200", "benchmark_gld"}
ORACLE_PERSONAS = {"weak_oracle", "oracle"}


@dataclass(frozen=True)
class StrategyGenerationConfig:
    warehouse_dir: Path
    out_dir: Path
    start_date: date
    end_date: date
    is_start: date = date(2021, 1, 4)
    is_end: date = date(2022, 12, 31)
    max_stock_configs: int = 0
    is_top: int = 75
    admit_top: int = 0
    stock_persona_top: int = 10
    max_correlation: float = 0.90
    goal_min_sharpe: float = 1.5
    goal_min_sortino: float = 1.5
    goal_min_return: float = 5.0
    broker_strategy_trials: int = 120
    broker_strategy_top: int = 3
    broker_strategy_seed: int = 42
    broker_strategy_train_start: date = date(2021, 1, 1)
    broker_strategy_train_end: date = date(2023, 12, 31)
    refresh_benchmark: bool = False


@dataclass(frozen=True)
class GenerationResult:
    benchmark_persona: str
    benchmark_money_weighted_return: float
    stock_promoted: tuple[str, ...]
    broker_promoted: tuple[str, ...]
    rejected_by_portfolio_benchmark: tuple[str, ...]
    rejected_by_correlation: tuple[str, ...]


def run_strategy_generation(config: StrategyGenerationConfig) -> GenerationResult:
    """Generate, gate, write, and simulate approved strategy personas."""
    config.out_dir.mkdir(parents=True, exist_ok=True)
    base_config = SimulationConfig(start_date=config.start_date, end_date=config.end_date)
    baseline = run_simulation(base_config, config.warehouse_dir, refresh_benchmark=config.refresh_benchmark)
    benchmark = best_benchmark_summary(baseline)

    stock_candidates, stock_trials = generate_stock_rule_candidates(config, benchmark.money_weighted_return)
    stock_promoted, stock_gate = portfolio_gate(
        config=config,
        base_personas=base_config.personas,
        candidates=stock_candidates,
        benchmark_persona=benchmark.persona,
        benchmark_money_weighted_return=benchmark.money_weighted_return,
        max_correlation=config.max_correlation,
    )
    stock_trials = annotate_stock_trial_gate(stock_trials, stock_gate)
    write_stock_outputs(config, stock_promoted, stock_trials, benchmark.money_weighted_return)

    broker_search = find_top_broker_strategy_configs(
        warehouse_dir=config.warehouse_dir,
        start_date=config.start_date,
        end_date=config.end_date,
        train_start=config.broker_strategy_train_start,
        train_end=config.broker_strategy_train_end,
        plan=base_config.savings_plan,
        fees=base_config.fees,
        benchmark_money_weighted_return=benchmark.money_weighted_return,
        trials=config.broker_strategy_trials,
        top_n=config.broker_strategy_top,
        seed=config.broker_strategy_seed,
    )
    _to_csv_rounded(broker_search.trial_rows, config.out_dir / "broker_strategy_trials.csv")

    final_personas: tuple[PersonaConfig, ...] = (
        *base_config.personas,
        *broker_search.configs,
        *stock_promoted,
    )
    final_config = base_config.model_copy(update={"personas": final_personas})
    final_result = run_simulation(
        final_config, config.warehouse_dir, refresh_benchmark=config.refresh_benchmark
    )
    write_simulation_artifacts(final_result, config.out_dir)

    summary = {
        "schema_version": "1.0.0",
        "generated_at": datetime.now(UTC).isoformat(),
        "approval_source_of_truth": "final_portfolio_simulation",
        "benchmark_persona": benchmark.persona,
        "benchmark_money_weighted_return": benchmark.money_weighted_return,
        "stock_promoted": [p.persona_name for p in stock_promoted],
        "broker_promoted": [p.persona_name for p in broker_search.configs],
        "rejected_by_portfolio_benchmark": sorted(stock_gate.rejected_by_benchmark),
        "rejected_by_correlation": sorted(stock_gate.rejected_by_correlation),
        "mtt_note": (
            "SMIC MTT did not disappear because of known future-reference. It is generated by the broker-ledger "
            "strategy stage; previous ad-hoc runs hid it when --disable-broker-strategy-search was used. "
            "Promotion still requires beating the strongest benchmark in the final ledger."
        ),
    }
    (config.out_dir / "strategy-generation-summary.json").write_text(
        json.dumps(_json_safe(summary), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return GenerationResult(
        benchmark_persona=benchmark.persona,
        benchmark_money_weighted_return=benchmark.money_weighted_return,
        stock_promoted=tuple(p.persona_name for p in stock_promoted),
        broker_promoted=tuple(p.persona_name for p in broker_search.configs),
        rejected_by_portfolio_benchmark=tuple(sorted(stock_gate.rejected_by_benchmark)),
        rejected_by_correlation=tuple(sorted(stock_gate.rejected_by_correlation)),
    )


def _load_stock_rule_script():
    script_path = Path(__file__).resolve().parents[3] / "scripts" / "run_stock_rule_search.py"
    spec = importlib.util.spec_from_file_location("_snusmic_run_stock_rule_search", script_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load stock-rule artifact helpers from {script_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def best_benchmark_summary(result: SimulationResult):
    candidates = [s for s in result.summaries if s.persona in BENCHMARK_PERSONAS]
    if not candidates:
        raise RuntimeError("No non-oracle benchmark summaries are available for strategy approval.")
    return max(candidates, key=lambda item: item.money_weighted_return)


def generate_stock_rule_candidates(
    config: StrategyGenerationConfig,
    benchmark_money_weighted_return: float,
) -> tuple[tuple[StockRulePersonaConfig, ...], pd.DataFrame]:
    # Import script helpers only for artifact compatibility while the search
    # primitives stay in snusmic_pipeline.sim.  This keeps the new pipeline as
    # the orchestration surface without duplicating the public stock-admission
    # JSON contract in this patch.
    stock_script = _load_stock_rule_script()
    _apply_diversity_gate = stock_script._apply_diversity_gate
    _stock_persona_configs = stock_script._stock_persona_configs

    configs = default_stock_rule_configs()
    if config.max_stock_configs > 0:
        configs = configs[: config.max_stock_configs]
    is_result = search_is(
        warehouse_dir=config.warehouse_dir,
        start_date=config.is_start,
        end_date=config.is_end,
        configs=configs,
        top_n=config.is_top,
    )
    admitted = admit_oos(
        warehouse_dir=config.warehouse_dir,
        configs=is_result,
        is_start=config.is_start,
        is_end=config.is_end,
        oos_start=config.start_date,
        oos_end=config.end_date,
        benchmark_total_return=benchmark_money_weighted_return,
        top_n=config.admit_top,
    )
    trials, goal_rows, _ = _apply_diversity_gate(
        admitted.trial_rows,
        returns_by_rule_id=admitted.trial_rows.attrs.get("oos_daily_returns", {}),
        persona_top=config.stock_persona_top,
        min_sharpe=config.goal_min_sharpe,
        min_sortino=config.goal_min_sortino,
        min_return=config.goal_min_return,
        max_correlation=config.max_correlation,
    )
    personas = tuple(
        _stock_persona_configs(
            goal_rows,
            search_start=config.is_start,
            search_end=config.is_end,
            oos_start=config.start_date,
            oos_end=config.end_date,
        )
    )
    _write_rows(is_result.trial_rows, config.out_dir / "is-search.csv", config.out_dir / "is-search.json")
    return personas, trials


@dataclass(frozen=True)
class PortfolioGateResult:
    accepted_rule_ids: frozenset[str]
    rejected_by_benchmark: frozenset[str]
    rejected_by_correlation: frozenset[str]
    correlation_peer: dict[str, str]
    metrics_by_rule_id: dict[str, dict[str, Any]]


def portfolio_gate(
    *,
    config: StrategyGenerationConfig,
    base_personas: tuple[PersonaConfig, ...],
    candidates: tuple[StockRulePersonaConfig, ...],
    benchmark_persona: str,
    benchmark_money_weighted_return: float,
    max_correlation: float,
) -> tuple[tuple[StockRulePersonaConfig, ...], PortfolioGateResult]:
    if not candidates:
        return (), PortfolioGateResult(frozenset(), frozenset(), frozenset(), {}, {})
    sim_config = SimulationConfig(
        start_date=config.start_date,
        end_date=config.end_date,
        personas=(*base_personas, *candidates),
    )
    result = run_simulation(sim_config, config.warehouse_dir, refresh_benchmark=config.refresh_benchmark)
    summaries = {summary.persona: summary for summary in result.summaries}
    benchmark_rejected: set[str] = set()
    benchmark_passed: list[StockRulePersonaConfig] = []
    metrics_by_rule_id: dict[str, dict[str, Any]] = {}
    for candidate in candidates:
        summary = summaries.get(candidate.persona_name)
        if summary is None:
            benchmark_rejected.add(candidate.rule_id)
            continue
        metrics_by_rule_id[candidate.rule_id] = {
            "portfolio_money_weighted_return": summary.money_weighted_return,
            "portfolio_excess_vs_benchmark": summary.money_weighted_return - benchmark_money_weighted_return,
            "portfolio_sharpe": summary.sharpe,
            "portfolio_sortino": summary.sortino,
            "portfolio_max_drawdown": summary.max_drawdown,
            "portfolio_trade_count": summary.trade_count,
        }
        if summary.money_weighted_return > benchmark_money_weighted_return:
            benchmark_passed.append(candidate)
        else:
            benchmark_rejected.add(candidate.rule_id)

    returns = equity_return_series(result, [candidate.persona_name for candidate in benchmark_passed])
    ranked = sorted(
        benchmark_passed,
        key=lambda candidate: (
            metrics_by_rule_id.get(candidate.rule_id, {}).get("portfolio_money_weighted_return") or -1e9,
            metrics_by_rule_id.get(candidate.rule_id, {}).get("portfolio_sharpe") or -1e9,
            candidate.rule_id,
        ),
        reverse=True,
    )
    selected: list[StockRulePersonaConfig] = []
    selected_series: list[tuple[str, np.ndarray]] = []
    corr_rejected: set[str] = set()
    corr_peer: dict[str, str] = {}
    for candidate in ranked:
        series = returns.get(candidate.persona_name, np.array([], dtype=float))
        peer = None
        peer_corr = 0.0
        if max_correlation > 0 and series.size:
            for selected_rule_id, selected_returns in selected_series:
                corr = _path_correlation(series, selected_returns)
                if corr > peer_corr:
                    peer_corr = corr
                    peer = selected_rule_id
        if peer is not None and peer_corr >= max_correlation:
            corr_rejected.add(candidate.rule_id)
            corr_peer[candidate.rule_id] = peer
            metrics_by_rule_id.setdefault(candidate.rule_id, {})["portfolio_max_correlation"] = peer_corr
            continue
        selected.append(candidate)
        if series.size:
            selected_series.append((candidate.rule_id, series))
    return tuple(selected), PortfolioGateResult(
        accepted_rule_ids=frozenset(candidate.rule_id for candidate in selected),
        rejected_by_benchmark=frozenset(benchmark_rejected),
        rejected_by_correlation=frozenset(corr_rejected),
        correlation_peer=corr_peer,
        metrics_by_rule_id=metrics_by_rule_id,
    )


def annotate_stock_trial_gate(frame: pd.DataFrame, gate: PortfolioGateResult) -> pd.DataFrame:
    if frame.empty or "rule_id" not in frame.columns:
        return frame
    updated = frame.copy()
    accepted: list[bool] = []
    statuses: list[str] = []
    peers: list[str | None] = []
    for row in updated.to_dict("records"):
        rule_id = str(row.get("rule_id") or "")
        if rule_id in gate.accepted_rule_ids:
            accepted.append(True)
            statuses.append("accepted")
        elif rule_id in gate.rejected_by_correlation:
            accepted.append(False)
            statuses.append("portfolio_correlation_rejected")
        elif rule_id in gate.rejected_by_benchmark:
            accepted.append(False)
            statuses.append("below_portfolio_benchmark")
        else:
            accepted.append(False)
            statuses.append(str(row.get("admission_status") or "not_selected"))
        peers.append(gate.correlation_peer.get(rule_id))
    updated["accepted"] = accepted
    updated["portfolio_admission_status"] = statuses
    updated["admission_status"] = statuses
    updated["portfolio_correlated_with_rule_id"] = peers
    for key in (
        "portfolio_money_weighted_return",
        "portfolio_excess_vs_benchmark",
        "portfolio_sharpe",
        "portfolio_sortino",
        "portfolio_max_drawdown",
        "portfolio_trade_count",
        "portfolio_max_correlation",
    ):
        updated[key] = [
            gate.metrics_by_rule_id.get(str(rule_id), {}).get(key) for rule_id in updated["rule_id"]
        ]
    return updated


def write_stock_outputs(
    config: StrategyGenerationConfig,
    stock_promoted: tuple[StockRulePersonaConfig, ...],
    stock_trials: pd.DataFrame,
    benchmark_money_weighted_return: float,
) -> None:
    _stock_admission_artifact = _load_stock_rule_script()._stock_admission_artifact

    _write_rows(
        stock_trials,
        config.out_dir / "validation-admission.csv",
        config.out_dir / "validation-admission.json",
    )
    _write_rows(stock_trials, config.out_dir / "oos-admission.csv", config.out_dir / "oos-admission.json")
    (config.out_dir / "stock-rule-personas.json").write_text(
        json.dumps(
            [_json_safe(p.model_dump(mode="json")) for p in stock_promoted], ensure_ascii=False, indent=2
        )
        + "\n",
        encoding="utf-8",
    )
    artifact = _stock_admission_artifact(
        stock_trials,
        selected_rule_ids={p.rule_id for p in stock_promoted},
        search_start=config.is_start,
        search_end=config.is_end,
        oos_start=config.start_date,
        oos_end=config.end_date,
        validation_mode="full_sample",
        benchmark_total_return=benchmark_money_weighted_return,
        min_oos_excess_return=0.0,
        min_sharpe=config.goal_min_sharpe,
        min_sortino=config.goal_min_sortino,
        min_return=config.goal_min_return,
    )
    (config.out_dir / "stock-admission.json").write_text(
        json.dumps(_json_safe(artifact.model_dump(mode="json")), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def equity_return_series(result: SimulationResult, personas: Iterable[str]) -> dict[str, np.ndarray]:
    wanted = set(personas)
    frame = pd.DataFrame([p.model_dump(mode="json") for p in result.equity_points if p.persona in wanted])
    if frame.empty:
        return {}
    pivot = frame.pivot_table(
        index="date", columns="persona", values="equity_krw", aggfunc="last"
    ).sort_index()
    returns = pivot.pct_change(fill_method=None).replace([np.inf, -np.inf], np.nan)
    out: dict[str, np.ndarray] = {}
    for persona in wanted:
        if persona in returns:
            series = returns[persona].dropna().to_numpy(float)
            out[persona] = series[np.isfinite(series)]
    return out


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


def write_simulation_artifacts(result: SimulationResult, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    (out / "personas.json").write_text(
        json.dumps(_round_floats(result.model_dump(mode="json")), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (out / "persona-configs.json").write_text(
        json.dumps(_persona_config_artifact(result.config), ensure_ascii=False, indent=2, sort_keys=True)
        + "\n",
        encoding="utf-8",
    )
    _to_csv_rounded(pd.DataFrame([s.model_dump() for s in result.summaries]), out / "summary.csv")
    _to_csv_rounded(pd.DataFrame([p.model_dump() for p in result.equity_points]), out / "equity_daily.csv")
    _to_csv_rounded(pd.DataFrame([t.model_dump() for t in result.trades]), out / "trades.csv")
    _to_csv_rounded(
        pd.DataFrame([e.model_dump() for e in result.position_episodes]), out / "position_episodes.csv"
    )
    _to_csv_rounded(
        pd.DataFrame([h.model_dump() for h in result.current_holdings]), out / "current_holdings.csv"
    )
    _to_csv_rounded(pd.DataFrame([s.model_dump() for s in result.symbol_stats]), out / "symbol_stats.csv")
    _to_csv_rounded(
        pd.DataFrame([m.model_dump() for m in result.monthly_holdings]), out / "monthly_holdings.csv"
    )
    _to_csv_rounded(
        pd.DataFrame([p.model_dump() for p in result.report_performance]), out / "report_performance.csv"
    )
    if result.report_stats is not None:
        (out / "report_stats.json").write_text(
            json.dumps(
                _round_floats(result.report_stats.model_dump(mode="json")), ensure_ascii=False, indent=2
            ),
            encoding="utf-8",
        )
    plot_equity_curves(result, out / "equity_curves.png")
    plot_net_profit_bars(result, out / "net_profit_bar.png")
    plot_drawdowns(result, out / "drawdowns.png")
    if result.monthly_holdings:
        plot_portfolio_composition(result, out / "portfolio_composition.png")


def _persona_config_artifact(config: SimulationConfig) -> dict[str, object]:
    return {
        "schema_version": "1.0.0",
        "personas": [_round_floats(persona.model_dump(mode="json")) for persona in config.personas],
    }


def _to_csv_rounded(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if df.empty:
        df.to_csv(path, index=False)
        return
    rounded = df.copy()
    for col in rounded.select_dtypes(include="float").columns:
        rounded[col] = rounded[col].round(ROUND_NDIGITS)
    rounded.to_csv(path, index=False)


def _write_rows(frame: pd.DataFrame, csv_path: Path, json_path: Path) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(csv_path, index=False)
    json_path.write_text(
        json.dumps([_json_safe(row) for row in frame.to_dict("records")], ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )


def _round_floats(value: Any) -> Any:
    if isinstance(value, float):
        return round(value, ROUND_NDIGITS)
    if isinstance(value, dict):
        return {k: _round_floats(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_round_floats(v) for v in value]
    if isinstance(value, tuple):
        return tuple(_round_floats(v) for v in value)
    return value


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
