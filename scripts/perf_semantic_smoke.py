from __future__ import annotations

import argparse
import json
import time
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

import pandas as pd

from snusmic_pipeline.sim.contracts import SimulationConfig
from snusmic_pipeline.sim.forward_runner import run_daily_forward
from snusmic_pipeline.web_artifacts import ExportInputs, export_web_artifacts


def main() -> None:
    parser = argparse.ArgumentParser(description="Fast semantic/performance smoke checks for refactors.")
    parser.add_argument("--warehouse", type=Path, default=Path("data/warehouse"))
    parser.add_argument("--sim", type=Path, default=Path("data/sim"))
    parser.add_argument("--extraction-quality", type=Path, default=Path("data/extraction_quality.json"))
    parser.add_argument("--json", action="store_true", help="Print compact JSON.")
    args = parser.parse_args()

    payload = {
        "web_export": _measure_web_export(args.warehouse, args.sim, args.extraction_quality),
        "forward_smoke": _measure_forward_smoke(args.warehouse),
    }
    text = json.dumps(payload, ensure_ascii=False, indent=None if args.json else 2, sort_keys=True)
    print(text)


def _measure_web_export(warehouse: Path, sim: Path, extraction_quality: Path) -> dict[str, Any]:
    with TemporaryDirectory() as tmpdir:
        out = Path(tmpdir) / "web"
        started = time.perf_counter()
        result = export_web_artifacts(
            ExportInputs(
                warehouse=warehouse,
                sim=sim,
                out=out,
                extraction_quality=extraction_quality,
            )
        )
        duration = time.perf_counter() - started
        overview = _read_json(out / "overview.json")
        manifest = _read_json(out / "manifest.json")
        return {
            "seconds": round(duration, 4),
            "artifact_count": result.get("artifact_count"),
            "report_counts": overview.get("report_counts"),
            "price_artifact_count": manifest.get("price_artifact_count"),
            "manifest_artifacts": len(manifest.get("artifacts", [])),
        }


def _measure_forward_smoke(warehouse: Path) -> dict[str, Any]:
    with TemporaryDirectory() as tmpdir:
        out = Path(tmpdir) / "sim"
        base = SimulationConfig(start_date=date(2021, 1, 4), end_date=date(2021, 2, 10))
        accounts = tuple(account_id for account_id in base.accounts if account_id.account_id != "weak_oracle")
        config = base.model_copy(update={"accounts": accounts})
        started = time.perf_counter()
        result = run_daily_forward(config, warehouse, out)
        duration = time.perf_counter() - started
        summary = pd.read_csv(out / "summary.csv")
        return {
            "seconds": round(duration, 4),
            "mode": result.mode,
            "latest_date": result.latest_date.isoformat(),
            "accounts": sorted(summary["account_id"].astype(str).tolist()),
            "summary_rows": int(len(summary)),
        }


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
