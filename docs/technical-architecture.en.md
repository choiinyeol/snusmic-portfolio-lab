# Technical Architecture

The repository is layered by job:

- `src/snusmic_pipeline/ingest`: source discovery, PDF download, extraction, quality checks, markdown export, and report metadata models.
- `src/snusmic_pipeline/market_data`: currency and market-data normalization helpers.
- `src/snusmic_pipeline/sim`: fixed account simulation, PIT warehouse IO, brokerage math, local daily-forward checkpoints, and visualization.
- `src/snusmic_pipeline/web`: Python-side web artifact contracts and exporters.
- `apps/web`: static Next.js reader for generated JSON artifacts.
- `scripts`: small CI/deployment utilities only; data refresh and rebuild flows live in the package CLI.

### Data Flow

1. `sync` and extraction commands produce raw report rows.
2. `build-warehouse` writes typed PIT CSV tables.
3. `refresh-prices` writes OHLCV price history.
4. `refresh-web-artifacts` advances account artifacts to the latest warehouse price date and writes `data/web/**` only through the deterministic/cross-reference checked exporter.
5. `rebuild-web-artifacts` performs the full fixed-account/PIT-board/web rebuild when a clean local regeneration is needed.

### Frontend Data Bridge

The web app remains a static reader over committed `data/web` artifacts. Route files should call page view models, then pass display-ready props into React components. Low-level file reads stay in server-only artifact readers; React components should not recompute target-hit, split adjustment, benchmark coverage, or report-window logic.

Portfolio time series are account shards under `data/web/portfolio/equity/**` and `data/web/portfolio/daily-decisions/**`; the web app should read selected account shards rather than aggregate all simulation branches.
`data/web/health.json` is the shell-level operational health artifact. The Python exporter computes date alignment, missing-price coverage, review status, and action copy; the frontend displays that result instead of recalculating product health. `apps/web artifact:check` also applies current-date price/report freshness thresholds to block stale snapshots.
`data/web/report-health.json` is the per-report diagnostics artifact for all 240 source reports. It explains transcription/extraction review, missing prices, and policy-driven web exclusions so the Report Board can show why a report is outside the visible web sample. `missing-symbols.json` includes category/action metadata for missing-price symbols so delistings and provider gaps are distinct.
