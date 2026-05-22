#!/usr/bin/env python3
"""Generate approved stock-rule and broker-ledger personas, then run simulation."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from snusmic_pipeline.sim.strategy_generation import (  # noqa: E402
    StrategyGenerationConfig,
    run_strategy_generation,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--warehouse", type=Path, default=ROOT / "data" / "warehouse")
    parser.add_argument("--out", type=Path, default=ROOT / "data" / "sim")
    parser.add_argument("--start", default="2021-01-04")
    parser.add_argument("--end", default=date.today().isoformat())
    parser.add_argument("--is-start", default="2021-01-04")
    parser.add_argument("--is-end", default="2022-12-31")
    parser.add_argument("--stock-oos-start", default="2023-01-02")
    parser.add_argument("--stock-oos-end", default=None)
    parser.add_argument("--max-stock-configs", type=int, default=0)
    parser.add_argument("--is-top", type=int, default=75)
    parser.add_argument("--admit-top", type=int, default=0)
    parser.add_argument("--stock-persona-top", type=int, default=10)
    parser.add_argument("--max-correlation", type=float, default=0.95)
    parser.add_argument("--goal-min-sharpe", type=float, default=0.7)
    parser.add_argument("--goal-min-sortino", type=float, default=0.7)
    parser.add_argument("--goal-min-return", type=float, default=2.0)
    parser.add_argument("--goal-max-drawdown", type=float, default=0.65)
    parser.add_argument("--broker-strategy-trials", type=int, default=120)
    parser.add_argument("--broker-strategy-top", type=int, default=3)
    parser.add_argument("--broker-strategy-seed", type=int, default=42)
    parser.add_argument("--refresh-benchmark", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    result = run_strategy_generation(
        StrategyGenerationConfig(
            warehouse_dir=args.warehouse,
            out_dir=args.out,
            start_date=date.fromisoformat(args.start),
            end_date=date.fromisoformat(args.end),
            is_start=date.fromisoformat(args.is_start),
            is_end=date.fromisoformat(args.is_end),
            stock_oos_start=date.fromisoformat(args.stock_oos_start),
            stock_oos_end=date.fromisoformat(args.stock_oos_end) if args.stock_oos_end else None,
            max_stock_configs=args.max_stock_configs,
            is_top=args.is_top,
            admit_top=args.admit_top,
            stock_persona_top=args.stock_persona_top,
            max_correlation=args.max_correlation,
            goal_min_sharpe=args.goal_min_sharpe,
            goal_min_sortino=args.goal_min_sortino,
            goal_min_return=args.goal_min_return,
            goal_max_drawdown=args.goal_max_drawdown,
            broker_strategy_trials=args.broker_strategy_trials,
            broker_strategy_top=args.broker_strategy_top,
            broker_strategy_seed=args.broker_strategy_seed,
            refresh_benchmark=args.refresh_benchmark,
        )
    )
    print(json.dumps(result.__dict__, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
