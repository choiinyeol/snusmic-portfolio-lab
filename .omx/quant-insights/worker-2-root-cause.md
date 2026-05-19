# Task 5 — Failure / root-cause notes

## Current blocker surface
- `.omx/quant-insights/` existed but was empty before this run; the required markdown summary bundle was missing.
- `data/sim/broker_strategy_trials.csv` is not present in this checkout, so the latest broker-admission trail is not persisted here.
- `scripts/export_quant_search_artifacts.py` still points at `.omx/quant/leader-meta-search-fixed.json`, which is missing in this checkout and is now effectively an obsolete source path.

## Why this matters
- The current repo already contains enough proof of success in `data/web/strategies/admission.json` and `data/web/strategies/quant-search-top.json`.
- The failure is therefore in **artifact handoff / insight packaging**, not in the strategy threshold itself.

## Failure-prone commands / checks
- `uv run python scripts/export_quant_search_artifacts.py`
  - will fail here if it expects the obsolete `.omx/quant/leader-meta-search-fixed.json` source artifact.
- `uv run python -m snusmic_pipeline export-web --check ...`
  - depends on sim/web artifacts being present and aligned.
- `pnpm build`
  - useful as the final integration check; it already passed in this checkout.

## What to capture for completion
- `ls -la .omx/quant-insights`
- `cat data/web/strategies/admission.json`
- `cat data/web/strategies/quant-search-top.json`
- The exact test/build command outputs above

## Conclusion
- Root cause is missing insight packaging and stale source-artifact wiring, not lack of OOS admissions.
