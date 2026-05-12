#!/usr/bin/env bash
set -euo pipefail

# Rebuild every generated artifact the static web app reads after market data
# changes. Keep the simulation end-date tied to the newest warehouse bar so
# scheduled refreshes do not silently leave the UI on an old date.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PRICE_END="$(uv run python - <<'PY'
from pathlib import Path
import pandas as pd

path = Path('data/warehouse/daily_prices.csv')
if not path.exists():
    raise SystemExit('data/warehouse/daily_prices.csv does not exist; run build-warehouse first')
prices = pd.read_csv(path, usecols=['date'])
if prices.empty:
    raise SystemExit('data/warehouse/daily_prices.csv is empty')
print(prices['date'].astype(str).max())
PY
)"

uv run python -m snusmic_pipeline run-sim --start "${SIM_START:-2021-01-04}" --end "$PRICE_END"
uv run python scripts/run_optuna_search.py --sampler "${STRATEGY_SAMPLER:-robust-grid}" --trials "${STRATEGY_TRIALS:-20}" --seed "${STRATEGY_SEED:-42}" --train-start "${STRATEGY_TRAIN_START:-2021-01-01}" --train-end "${STRATEGY_TRAIN_END:-2023-12-31}" --full-start "${STRATEGY_FULL_START:-2021-01-01}" --top-candidates "${STRATEGY_TOP_CANDIDATES:-5}"
uv run python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
uv run python scripts/export_optuna_artifacts.py --trials-csv data/optuna/exports/trials.csv --out data/web

mkdir -p apps/web/public/downloads
cp data/web/table-download-reports.csv apps/web/public/downloads/snusmic-reports.csv
cp data/web/table-download-strategies.csv apps/web/public/downloads/snusmic-strategies.csv
cp data/web/data-quality-download.csv apps/web/public/downloads/snusmic-data-quality.csv


printf 'Refreshed web artifacts through %s\n' "$PRICE_END"
