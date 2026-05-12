# SNUSMIC Portfolio Lab Technical Architecture

SNUSMIC Portfolio Lab is an artifact-backed research, portfolio, and strategy validation product. The web app is a static reader over committed canonical artifacts; the Python pipeline owns data refresh, price matching, simulation, and export.

## Product contract

- **Artifact-first:** `data/web` is the frontend source of truth. The web runtime must not read `public/downloads` or remote market data as source data.
- **Static snapshot:** pages present a dated snapshot, not a live broker view. User-facing copy must preserve `Static Artifacts`, `No live trading`, and Korean equivalents such as `정적 스냅샷` and `커밋된 아티팩트 기준`.
- **Fast-fail schema boundary:** required artifacts are validated at read/build time. A required schema mismatch should stop the build with an actionable path, not render misleading empty analytics.
- **Server-first frontend:** Server Components read artifacts, compute static summaries, and render cards/tables. Client islands are reserved for charts, treemaps, and table interactions.
- **No runtime market calls:** market/FX refresh belongs to the Python pipeline before build. Next.js rendering must not call live market APIs.
- **Data lineage visible:** every snapshot should expose schema version, report range, price range, simulation range, row counts, and important data-quality counts when available.

## Canonical artifacts

Core frontend artifacts live in `data/web`:

- `manifest.json` — snapshot schema version, generated timestamp, row counts, date ranges, and checksums.
- `overview.json` — snapshot windows, summary rows, report statistics, and benchmark summary.
- `reports.json` — report-level target/price validation rows.
- `current-holdings.json` — current share-based holdings for each persona/strategy.
- `trades.json` — share-based broker-ledger trade tape.
- `equity-daily.json` — daily equity/return path by persona or benchmark.
- `strategy-runs.json` — report-performance candidate experiment outputs.
- `parameter-importance.json` — candidate search sensitivity summary.
- `data-quality.json` — extraction and price-matching quality facts.

Required artifacts must remain deterministic for identical inputs. Generated rows should be sorted deterministically before export.

## Benchmark vs strategy taxonomy

The product separates comparison baselines from proprietary/selectable strategies.

### Benchmark set

These are benchmarks and should be shown as comparison lines/cards, not marketed as custom strategies:

1. `all_weather` — All-Weather allocation.
2. `smic_follower` — SMIC Follower v1.
3. `smic_follower_v2` — SMIC Follower v2 / stop-loss baseline.
4. `benchmark_kodex200` — KOSPI/KODEX 200 proxy.
5. `benchmark_qqq` — NASDAQ-100 / QQQ proxy.
6. `benchmark_spy` — S&P 500 / SPY proxy.
7. `benchmark_gld` — Gold / GLD proxy.
8. `weak_oracle` — Weak Prophet future-information baseline; always label the future-information caveat.

### Selectable strategies

Every persona/row outside the benchmark set is a proprietary/selectable strategy or a report-performance experiment. UI should group these separately from benchmarks and make their methodology explicit.

### Personal objective gate

The primary product gate is:

```text
MDD <= 15% and return > KOSPI/KODEX 200 benchmark
```

Strategy tables and charts should surface this gate directly. If no candidate passes, say so clearly; do not bury the failure behind a sorted return table.

## Quant methodology guardrails

- Display MDD as a positive loss magnitude.
- Show sample size for rankings and strategy comparisons.
- Distinguish broker-ledger strategy results from report-performance candidate experiments.
- Make train/full/holdout windows explicit when strategy-search artifacts provide them.
- Label Weak Prophet as a future-information baseline.
- Show missing prices, missing targets, and price-matching gaps rather than hiding them.
- Do not imply investment advice, live execution, or guaranteed return.

## CI and validation contract

Baseline validation before merge/deploy:

```bash
pnpm --dir apps/web artifact:check
pnpm --dir apps/web typecheck
pnpm --dir apps/web exec biome check .
pnpm --dir apps/web build
uv run ruff check src scripts tests
uv run pytest tests/sim tests/strategy_search tests/test_web_artifacts.py -q
```

Heavy full-pipeline regeneration can be manual or branch-gated, but artifact schema checks and web build must run on ordinary PRs.
