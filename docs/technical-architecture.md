# Technical Architecture

Last updated: 2026-05-23
Status: canonical implementation map

## Boundary

Python owns collection, normalization, price refresh, simulation, strategy generation, and artifact export. The Next.js app is a static reader over committed artifacts.

No frontend route may call live market APIs or reconstruct simulation logic.

## Pipeline

```text
SMIC reports
  -> data warehouse
  -> price history
  -> strategy generation / daily forward
  -> account simulation artifacts
  -> web artifacts
  -> static Next.js pages
```

Primary commands:

| Command | Role |
| --- | --- |
| `python -m snusmic_pipeline sync` | Fetch reports and extract rows. |
| `python -m snusmic_pipeline refresh-market` | Build warehouse and refresh prices. |
| `python -m snusmic_pipeline daily-forward` | Advance the current core account path. |
| `python -m snusmic_pipeline generate-strategies` | Regenerate research/strategy artifacts. |
| `python -m snusmic_pipeline run-sim` | Run the package-owned account simulation. |
| `python -m snusmic_pipeline export-web` | Write `data/web` artifacts. |

## Artifact Contract

`data/web` is the frontend source of truth. `public/downloads` is a derived download surface, not a data source.

Important artifact groups:

| Path | Meaning |
| --- | --- |
| `manifest.json` | Snapshot timestamp, schema version, counts, checksums, and ranges. |
| `overview/*.json` | Snapshot, research pulse, and data-quality summaries. |
| `reports/*.json` | Report tables, rankings, return windows, and detail metrics. |
| `portfolio/*.json` | Ledger, holdings, trades, daily decisions, and equity paths. |
| `strategies/*.json` | Catalog, leaderboard, curves, taxonomy, and strategy metadata. |
| `prices/*.json` | Symbol price series for static charts. |

Schemas under `docs/schemas/*.schema.json` are generated contracts used by compatibility checks. Do not delete them unless the validation scripts are changed first.

## Routes

| Route | Job |
| --- | --- |
| `/` | Snapshot summary and entry points. |
| `/reports` | Report table, quality, and rankings. |
| `/reports/[symbol]` | Symbol-level report and price path evidence. |
| `/portfolio` | Account strategy overview. |
| `/portfolio/[strategy]/*` | Holdings, equity, trades, and methodology for one account. |
| `/strategies` | Strategy catalog and benchmark separation. |

Pages should be server-first. Client components are for charts, table controls, and small interactions only.

## Incremental Forward

`daily-forward` is the normal operating lane after new prices arrive. It may reuse checkpoints only when the persona config, price basis, and report basis still match. If those inputs change, run `generate-strategies` or `run-sim` instead of silently falling back.

## Validation

Baseline checks before claiming a code change:

```bash
uv run ruff check src scripts tests
uv run mypy src
uv run pytest -q -m "not slow"
pnpm --dir apps/web artifact:check
pnpm --dir apps/web typecheck
pnpm --dir apps/web exec biome check .
pnpm --dir apps/web build
```
