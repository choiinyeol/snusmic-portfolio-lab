"""Persona simulation command implementation.

Run from the package CLI::

    uv run python -m snusmic_pipeline run-sim \
        --start 2021-01-04 --end 2026-05-11 \
        --warehouse data/warehouse \
        --out data/sim

Produces ``personas.json``, ``persona-configs.json``, ``equity_daily.csv``,
``trades.csv``, ``summary.csv``, ``equity_curves.png``,
``net_profit_bar.png``, and ``drawdowns.png``.
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import date
from pathlib import Path

import pandas as pd

from snusmic_pipeline.sim.broker_strategy_search import find_top_broker_strategy_configs
from snusmic_pipeline.sim.contracts import (
    PitResearchBoardConfig,
    SimulationConfig,
    SmicMttStrategyConfig,
    StockRulePersonaConfig,
)
from snusmic_pipeline.sim.decision_ledger import build_daily_decision_ledger
from snusmic_pipeline.sim.pit_research_board import default_pit_research_board_configs
from snusmic_pipeline.sim.runner import run_simulation
from snusmic_pipeline.sim.visualize import (
    plot_drawdowns,
    plot_equity_curves,
    plot_net_profit_bars,
    plot_portfolio_composition,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
ROUND_NDIGITS = 4
EXPERIMENTAL_PIT_ALPHA_PREFIX = "pit_research_board_alpha_"


def _to_csv_rounded(df: pd.DataFrame, path: Path) -> None:
    """Write ``df`` to ``path`` with every float column rounded to ROUND_NDIGITS.

    Keeps integer columns intact. Writes regardless of whether ``df`` is empty -
    callers always want the file to exist with at least a header.
    """
    if df.empty:
        df.to_csv(path, index=False)
        return
    rounded = df.copy()
    for col in rounded.select_dtypes(include="float").columns:
        rounded[col] = rounded[col].round(ROUND_NDIGITS)
    rounded.to_csv(path, index=False)


def _round_floats(value):
    """Recursively round floats in a JSON-serialisable structure."""
    if isinstance(value, float):
        return round(value, ROUND_NDIGITS)
    if isinstance(value, dict):
        return {k: _round_floats(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_round_floats(v) for v in value]
    if isinstance(value, tuple):
        return tuple(_round_floats(v) for v in value)
    return value


def _persona_config_artifact(config: SimulationConfig) -> dict[str, object]:
    """Return the compact strategy-method contract needed by web export.

    ``personas.json`` is a full simulation dump and is intentionally ignored by
    git because it is large and mostly ledger state. The web strategy catalog
    only needs the declared persona configurations, so this separate artifact is
    the small, reviewable boundary between simulation and product UI.
    """

    return {
        "schema_version": "1.0.0",
        "personas": [_round_floats(persona.model_dump(mode="json")) for persona in config.personas],
    }


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=str, default="2021-01-04")
    parser.add_argument("--end", type=str, default=date.today().isoformat())
    parser.add_argument("--warehouse", type=Path, default=REPO_ROOT / "data" / "warehouse")
    parser.add_argument("--out", type=Path, default=REPO_ROOT / "data" / "sim")
    parser.add_argument(
        "--refresh-benchmark",
        action="store_true",
        help="Force re-download of the All-Weather benchmark prices.",
    )
    parser.add_argument(
        "--disable-broker-strategy-search",
        action="store_true",
        help="Skip Optuna broker-ledger strategy promotion.",
    )
    parser.add_argument(
        "--broker-strategy-trials",
        type=int,
        default=int(os.environ.get("SMIC_BROKER_STRATEGY_TRIALS", "400")),
    )
    parser.add_argument(
        "--broker-strategy-top",
        type=int,
        default=int(os.environ.get("SMIC_BROKER_STRATEGY_TOP", "0")),
        help="Maximum number of broker-ledger strategies to promote after risk/diversity gates. Use 0 for every qualifying strategy.",
    )
    parser.add_argument(
        "--broker-strategy-seed",
        type=int,
        default=int(os.environ.get("SMIC_BROKER_STRATEGY_SEED", "42")),
    )
    parser.add_argument(
        "--broker-strategy-personas",
        type=Path,
        default=None,
        help=(
            "Optional JSON artifact containing SmicMttStrategyConfig rows to include "
            "instead of rerunning Optuna broker-ledger search. Accepts a plain list or "
            "persona-configs.json."
        ),
    )
    parser.add_argument(
        "--broker-strategy-train-start",
        type=str,
        default=os.environ.get("SMIC_BROKER_STRATEGY_TRAIN_START", "2021-01-01"),
    )
    parser.add_argument(
        "--broker-strategy-train-end",
        type=str,
        default=os.environ.get("SMIC_BROKER_STRATEGY_TRAIN_END", "2023-12-31"),
    )
    parser.add_argument(
        "--stock-rule-personas",
        type=Path,
        default=None,
        help="Optional JSON list of OOS-admitted StockRulePersonaConfig rows to include.",
    )
    parser.add_argument(
        "--pit-research-board-personas",
        type=Path,
        default=None,
        help="Optional JSON list of admitted PIT research-board persona configs to include.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)
    config = SimulationConfig(
        start_date=date.fromisoformat(args.start),
        end_date=date.fromisoformat(args.end),
    )
    if args.broker_strategy_personas is not None:
        broker_strategy_configs = _load_broker_strategy_personas(args.broker_strategy_personas)
        if broker_strategy_configs:
            config = config.model_copy(update={"personas": (*config.personas, *broker_strategy_configs)})
    elif not args.disable_broker_strategy_search:
        print(
            "Searching broker-ledger SMIC MTT strategies with Optuna "
            f"({args.broker_strategy_trials} evaluations, promotion limit {args.broker_strategy_top})"
        )
        baseline_result = run_simulation(
            config,
            args.warehouse,
            refresh_benchmark=args.refresh_benchmark,
        )
        tradable_benchmarks = [
            summary for summary in baseline_result.summaries if summary.persona != "weak_oracle"
        ]
        if not tradable_benchmarks:
            raise RuntimeError("No tradable benchmark summaries available for broker strategy admission.")
        benchmark = max(tradable_benchmarks, key=lambda summary: summary.money_weighted_return)
        print(
            "  admission benchmark: "
            f"{benchmark.label} ({benchmark.money_weighted_return:.2%}); Weak Prophet is oracle-only."
        )
        search = find_top_broker_strategy_configs(
            warehouse_dir=args.warehouse,
            start_date=config.start_date,
            end_date=config.end_date,
            train_start=date.fromisoformat(args.broker_strategy_train_start),
            train_end=date.fromisoformat(args.broker_strategy_train_end),
            plan=config.savings_plan,
            fees=config.fees,
            benchmark_money_weighted_return=benchmark.money_weighted_return,
            trials=args.broker_strategy_trials,
            top_n=args.broker_strategy_top,
            seed=args.broker_strategy_seed,
        )
        _to_csv_rounded(search.trial_rows, out / "broker_strategy_trials.csv")
        if len(search.configs) < args.broker_strategy_top:
            print(
                "Promoted "
                f"{len(search.configs)}/{args.broker_strategy_top} broker-ledger strategies; "
                "non-qualifying candidate rows are intentionally not exported."
            )
        config = config.model_copy(update={"personas": (*config.personas, *search.configs)})
    else:
        (out / "broker_strategy_trials.csv").unlink(missing_ok=True)

    stock_rule_path = args.stock_rule_personas or (out / "stock-rule-personas.json")
    if stock_rule_path.exists():
        stock_rule_configs = _load_stock_rule_personas(stock_rule_path)
        if stock_rule_configs:
            config = config.model_copy(update={"personas": (*config.personas, *stock_rule_configs)})

    pit_rule_path = args.pit_research_board_personas or (out / "pit-research-board-personas.json")
    if pit_rule_path.exists():
        pit_rule_configs = _load_pit_research_board_personas(pit_rule_path)
        if pit_rule_configs:
            config = config.model_copy(update={"personas": (*config.personas, *pit_rule_configs)})

    print(f"Running simulation {config.start_date} → {config.end_date}")
    print(f"  warehouse: {args.warehouse}")
    print(f"  personas : {[p.persona_name for p in config.personas]}")

    result = run_simulation(config, args.warehouse, refresh_benchmark=args.refresh_benchmark)

    (out / "personas.json").write_text(
        json.dumps(_round_floats(result.model_dump(mode="json")), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (out / "persona-configs.json").write_text(
        json.dumps(_persona_config_artifact(config), ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    _to_csv_rounded(pd.DataFrame([s.model_dump() for s in result.summaries]), out / "summary.csv")
    _to_csv_rounded(pd.DataFrame([p.model_dump() for p in result.equity_points]), out / "equity_daily.csv")
    _to_csv_rounded(pd.DataFrame([t.model_dump() for t in result.trades]), out / "trades.csv")
    _to_csv_rounded(build_daily_decision_ledger(result), out / "daily_decisions.csv")
    _to_csv_rounded(
        pd.DataFrame([e.model_dump() for e in result.position_episodes]),
        out / "position_episodes.csv",
    )
    _to_csv_rounded(
        pd.DataFrame([h.model_dump() for h in result.current_holdings]),
        out / "current_holdings.csv",
    )
    _to_csv_rounded(pd.DataFrame([s.model_dump() for s in result.symbol_stats]), out / "symbol_stats.csv")
    _to_csv_rounded(
        pd.DataFrame([m.model_dump() for m in result.monthly_holdings]),
        out / "monthly_holdings.csv",
    )
    _to_csv_rounded(
        pd.DataFrame([p.model_dump() for p in result.report_performance]),
        out / "report_performance.csv",
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

    print("\n=== Final results ===")
    rows = sorted(result.summaries, key=lambda s: -s.net_profit_krw)
    for summary in rows:
        print(
            f"  {summary.label:<32s} "
            f"final={summary.final_equity_krw / 1e6:>9,.2f}M  "
            f"net_profit={summary.net_profit_krw / 1e6:>+9,.2f}M  "
            f"IRR={summary.money_weighted_return * 100:>6.2f}%  "
            f"MDD={summary.max_drawdown * 100:>5.2f}%  "
            f"trades={summary.trade_count}"
        )

    print("\n=== Current holdings (top 5 by market value per persona) ===")
    by_persona: dict[str, list] = {}
    for holding in result.current_holdings:
        by_persona.setdefault(holding.persona, []).append(holding)
    for persona, holdings in by_persona.items():
        label = next((s.label for s in result.summaries if s.persona == persona), persona)
        print(f"  [{label}]  total {len(holdings)} 종목")
        for h in holdings[:5]:
            name = (h.company or h.symbol)[:24]
            ret = f"{h.unrealized_return * 100:+.1f}%" if h.unrealized_return is not None else "n/a"
            print(
                f"    {h.symbol:<14s} {name:<24s}  qty={h.qty:>6d}  "
                f"avg_cost={h.avg_cost_krw:>10,.0f}  last={h.last_close_krw or 0:>10,.0f}  "
                f"value={h.market_value_krw / 1e6:>7,.2f}M  unreal={ret:>7s}  "
                f"holding_days={h.holding_days}"
            )

    rs = result.report_stats
    if rs is not None:
        print("\n=== SMIC report universe statistics (persona-agnostic) ===")
        print(
            f"  total reports={rs.total_reports}  with prices={rs.reports_with_prices}  "
            f"target_hit={rs.target_hit_count} ({rs.target_hit_rate * 100:.1f}%)"
        )
        if rs.avg_days_to_target is not None:
            print(f"  days to target: avg={rs.avg_days_to_target:.0f}  median={rs.median_days_to_target:.0f}")
        if rs.avg_current_return is not None and rs.median_current_return is not None:
            print(
                f"  realised return so far: avg={rs.avg_current_return * 100:+.1f}%  "
                f"median={rs.median_current_return * 100:+.1f}%"
            )
        if rs.avg_target_upside_at_pub is not None:
            print(f"  avg target upside promised at publication: {rs.avg_target_upside_at_pub * 100:+.1f}%")

        def _fmt_perf(p, key: str) -> str:
            value = getattr(p, key)
            if value is None:
                return f"{p.symbol:<14s} {p.company[:18]:<18s}  n/a"
            return (
                f"{p.symbol:<14s} {p.company[:18]:<18s}  pub={p.publication_date}  {key}={value * 100:+.1f}%"
            )

        print("\n  -- Top 5 winners (current return since publication):")
        for p in rs.top_winners[:5]:
            print(f"    {_fmt_perf(p, 'current_return')}")
        print("\n  -- Top 5 losers (current return since publication):")
        for p in rs.top_losers[:5]:
            print(f"    {_fmt_perf(p, 'current_return')}")
        print("\n  -- Top 5 furthest below target (still open):")
        for p in rs.biggest_target_gaps_below[:5]:
            print(f"    {_fmt_perf(p, 'target_gap_pct')}")
        print("\n  -- Top 5 fastest target hits (days to target):")
        for p in rs.fastest_target_hits[:5]:
            d = p.days_to_target if p.days_to_target is not None else "?"
            print(f"    {p.symbol:<14s} {p.company[:18]:<18s}  pub={p.publication_date}  days={d}")

    print(f"\nArtifacts written to {out}")
    return 0


def _load_stock_rule_personas(path: Path) -> tuple[StockRulePersonaConfig, ...]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"{path} must be a JSON list of stock-rule persona configs")
    return tuple(StockRulePersonaConfig.model_validate(row) for row in data)


def _load_broker_strategy_personas(path: Path) -> tuple[SmicMttStrategyConfig, ...]:
    data = json.loads(path.read_text(encoding="utf-8"))
    rows = data.get("personas") if isinstance(data, dict) else data
    if not isinstance(rows, list):
        raise ValueError(f"{path} must be a JSON list or persona-configs artifact")
    return tuple(
        SmicMttStrategyConfig.model_validate(row)
        for row in rows
        if isinstance(row, dict) and str(row.get("persona_name", "")).startswith("smic_mtt_strategy")
    )


def _load_pit_research_board_personas(path: Path) -> tuple[PitResearchBoardConfig, ...]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"{path} must be a JSON list of PIT research-board persona configs")
    default_labels = {config.persona_name: config.label for config in default_pit_research_board_configs()}
    configs = tuple(PitResearchBoardConfig.model_validate(row) for row in data)
    return tuple(
        config.model_copy(update={"label": default_labels.get(config.persona_name, config.label)})
        for config in configs
        if not config.persona_name.startswith(EXPERIMENTAL_PIT_ALPHA_PREFIX)
    )


if __name__ == "__main__":
    raise SystemExit(main())
