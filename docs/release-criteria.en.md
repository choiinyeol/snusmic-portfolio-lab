# v1.0.0 Release Criteria

`v1.0.0` is not just a version number for SNUSMIC Portfolio Lab. It is the statement that the PIT-first data product and static portfolio reader are ready to freeze as a public contract.

## Purpose

This document fixes:

1. what the product promises at `v1.0.0`
2. which artifact/reader/validator surfaces are frozen at RC1
3. how shortlist governance is enforced
4. when external shard mode is allowed
5. what the release gate must prove

## 1. Product declaration

The `v1.0.0` product is limited to:

- point-in-time SMIC report ingestion and normalization
- static web artifact export
- curated shortlist portfolio/account surfaces
- report verification, statistics, research calendar, and accounting reconciliation
- local-first static deploy with optional external shard support

Non-goals:

- live broker integration
- live market APIs
- automatic research-branch promotion
- future-looking signals
- backend-query-dependent UI behavior

## 2. RC1 freeze scope

RC1 freezes the **full live public surface** used by exporters, validators, readers, and shipped downloads.

### Core release metadata
- `data/web/manifest.json`
- `data/web/health.json`
- `data/web/report-health.json`
- `data/web/missing-symbols.json`

### Product account taxonomy and summary surfaces
- `data/web/accounts/catalog.json`
- `data/web/accounts/leaderboard.json`
- `data/web/accounts/curves.json`
- `data/web/accounts.json`
- `data/web/overview.json`
- `data/web/overview/snapshot.json`
- `data/web/overview/data-quality.json`
- `data/web/overview/research-pulse.json`
- `data/web/pages/portfolio-dashboard.json`
- `data/web/portfolio/accounts.json`
- `data/web/portfolio/holdings.json`
- `data/web/portfolio/monthly-holdings.json`
- `data/web/portfolio/trades.json`
- `data/web/portfolio/episodes.json`
- `data/web/portfolio/accounting-reconciliation.json`

### Portfolio shard contracts
- `data/web/portfolio/equity/index.json`
- `data/web/portfolio/daily-decisions/index.json`
- local shard files under those indexes
- external pointer contract when offload mode is enabled

### Report / statistics / calendar surfaces
- `data/web/reports.json`
- `data/web/reports/table.json`
- `data/web/reports/rankings.json`
- `data/web/reports/detail-metrics.json`
- `data/web/reports/return-windows.json`
- `data/web/reports/target-hit-distribution.json`
- `data/web/report-board/candidates.json`
- `data/web/report-statistics-lab.json`
- `data/web/pages/report-board.json`
- `data/web/pages/report-verification.json`
- `data/web/pages/report-statistics.json`
- `data/web/research-calendar/calendar.json`
- `data/web/pages/research-calendar.json`

### Download contracts
- `data/web/table-download-reports.csv`
- `data/web/table-download-accounts.csv`
- `data/web/data-quality-download.csv`

### Price contract
- `data/web/prices/*.json`

## 3. Code surfaces that must match the freeze

RC1 requires exact alignment across:

- `src/snusmic_pipeline/web/contracts.py`
- `src/snusmic_pipeline/web/artifacts.py`
- `src/snusmic_pipeline/cli.py`
- `apps/web/lib/schemas.ts`
- `apps/web/lib/artifacts.ts`
- `apps/web/lib/product-model.ts`
- `apps/web/lib/dashboard-view-model.ts`
- `apps/web/app/(app)/layout.tsx`
- `apps/web/app/(app)/portfolio/portfolio-view-model.ts`
- `apps/web/scripts/validate-artifacts.mjs`
- `apps/web/scripts/hydrate-external-artifacts.mjs`

## 4. Shortlist governance

The shortlist must be both human-readable and machine-enforced.

### Human-facing source
- `docs/product-spec.md`

### Machine-enforced source
- `data/sim/account-configs.json`
- `data/web/accounts/catalog.json`
Current decision:
- `v1.0.0` GA defaults to **local committed shards**.
- External shard mode stays implemented and tested, but it is not part of the default GA serving path unless RC2 or a later post-1.0 review re-approves it.
- Turning external mode on requires passing the optional GA contract below again.
- exporter-side shortlist and admission logic
- UI-side priority, selectability, follower exceptions, and objective-passing logic

Before RC1, all of these must agree.

### RC1 roster freeze

RC1 must freeze the **exact machine-visible product roster** rather than a speculative label list.

The human-facing description lives in `docs/product-spec.md`, but the executable roster is the intersection of:

- `data/sim/account-configs.json`
- `data/web/accounts/catalog.json`
- exporter-side shortlist/admission gates
- UI-side priority/selectability/objective-passing gates

Before calling the roster frozen, RC1 must reconcile those sources to one exact ID↔label table and treat that table as the release candidate roster.

### After RC1
- no new product account promotion except blocker fixes
- no oracle or research-memory outputs in the product catalog
- roster changes reset RC status

## 5. External shard policy

### RC1 default
- `external_artifacts = {}`
- release proof runs on local committed shards

### RC2 / optional GA external mode
If enabled, external mode must preserve:

- offload only:
  - `data/web/portfolio/equity/*.json`
  - `data/web/portfolio/daily-decisions/*.json`
- local summary/index/page/metadata artifacts remain committed
- required pointer fields:
  - `storage_key`
  - `checksum`
  - `size_bytes`
  - `row_count`
  - `public_url`
- hydrate → validate → build path
- explicit rollback to local shards

## 6. Release gate

Required gate:

```bash
uv run --locked python -m snusmic_pipeline export-web --check
pnpm --dir apps/web artifact:check
uv run --locked ruff check src tests scripts
uv run --locked pytest -q -m "not slow" -x
uv run --locked pytest tests/test_web_artifacts.py -q -x
uv run --locked mypy src
pnpm --dir apps/web typecheck
pnpm --dir apps/web exec biome check .
pnpm --dir apps/web build
pnpm --dir apps/web smoke:static
```

External mode adds:

```bash
pnpm --dir apps/web hydrate:external-artifacts
uv run --locked pytest tests/test_external_artifacts.py -q
```

## 7. RC sequencing

### RC1
- freeze full public contract
- freeze shortlist/admission surface
- verify local committed-shard path
- reconcile docs and generated artifacts

### RC2
- if needed, rehearse external shard mode
- prove hydrate / validate / build / rollback
- ratify the final serving mode

### GA
- bump to `1.0.0`
- regenerate final artifacts
- publish release notes
- pass the exact snapshot gate

## 8. Freeze rule

After RC1, only:
- bugfixes
- contract-preserving copy cleanup
- blocker fixes

Any artifact-shape, admission-logic, shortlist, or external-pointer semantic change resets RC status.

## 9. Definition of done

Maintainers should be able to say:

> SNUSMIC Portfolio Lab is a PIT-first static data product whose public artifact contract and curated shortlist governance are frozen, and whose release snapshot is reproducible under the approved local or external shard serving path.
