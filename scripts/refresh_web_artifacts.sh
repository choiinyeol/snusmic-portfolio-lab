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

uv run python scripts/run_stock_rule_search.py \
  --warehouse data/warehouse \
  --is-start "${STOCK_RULE_IS_START:-2021-01-04}" \
  --is-end "${STOCK_RULE_IS_END:-2022-12-31}" \
  --validation-mode "${STOCK_RULE_VALIDATION_MODE:-full_sample}" \
  --full-start "${STOCK_RULE_FULL_START:-2021-01-04}" \
  --full-end "$PRICE_END" \
  --oos-start "${STOCK_RULE_OOS_START:-2023-01-02}" \
  --oos-end "$PRICE_END" \
  --out data/sim \
  --is-top "${STOCK_RULE_IS_TOP:-0}" \
  --admit-top 0 \
  --persona-top "${STOCK_RULE_PERSONA_TOP:-10}" \
  --max-correlation "${STOCK_RULE_MAX_CORRELATION:-0.95}"

uv run python -m snusmic_pipeline run-sim --start "${SIM_START:-2021-01-04}" --end "$PRICE_END" --disable-broker-strategy-search
uv run python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web

mkdir -p apps/web/public/downloads
cp data/web/table-download-reports.csv apps/web/public/downloads/snusmic-reports.csv
cp data/web/table-download-strategies.csv apps/web/public/downloads/snusmic-strategies.csv
cp data/web/data-quality-download.csv apps/web/public/downloads/snusmic-data-quality.csv


printf 'Refreshed web artifacts through %s\n' "$PRICE_END"
