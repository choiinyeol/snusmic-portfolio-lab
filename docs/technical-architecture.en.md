# Technical Architecture

The repository runs around a verification-first domain chain:

- `ReportArtifact`: source artifact carrying PDF, markdown, and structured extraction results
- `VerificationCase`: PIT post-publication validation unit for a report claim
- `AlphaHypothesis`: repeated selection rule backed by many verification cases
- `PortfolioStrategy`: benchmark-comparable proof layer consuming alpha hypotheses
- `Execution trace`: historical daily explanation layer for buy/sell reason, quantity, fill, and PnL

Current code layers:
- `src/snusmic_pipeline/ingest`: source discovery, PDF download, extraction, quality checks, markdown export
- `src/snusmic_pipeline/market_data`: currency and market-data normalization helpers
- `src/snusmic_pipeline/sim`: fixed account simulation, PIT warehouse IO, brokerage math, daily-forward checkpoints, visualization
- `src/snusmic_pipeline/web`: Python-side web artifact contracts and exporters
- `apps/web`: static Next.js reader for generated JSON artifacts
- `scripts`: small CI/deployment utilities only

The current product keeps the working PIT/export pipeline and layers the verification→alpha→proof contracts directly on top of it.

### Data Flow

1. `sync` and extraction commands produce `ReportArtifact` inputs.
2. `build-warehouse` writes typed PIT CSV tables.
3. `refresh-prices` writes OHLCV price history.
4. verification builders convert structured artifacts + PIT prices into `VerificationCase` records.
5. alpha promotion consumes verification cases and emits `AlphaHypothesis` candidates.
6. strategy proof consumes promoted hypotheses and benchmark data.
7. `export-web` writes verification / alpha / proof artifacts for the static app.

### Frontend Data Bridge

The web app remains a static reader over committed `data/web` artifacts. Route files should call page view models and pass display-ready props into React components. Low-level file reads stay in server-only artifact readers; React components must not recompute PIT validation, benchmark coverage, or simulation logic.

`data/web` should reflect the verification-first chain:
- source side: report artifacts, markdown, structured extraction outputs
- verification side: case-level quality and veto state
- alpha side: repeated-rule support and stability proof
- portfolio side: benchmark proof plus historical execution trace

Portfolio time series may still be stored as account shards, but the product framing must be `PortfolioStrategy` proof rather than account-ledger truth. The GA default serving mode is **local committed shards**. `external_artifacts` remains an optional operating path that must pass hydrate / validate / build proof before activation.

### Current Product Inventory

- `/` — VerificationCase board
- `/alpha` — alpha promotion board
- `/reports` — source report / evidence table
- `/reports/[symbol]/[reportId]` — report evidence detail
- `/calendar` — PIT observation-date diagnostics
- `/statistics` — validation-case outcome diagnostics
- `/portfolio` — portfolio proof catalogue
- `/portfolio/[account]` — selected strategy proof
- `/portfolio/[account]/holdings` — proof holdings
- `/portfolio/[account]/trades` — historical execution trace
