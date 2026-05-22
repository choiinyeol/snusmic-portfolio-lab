#!/usr/bin/env bash
set -euo pipefail

# Full rebuild path. Daily market refreshes should use
# scripts/refresh_web_artifacts.sh, which advances the checkpointed core
# portfolio.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if command -v uv >/dev/null 2>&1; then
  PYTHON_CMD=(uv run python)
elif [ -x ".venv/bin/python" ]; then
  PYTHON_CMD=(.venv/bin/python)
else
  PYTHON_CMD=(python)
fi

PRICE_END="$("${PYTHON_CMD[@]}" - <<'PY'
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

"${PYTHON_CMD[@]}" -m snusmic_pipeline run-sim \
  --warehouse data/warehouse \
  --out data/sim \
  --start "${SIM_START:-2021-01-04}" \
  --end "$PRICE_END"
"${PYTHON_CMD[@]}" -m snusmic_pipeline export-pit-board \
  --warehouse data/warehouse \
  --out data/sim/pit-research-board.csv \
  --start "${SIM_START:-2021-01-04}" \
  --end "$PRICE_END" \
  --cadence "${PIT_BOARD_CADENCE:-M}"
"${PYTHON_CMD[@]}" -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web

mkdir -p apps/web/public/downloads
cp data/web/table-download-reports.csv apps/web/public/downloads/snusmic-reports.csv
cp data/web/table-download-accounts.csv apps/web/public/downloads/snusmic-accounts.csv
cp data/web/data-quality-download.csv apps/web/public/downloads/snusmic-data-quality.csv

printf 'Full rebuilt web artifacts through %s\n' "$PRICE_END"
