# Task 6 — Final stock-level persona validation

## Verdict

**FAIL / BLOCKED:** the integrated artifacts do **not** yet contain the required new stock-level persona surface.

This validation intentionally ignores the old meta-quant `goal_hit_count` and old MTT admission count. The only accepted-count evidence allowed for this task is `stock_rule_*` / stock-admission evidence.

## Required checks

| Requirement | Evidence | Result |
| --- | ---: | --- |
| 10+ `stock_rule_*` personas in `data/web/portfolio/personas.json` | `0` | FAIL |
| 10+ `stock_rule_*` rows in `data/web/strategies/catalog.json` | `0` | FAIL |
| 10+ `stock_rule_*` personas with trades in `data/web/portfolio/trades.json` | `0` | FAIL |
| 10+ `stock_rule_*` personas with holdings in `data/web/portfolio/holdings.json` | `0` | FAIL |
| 10+ `stock_rule_*` personas with equity series in `data/web/portfolio/equity-daily.json` | `0` | FAIL |
| Stock OOS admission object embedded in `data/web/strategies/admission.json` | `stock_admission: null` | FAIL |
| Stock accepted count in admission artifact | `stock_accepted_count: 0` | FAIL |
| Retired `/portfolio/quant` source route removed | route file missing | PASS |
| Retired quant source refs removed from `apps/web/app`, `apps/web/components`, `apps/web/lib` | no `portfolio/quant`, `QuantStrategySearchTable`, or `quant-search-top` refs | PASS |

## Probe output

Command:

```bash
python - <<'PY'
# reads data/web portfolio, catalog, admission, holdings/trades/equity artifacts
# and counts only persona IDs starting with stock_rule_
PY
```

Output captured in `.omx/logs/task6-stock-validation-probe.log`:

```text
stock_portfolio_personas= 0
stock_root_personas= 0
stock_catalog_rows= 0
stock_trade_personas= 0
stock_holding_personas= 0
stock_equity_personas= 0
admission_stock_accepted_count= 0
admission_stock_admission_present= False
admission_accepted_count_old_mtt= 21
sample_stock_personas= []
CHECK portfolio_personas>=10: FAIL
CHECK catalog>=10: FAIL
CHECK trade_personas>=10: FAIL
CHECK holding_personas>=10: FAIL
CHECK equity_personas>=10: FAIL
CHECK stock_admission_present: FAIL
CHECK stock_accepted_count>=10: FAIL
```

## Validation commands run

- `uv run pytest -q tests/sim/test_stock_admission.py` → PASS (`9 passed`)
- `uv run pytest -q tests/test_web_artifacts.py -k admission` → PASS (`1 passed, 17 deselected`)
- `uv run ruff check scripts/run_stock_rule_search.py src/snusmic_pipeline/sim/stock_admission.py src/snusmic_pipeline/sim/stock_rule_search.py src/snusmic_pipeline/web_artifacts.py tests/sim/test_stock_admission.py` → PASS
- Retired source route checks → PASS:
  - `apps/web/app/(app)/portfolio/quant/[strategy]/page.tsx` is absent
  - no source references to `portfolio/quant`, `QuantStrategySearchTable`, or `quant-search-top` in `apps/web/app`, `apps/web/components`, `apps/web/lib`

## Concrete blocker

Task 2 added stock-level search/admission code and Task 3 added exporter support, but the current integrated data artifacts lack the generated stock-level outputs needed for product validation:

- no `data/sim/stock-admission.json` or `data/sim/stock_admission.json`
- no `stock_rule_*` rows in simulation summary/persona config
- no `stock_rule_*` portfolio/persona/catalog/holding/trade/equity web artifacts
- `data/web/strategies/admission.json` has `stock_accepted_count: 0` and `stock_admission: null`

Until the upstream simulator/export lane materializes accepted `stock_rule_*` personas and the stock-admission artifact, this verifier cannot honestly prove the required 10+ OOS-admitted stock-level personas.

## Non-proof explicitly excluded

`data/web/strategies/admission.json` still reports old MTT `accepted_count: 21`; this is **not** stock-level `stock_rule_*` evidence and was not used as completion proof.
