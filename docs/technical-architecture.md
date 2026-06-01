# Technical Architecture

The repository is layered by job:

- `src/snusmic_pipeline/ingest`: source discovery, PDF download, extraction, quality checks, markdown export, and report metadata models.
- `src/snusmic_pipeline/market_data`: currency and market-data normalization helpers.
- `src/snusmic_pipeline/sim`: fixed account simulation, PIT warehouse IO, brokerage math, local daily-forward checkpoints, and visualization.
- `src/snusmic_pipeline/web`: Python-side web artifact contracts and exporters.
- `apps/web`: static Next.js reader for generated JSON artifacts.
- `scripts`: small CI/deployment utilities only; data refresh and rebuild flows live in the package CLI.

## Data Flow

1. `sync` and extraction commands produce raw report rows.
2. `build-warehouse` writes typed PIT CSV tables.
3. `refresh-prices` writes OHLCV price history.
4. `refresh-web-artifacts` advances account artifacts to the latest warehouse price date and writes `data/web/**`.
5. `rebuild-web-artifacts` performs the full fixed-account/PIT-board/web rebuild when a clean local regeneration is needed.

## Web Routes

- `/`: report verification and report board.
- `/reports`: canonical report verification table.
- `/reports/[symbol]/[reportId]`: report evidence detail.
- `/statistics`: report-level outcome, concentration, and price-path diagnostics.
- `/portfolio`: account chooser.
- `/portfolio/[account]`: account overview.
- `/portfolio/[account]/equity`: account equity and trade path.
- `/portfolio/[account]/holdings`: current holdings.
- `/portfolio/[account]/trades`: trade ledger.

This list is the current web product inventory. Route files outside this inventory need a product decision before implementation.

## Frontend Data Bridge

The web app remains a static reader over committed `data/web` artifacts. Route files should call page view models from `apps/web/lib/view-models/**`, then pass display-ready props into React components. Low-level file reads stay in server-only artifact readers; React components should not recompute target-hit, split adjustment, benchmark coverage, or report-window logic.

Page bundles under `data/web/pages/**` are the preferred shape for screen-level metadata, metrics, views, warnings, and table/chart payloads. Canonical artifacts under `data/web/reports/**`, `data/web/portfolio/**`, and `data/web/prices/**` remain the source of truth for reusable data. Portfolio time series are account shards under `data/web/portfolio/equity/**` and `data/web/portfolio/daily-decisions/**`; the web app should read the selected account shards rather than aggregate all simulation branches.

## Cross-Platform Tooling

Project scripts are Node or Python entrypoints rather than Bash wrappers. `pnpm build` calls `scripts/vercel_build.mjs`, and Vercel prebuilt output is prepared by `scripts/prepare_vercel_prebuilt.mjs`, so the same deploy build path works on macOS, Windows, and Linux CI.

## Contracts

Python exporters own data shape. TypeScript Zod schemas validate those generated artifacts at build time. The frontend reads `data/web/accounts/catalog.json` for account taxonomy and must not infer meaning from account-id strings.

Daily-forward checkpoints are local replay caches. They are not committed product artifacts; deleting them only makes the next run replay from the warehouse.
