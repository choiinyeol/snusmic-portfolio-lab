# SNUSMIC Portfolio Lab

SNUSMIC Portfolio Lab turns SMIC research reports into point-in-time datasets, fixed account simulations, and static web artifacts. The current repository does **not** search for trading rules or promote generated account candidates. Rule discovery was removed deliberately; report boards are exported so a human can inspect the data and design rules explicitly.

[Live site](https://smic-portfolio.vercel.app) - [Changelog](./CHANGELOG.md) - [Design system](./DESIGN.md)

## What This Repo Does

- Collects SMIC report PDFs and extracted report rows.
- Normalizes reports, prices, FX, and benchmark data into `data/warehouse`.
- Exports a point-in-time research board at `data/sim/pit-research-board.csv`.
- Runs fixed benchmark/follower account simulations with real ledger constraints: cash, deposits, integer shares, fees, taxes, trades, holdings, and equity paths.
- Exports deterministic `data/web` JSON/CSV artifacts consumed by the static Next.js app.
- Presents report verification, review queue, statistics, and account views through page-shaped frontend view models instead of raw artifact tables.

## What It Does Not Do

- No broker rule search.
- No stock-rule search or admission.
- No PIT rule generation.
- No generated account admission.
- No hidden migration, rollback, or safety-net path.

## Core Commands

The repo uses Python and Node entrypoints instead of shell scripts so the same commands work on macOS and Windows.

```bash
uv sync --group dev
pnpm --dir apps/web install
```

Refresh data and static artifacts:

```bash
python -m snusmic_pipeline refresh-web-artifacts
```

Full rebuild:

```bash
python -m snusmic_pipeline rebuild-web-artifacts
```

Manual PIT dataset export:

```bash
python -m snusmic_pipeline export-pit-board --warehouse data/warehouse --out data/sim/pit-research-board.csv --start 2021-01-04 --cadence M
```

Fixed account simulation:

```bash
python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim
```

Web artifact export:

```bash
python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
```

## Default Simulation Set

The default simulation config contains fixed baselines only:

- All Weather
- QQQ
- SPY
- KODEX 200
- GLD
- SMIC Report Follower
- SMIC Report Follower with Stops

Forward-looking oracle simulations remain testable diagnostics, but they are not default accounts and are not exported into the web account catalog.

## Data Flow

```mermaid
flowchart TB
  PDFs["SMIC PDFs"] --> Extract["extract report rows"]
  Extract --> Warehouse["data/warehouse"]
  Prices["market and FX data"] --> Warehouse
  Warehouse --> Pit["export-pit-board"]
  Pit --> PitCsv["data/sim/pit-research-board.csv"]
  Warehouse --> Sim["run-sim / daily-forward"]
  Sim --> SimArtifacts["data/sim"]
  Warehouse --> WebExport["export-web"]
  SimArtifacts --> WebExport
  WebExport --> WebData["data/web"]
  WebData --> Next["apps/web static Next.js app"]
```

## Documentation

| Document | Purpose |
| --- | --- |
| [docs/product-spec.md](./docs/product-spec.md) | Product intent and priorities |
| [docs/data-artifact-policy.md](./docs/data-artifact-policy.md) | Committed data ownership and generated-cache policy |
| [docs/backtest-contract.md](./docs/backtest-contract.md) | Account, PIT, and no-lookahead contract |
| [docs/technical-architecture.md](./docs/technical-architecture.md) | Pipeline, artifact, and route map |
| [DESIGN.md](./DESIGN.md) | UI design system |

## Web App

The web app is a static reader over committed artifacts. It must not call live market APIs or reconstruct simulation logic in the browser.

Main routes:

- `/`
- `/portfolio`
- `/portfolio/[account]`
- `/portfolio/[account]/equity`
- `/portfolio/[account]/holdings`
- `/portfolio/[account]/trades`
- `/reports`
- `/reports/[symbol]/[reportId]`
- `/statistics`

## Validation

```bash
uv run ruff check src tests scripts
uv run pytest -q -m "not slow" -x
pnpm --dir apps/web artifact:check
pnpm --dir apps/web typecheck
pnpm --dir apps/web exec biome check .
pnpm --dir apps/web build
pnpm --dir apps/web smoke:static
```

`tests/test_web_artifacts.py` is a release-gate contract suite. It performs a full web export and should not be used as the default edit-test loop.

Deployment build, also cross-platform:

```bash
pnpm build
node scripts/prepare_vercel_prebuilt.mjs
```

## Project Layout

```text
apps/web/                  Static Next.js app
data/warehouse/            Normalized report, price, FX, and benchmark inputs
data/sim/                  Simulation outputs and PIT research board
data/web/                  Canonical static web artifacts
docs/                      Product, architecture, testing, and agent docs
scripts/                   Operational rebuild/refresh helpers
src/snusmic_pipeline/      Python package and CLI
tests/                     Pytest suite
```

## Current Contract

This repo is now intentionally PIT-first:

1. Build trustworthy point-in-time data.
2. Keep fixed baseline simulations for context.
3. Let future rule design happen explicitly, outside the pipeline, until buy/sell/sizing/rebalance rules are clearly declared.
