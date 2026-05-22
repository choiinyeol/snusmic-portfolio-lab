#!/usr/bin/env bash
set -euo pipefail

# Full research rebuild path. Daily market refreshes should use
# scripts/refresh_web_artifacts.sh, which advances the checkpointed core
# portfolio without rerunning stock/PIT strategy search.

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

ORACLE_ARGS=()
if [ "${SMIC_INCLUDE_ORACLE:-0}" = "1" ]; then
  ORACLE_ARGS+=(--include-oracle)
fi

"${PYTHON_CMD[@]}" -m snusmic_pipeline generate-strategies \
  --warehouse data/warehouse \
  --out data/sim \
  --start "${SIM_START:-2021-01-04}" \
  --end "$PRICE_END" \
  --is-start "${STOCK_RULE_IS_START:-2021-01-04}" \
  --is-end "${STOCK_RULE_IS_END:-2022-12-31}" \
  --stock-oos-start "${STOCK_RULE_OOS_START:-2023-01-02}" \
  --stock-oos-end "$PRICE_END" \
  --is-top "${STOCK_RULE_IS_TOP:-75}" \
  --admit-top 0 \
  --stock-persona-top "${STOCK_RULE_PERSONA_TOP:-0}" \
  --pit-strategy-top "${PIT_RESEARCH_BOARD_STRATEGY_TOP:-0}" \
  --goal-min-sharpe "${STOCK_RULE_GOAL_MIN_SHARPE:-0.7}" \
  --goal-min-sortino "${STOCK_RULE_GOAL_MIN_SORTINO:-0.7}" \
  --goal-min-return "${STOCK_RULE_GOAL_MIN_RETURN:-2.0}" \
  --goal-max-drawdown "${STOCK_RULE_GOAL_MAX_DRAWDOWN:-0.65}" \
  --max-correlation "${STOCK_RULE_MAX_CORRELATION:-0.95}" \
  --broker-strategy-trials "${SMIC_BROKER_STRATEGY_TRIALS:-120}" \
  --broker-strategy-top "${SMIC_BROKER_STRATEGY_TOP:-3}" \
  --broker-strategy-seed "${SMIC_BROKER_STRATEGY_SEED:-42}" \
  "${ORACLE_ARGS[@]}"
"${PYTHON_CMD[@]}" -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web

mkdir -p apps/web/public/downloads
cp data/web/table-download-reports.csv apps/web/public/downloads/snusmic-reports.csv
cp data/web/table-download-strategies.csv apps/web/public/downloads/snusmic-strategies.csv
cp data/web/data-quality-download.csv apps/web/public/downloads/snusmic-data-quality.csv

printf 'Full rebuilt web artifacts through %s\n' "$PRICE_END"
