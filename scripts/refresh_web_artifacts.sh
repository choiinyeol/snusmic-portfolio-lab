#!/usr/bin/env bash
set -euo pipefail

# Rebuild every generated artifact the static web app reads after market data
# changes. Keep the simulation end-date tied to the newest warehouse bar so
# scheduled refreshes do not silently leave the UI on an old date.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if command -v uv >/dev/null 2>&1; then
  PYTHON_CMD=(uv run --locked python)
elif command -v uv.exe >/dev/null 2>&1; then
  PYTHON_CMD=(uv.exe run --locked python)
elif [ -x ".venv/bin/python" ]; then
  PYTHON_CMD=(.venv/bin/python)
elif [ -x ".venv/Scripts/python.exe" ]; then
  PYTHON_CMD=(.venv/Scripts/python.exe)
else
  PYTHON_CMD=(python)
fi

PRICE_END="$("${PYTHON_CMD[@]}" - <<'PY' | tr -d '\r'
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

"${PYTHON_CMD[@]}" -m snusmic_pipeline daily-forward \
  --warehouse data/warehouse \
  --out data/sim \
  --start "${SIM_START:-2021-01-04}" \
  --end "$PRICE_END"
"${PYTHON_CMD[@]}" -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web

mkdir -p apps/web/public/downloads
cp data/web/table-download-reports.csv apps/web/public/downloads/snusmic-reports.csv
cp data/web/table-download-accounts.csv apps/web/public/downloads/snusmic-accounts.csv
cp data/web/data-quality-download.csv apps/web/public/downloads/snusmic-data-quality.csv


printf 'Refreshed web artifacts through %s\n' "$PRICE_END"
