# SNUSMIC Portfolio Lab

[한국어 README](./README.md) - [Live site](https://smic-portfolio.vercel.app) - [Changelog](./CHANGELOG.md) - [Design system](./DESIGN.md)

SNUSMIC Portfolio Lab turns SMIC research reports into point-in-time datasets, account simulations, and static web artifacts. The current artifact refresh includes reports through `2026-05-29` and market closes through `2026-06-01`.

### What This Repo Does

- Collects SMIC report PDFs and extracted report rows.
- Normalizes reports, prices, FX, and benchmark data into `data/warehouse`.
- Exports a point-in-time research board at `data/sim/pit-research-board.csv`.
- Runs benchmark and follower simulations with cash, deposits, integer shares, fees, taxes, trades, holdings, and equity paths.
- Exports deterministic `data/web` JSON/CSV artifacts for the static Next.js app.
- Presents report verification, statistics, and account views through page-shaped frontend view models.

### Core Commands

```bash
uv sync --locked --group dev
pnpm --dir apps/web install --frozen-lockfile --prefer-offline
```

Refresh data and static artifacts:

```bash
uv run --locked python -m snusmic_pipeline refresh-web-artifacts
```

Full rebuild:

```bash
uv run --locked python -m snusmic_pipeline rebuild-web-artifacts
```

Export web artifacts only:

```bash
uv run --locked python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
```

### Web Routes

- `/`
- `/portfolio`
- `/portfolio/[account]`
- `/portfolio/[account]/equity`
- `/portfolio/[account]/holdings`
- `/portfolio/[account]/trades`
- `/reports`
- `/reports/[symbol]/[reportId]`
- `/calendar`
- `/statistics`

### Docs

| Korean | English | Purpose |
| --- | --- | --- |
| [docs/product-spec.md](./docs/product-spec.md) | [docs/product-spec.en.md](./docs/product-spec.en.md) | Product intent and priorities |
| [docs/data-artifact-policy.md](./docs/data-artifact-policy.md) | [docs/data-artifact-policy.en.md](./docs/data-artifact-policy.en.md) | Data ownership and generated-cache policy |
| [docs/backtest-contract.md](./docs/backtest-contract.md) | [docs/backtest-contract.en.md](./docs/backtest-contract.en.md) | Account, PIT, and no-lookahead contract |
| [docs/technical-architecture.md](./docs/technical-architecture.md) | [docs/technical-architecture.en.md](./docs/technical-architecture.en.md) | Pipeline, artifact, and route map |

### Validation

```bash
uv run --locked ruff check src tests scripts
uv run --locked pytest -q -m "not slow" -x
pnpm --dir apps/web artifact:check
pnpm --dir apps/web typecheck
pnpm --dir apps/web exec biome check .
pnpm --dir apps/web build
pnpm --dir apps/web smoke:static
```

### Current Contract

This repo is PIT-first: build trustworthy point-in-time data, keep benchmark and follower simulations for context, record promoted ideas in Markdown, and keep the product UI limited to a curated shortlist.
