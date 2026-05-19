# Task 5 — Quant search/run verification

## What passed
- `data/web/strategies/admission.json` reports `accepted_count: 21`.
- `data/web/strategies/strategy-admission.json` matches with `accepted_count: 21`.
- `data/web/strategies/quant-search-top.json` reports:
  - `candidate_count: 2772`
  - `goal_hit_count: 255`
  - `excluded: ["weak_oracle"]`
- This clears the task requirement to prove **10+ OOS admissions**; the current artifact proves **21 accepted admissions**.

## Validation already run
- `uv run pytest -q tests/sim/test_broker_strategy_search.py` → passed
- `uv run pytest -q tests/test_web_artifacts.py -k admission` → passed
- `pnpm build` → passed

## Evidence notes
- The web artifact is the current source of truth for admission counts in this checkout.
- The quant search display is already populated, so the missing work is packaging/insight logging, not candidate scarcity.

## Result
- Search/admission evidence is sufficient for the 10+ threshold.
