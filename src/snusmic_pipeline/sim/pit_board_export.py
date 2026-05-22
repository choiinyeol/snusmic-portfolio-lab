"""CLI implementation for exporting point-in-time research board rows."""

from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path

import pandas as pd

from .market import PriceBoard
from .pit_research_board import build_pit_research_board_snapshots
from .runner import _prepare_reports
from .target_adjustment import align_report_targets_to_market_scale
from .warehouse import read_table

REPO_ROOT = Path(__file__).resolve().parents[3]
ROUND_NDIGITS = 4


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", default="2021-01-04")
    parser.add_argument("--end", default=date.today().isoformat())
    parser.add_argument("--warehouse", type=Path, default=REPO_ROOT / "data" / "warehouse")
    parser.add_argument("--out", type=Path, default=REPO_ROOT / "data" / "sim" / "pit-research-board.csv")
    parser.add_argument("--cadence", choices=("D", "W", "M"), default="M")
    parser.add_argument("--max-report-age-days", type=int, default=730)
    parser.add_argument("--universe", choices=("all", "domestic", "overseas"), default="all")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    start = date.fromisoformat(args.start)
    end = date.fromisoformat(args.end)
    board = PriceBoard.from_warehouse(args.warehouse)
    trading_dates = board.trading_dates(start=start, end=end)
    if not trading_dates:
        raise RuntimeError(f"No trading dates in warehouse between {start} and {end}.")
    reports = read_table(args.warehouse, "reports")
    reports = _prepare_reports(reports, start, end)
    reports = align_report_targets_to_market_scale(reports, board, end)
    rows = build_pit_research_board_snapshots(
        reports,
        board,
        trading_dates,
        cadence=args.cadence,
        max_report_age_days=args.max_report_age_days,
        universe=args.universe,
    )
    out: Path = args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    frame = pd.DataFrame(rows)
    for col in frame.select_dtypes(include="float").columns:
        frame[col] = frame[col].round(ROUND_NDIGITS)
    frame.to_csv(out, index=False)
    print(f"PIT research board rows: {len(frame)}")
    print(f"Artifact written to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
