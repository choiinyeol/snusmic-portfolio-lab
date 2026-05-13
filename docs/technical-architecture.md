# SNUSMIC Portfolio Lab Technical Architecture

SNUSMIC Portfolio Lab is an artifact-backed research, portfolio, and strategy validation product. The web app is a static reader over committed canonical artifacts; the Python pipeline owns data refresh, price matching, simulation, and export.

## Product contract

- **Artifact-first:** `data/web` is the frontend source of truth. The web runtime must not read `public/downloads` or remote market data as source data.
- **Read-only snapshot:** pages present a dated basis-data view, not a live broker view. Primary product copy should use user language such as `기준 데이터`, `읽기 전용`, `가격 확인`, and `전략 비교`; implementation labels such as `Static Artifacts`, `canonical`, and `data/web` belong in technical/data-quality surfaces.
- **Fast-fail schema boundary:** required artifacts are validated at read/build time. A required schema mismatch should stop the build with an actionable path, not render misleading empty analytics.
- **Server-first frontend:** Server Components read artifacts, compute static summaries, and render cards/tables. Client islands are reserved for charts, treemaps, and table interactions.
- **No runtime market calls:** market/FX refresh belongs to the Python pipeline before build. Next.js rendering must not call live market APIs.
- **Data lineage visible:** every snapshot should expose schema version, report range, price range, simulation range, row counts, and important data-quality counts when available.

## Canonical artifacts

Core frontend artifacts live in `data/web`:

- `manifest.json` — snapshot schema version, generated timestamp, row counts, date ranges, and checksums.
- `strategies/catalog.json` — benchmark/strategy/oracle taxonomy, labels, default-candidate metadata, methodology summaries, buy/sell rules, risk controls, params, and core metrics.
- `overview.json` — snapshot windows, summary rows, report statistics, and benchmark summary.
- `reports.json` — report-level target/price validation rows.
- `current-holdings.json` — current share-based holdings for each persona/strategy.
- `trades.json` — share-based broker-ledger trade tape.
- `equity-daily.json` — daily equity/return path by persona or benchmark.
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

Every persona/row outside the benchmark set is a proprietary/selectable broker-ledger strategy. UI should group these separately from benchmarks and make their methodology explicit. The frontend must read this taxonomy from `strategies/catalog.json` instead of hardcoding business meaning from persona IDs.

### Personal objective gate

The primary product gate is:

```text
MDD <= 15% and return > KOSPI/KODEX 200 benchmark
```

Strategy tables and charts should surface this gate directly. If no candidate passes, say so clearly; do not bury the failure behind a sorted return table.

## Quant methodology guardrails

- Display MDD as a positive loss magnitude.
- Show sample size for rankings and strategy comparisons.
- Distinguish benchmarks from selectable broker-ledger strategies.
- Make search/evaluation windows explicit when strategy generation metadata is exposed.
- Label Weak Prophet as a future-information baseline.
- Exclude missing-price/downside/non-actionable report rows from report validation tables, and expose the excluded symbol count in data-quality artifacts.
- Do not imply investment advice, live execution, or guaranteed return.

## CI and validation contract

Baseline validation before merge/deploy:

```bash
pnpm --dir apps/web artifact:check
pnpm --dir apps/web typecheck
pnpm --dir apps/web exec biome check .
pnpm --dir apps/web build
uv run ruff check src scripts tests
uv run pytest tests/sim tests/test_web_artifacts.py -q
```

Heavy full-pipeline regeneration can be manual or branch-gated, but artifact schema checks and web build must run on ordinary PRs.
