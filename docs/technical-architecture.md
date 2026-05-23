# Technical Architecture

The repository is layered by job:

- `src/snusmic_pipeline/ingest`: source discovery, PDF download, extraction, quality checks, markdown export, and report metadata models.
- `src/snusmic_pipeline/market_data`: currency and market-data normalization helpers.
- `src/snusmic_pipeline/sim`: fixed account simulation, PIT warehouse IO, brokerage math, daily-forward checkpoints, and visualization.
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

- `/main`: executive overview.
- `/reports`: report table.
- `/reports/[symbol]` and `/reports/[symbol]/[reportId]`: report evidence.
- `/screener`: PIT report board.
- `/statistics`: report-level outcome and factor diagnostics.
- `/portfolio`: account chooser.
- `/portfolio/[account]/*`: holdings, equity, trades, and methodology for one account.

## Contracts

Python exporters own data shape. TypeScript Zod schemas validate those generated artifacts at build time. The frontend reads `data/web/accounts/catalog.json` for account taxonomy and must not infer meaning from account-id strings.
