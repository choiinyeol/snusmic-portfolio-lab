"""Account simulation command implementation."""

from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path

from snusmic_pipeline.sim.artifacts import write_simulation_artifacts
from snusmic_pipeline.sim.contracts import SimulationConfig
from snusmic_pipeline.sim.runner import run_simulation

REPO_ROOT = Path(__file__).resolve().parents[3]


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
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    config = SimulationConfig(
        start_date=date.fromisoformat(args.start),
        end_date=date.fromisoformat(args.end),
    )

    print(f"Running simulation {config.start_date} to {config.end_date}")
    print(f"  warehouse: {args.warehouse}")
    print(f"  accounts : {[p.account_id for p in config.accounts]}")

    result = run_simulation(config, args.warehouse, refresh_benchmark=args.refresh_benchmark)
    write_simulation_artifacts(result, args.out)
    print(f"\nArtifacts written to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
