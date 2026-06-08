# Enfusion-style SNUSMIC UX cleanup

## ADR
- Decision: Execute Option A. Keep the five-job route map (Board, Reports, Portfolio, Calendar, Statistics) and rebuild each route around one operator question while deleting wrapper sprawl and heuristic account-taxonomy logic.
- Drivers: faster audit flow; lower UI/view-model entropy; preserve static-export reliability with exporter-owned contracts.
- Alternatives considered:
  - Option B: demote Statistics from top nav. Rejected because it conflicts with the required five-job nav spine.
  - Option C: cosmetic refresh on current shapes. Rejected because it leaves duplicate report flows, wrapper sprawl, and heuristic portfolio taxonomy handling alive.
- Why chosen: lowest route-risk path that still materially shrinks the product into a denser research workstation.
- Consequences: requires coordinated slice-zero contract work across report ledgers, portfolio route models, and exported account taxonomy metadata before route JSX cleanup.
- Follow-ups: remove every remaining direct `strategyMeta` taxonomy caller during execution and keep the taxonomy payload compact and producer-owned.

## Scope
- In: `apps/web/**` routes, components, view-models, nav labels, artifact/schema/reader touchpoints needed for the UX cleanup, verified-unused web wrappers, route docs/spec text affected by route retirement.
- Out: simulation logic changes, live data, design-system rewrite, dark mode, AI-summary fluff, landing-page marketing.

## Route contract
| Route | Operator question | Retained surface | Delete or merge | Acceptance | Verification |
| --- | --- | --- | --- | --- | --- |
| Board | What needs attention today across reports and the primary book? | One compact shell: health row, top-of-queue report-ledger subset, primary-book risk monitor. | Delete the current briefing stack and any second report-table implementation. | Board uses the canonical report-ledger subset only and no route-local report row mapping remains. | `pnpm --dir apps/web check`; `pnpm --dir apps/web typecheck`; `pnpm --dir apps/web build`; `pnpm --dir apps/web smoke:static`; visual review of `/`. |
| Reports | Which report should I audit next, and why? | Full canonical report ledger with sorting, filtering, drilldown. | Delete wrapper stacking around the same ledger and remove `PageHeader`, `MetricStrip`, `Section` chrome. | Reports is the only full-report ledger page and shares the same contract and renderer as Board. | same as Board plus verify sort/filter/drilldown. |
| Report detail | Can I verify this report from source to outcome quickly? | One `PageHero`, one KPI grid, one audit rail, one price-path surface. | Merge trust/source layers; replace reusable-looking `FactsTable` with the chosen KPI/fact approach. | User sees source links, stage, key prices, and price path without duplicate status panels. | web check/typecheck/build + focused report-detail review. |
| Portfolio | Which books deserve attention or drilldown? | Table-first roster ranked by objective status and benchmark excess, with optional comparison chart secondary. | Delete row-level `comparisonPrompt` prose and repetitive role storytelling. | Roster rows are numeric and comparative; objective status and benchmark excess are visible without prose. | web check/typecheck/build + visual review of `/portfolio`. |
| Account overview | What is the current state of this book right now? | One `PageHero`, one compact KPI grid, one benchmark/equity chart, one top-holdings preview, one recent-trades preview, one compact artifact-fed rule/taxonomy block. | Delete embedded full holdings/trades ledgers, anchor-nav chrome, repeated prose, and heuristic taxonomy helper usage. | Overview keeps exactly one compact taxonomy block sourced from exported account catalog metadata, not account-id heuristics. | web check/typecheck/build + artifact contract verification for taxonomy fields + visual review. |
| Holdings | Where is risk and capital allocated? | Full holdings ledger in `DataPanel` with weights and risk-relevant columns. | Delete narrative summary when it only repeats table totals. | Holdings is the authoritative full holdings ledger and includes per-position weight. | web check/typecheck/build + verify weight and linked-target columns. |
| Trades | What changed in the book, when, and why? | Full trade ledger in `DataPanel` with sorting and filtering. | Delete big-trade cards and reason-bucket storytelling. | Trades is the authoritative full trade ledger and no secondary storytelling remains above the ledger. | web check/typecheck/build + verify sort/filter/drill links. |
| Equity | Retired and folded into account overview because overview already owns the benchmark/equity state question. | Retain the benchmark and equity chart on account overview. | Delete `app/(app)/portfolio/[account]/equity/page.tsx` and remove any nav/link/doc entry treating equity as a separate page. | No dedicated equity route file, link, or route-doc entry remains. Account overview contains the canonical equity chart. | web check/typecheck/build + static smoke and route-doc update. |
| Calendar | What was knowable on a selected date, and how did those candidates resolve? | One compact date selector plus one selected-date audit ledger. | Replace month-card sprawl with a compact selector/list and reduce default visible analytical columns. | Default calendar view uses one compact date-control block and a ledger with at most 8 analytical columns beyond identity and notes. | web check/typecheck/build + visual review that default layout fits desktop without sprawl. |
| Statistics | What does the sample say about opportunity, concentration, and failure shape? | One compact header, one executive summary, one concentration block, one whole-sample map, one winners/losers block, and up to two representative path sections. | Delete long explanatory duplication and remove empty `featureBuckets` / `confirmationSignals` surfaces. | Statistics renders only the retained section set and no empty `featureBuckets` or `confirmationSignals` blocks. | web check/typecheck/build + visual review of section count and empty-surface removal. |
| Navigation | Which job am I doing? | Board, Reports, Portfolio, Calendar, Statistics as plain job labels. | Delete inward-facing operational labels. | Top nav labels/descriptions are job-based and map directly to route questions. | web check/typecheck + command-palette + visual review. |

## Mandatory slice zero
No route redesign starts before all three contract moves land:
1. one canonical report-ledger contract for Board and Reports
2. portfolio base and supplement route-model split instead of the monolithic `PortfolioViewModel`
3. artifact-fed account taxonomy contract exported through account catalog and consumed by account overview

## Taxonomy contract
- Source of truth: exported account metadata in the account catalog contract.
- Explicitly forbidden as taxonomy source: `strategyMeta(accountId)` and any other web-local account-id prefix/substring inference.
- Exporter and schema touchpoints:
  - `src/snusmic_pipeline/web/artifacts.py`
  - `src/snusmic_pipeline/web/contracts.py`
  - `data/web/accounts/catalog.json`
  - `apps/web/lib/schemas.ts`
  - `apps/web/lib/artifacts.ts`
  - `apps/web/app/(app)/portfolio/portfolio-view-model.ts`
  - `apps/web/components/trading/portfolio-views/types.ts`
  - `tests/test_web_artifacts.py`
- Required payload shape: compact role/category, compact title, compact subtitle or one-line intent, compact comparison prompt/review question, optional benchmark or peer framing when already known at export time.

## Primitive decisions
- Keep `PageHero` for route headers only; delete `PageHeader`.
- Keep `KpiTile` for summary metrics only; delete `MetricStrip` and rebuild summary strips on KpiTile grids.
- Keep `DataPanel` for ledger panels only; do not wrap it in extra `Section`/header chrome. Delete `ui/Panel.tsx` if unused.

## Cleanup targets
Delete after migration or verification:
- `apps/web/components/ui/PageHeader.tsx`
- `apps/web/components/ui/MetricStrip.tsx`
- `apps/web/components/trading/portfolio-views/PortfolioAccountFrame.tsx`
- `apps/web/app/(app)/portfolio/[account]/equity/page.tsx`
- `apps/web/components/trading/portfolio-views/strategy-display.ts` as taxonomy source of truth
- heuristic `shortlistMetadata` logic in `apps/web/app/(app)/portfolio/portfolio-view-model.ts`
- verified-unused if caller search stays empty: `components/ui/Panel.tsx`, `components/ui/DataTable.tsx`, `components/ui/Tabs.tsx`, `components/charts/PerformanceChartPanel.tsx`, `components/report-board/report-board-table.tsx` `ReviewTable`

## Release slices
0. Contract and model consolidation hard gate
1. Shared primitives and nav rename
2. Board and Reports workstation pass
3. Report-detail audit pass
4. Portfolio IA pass including equity-route retirement and route-doc/static-smoke updates
5. Holdings and Trades cleanup
6. Calendar compression
7. Statistics compression and dead-code purge

## Acceptance criteria
1. Exactly one shared report-ledger contract and one shared renderer back Board and Reports.
2. Board contains only a filtered/ranked subset of the canonical report ledger and no second full report-table implementation.
3. Reports is the only full-report ledger page.
4. Overview, Holdings, and Trades no longer depend on one monolithic `PortfolioViewModel` carrying unrelated payloads.
5. Account overview retains exactly one compact taxonomy block.
6. That taxonomy block is sourced from exported account catalog metadata and not from `strategyMeta(accountId)` or any other web-local account-id heuristic.
7. Account catalog exporter, Python contract, web schema, artifact reader, and portfolio view-model all expose matching taxonomy fields.
8. No dedicated equity route file, link, or route-doc entry remains.
9. Holdings is the only full holdings ledger for an account.
10. Trades is the only full trades ledger for an account.
11. Default calendar view uses one compact date selector block and a ledger with at most 8 analytical columns beyond identity and notes.
12. Statistics renders only the retained section set and no empty `featureBuckets` or `confirmationSignals` blocks.
13. `PageHeader` and `MetricStrip` are removed; `PageHero`, `KpiTile`, and `DataPanel` remain with single roles.
14. Every new field is traceable to existing artifacts or deterministic derivation only.
15. Each listed cleanup candidate is either deleted or referenced by a remaining caller verified by import search and typecheck.

## Verification
- Per slice: `pnpm --dir apps/web check`; `pnpm --dir apps/web typecheck`
- When route rendering or export changes: `pnpm --dir apps/web build`; `pnpm --dir apps/web smoke:static`
- When artifact/view-model contracts change: `pnpm --dir apps/web artifact:check`; `uv run pytest tests/test_web_artifacts.py -q -x`
- Focused taxonomy-contract verification:
  - `data/web/accounts/catalog.json` contains compact taxonomy fields for selectable portfolio accounts
  - `src/snusmic_pipeline/web/contracts.py` and `apps/web/lib/schemas.ts` define matching fields
  - `apps/web/lib/artifacts.ts` exposes those fields without fallback heuristics
  - `apps/web/app/(app)/portfolio/portfolio-view-model.ts` builds the overview taxonomy block from catalog data only
  - no remaining caller uses `strategyMeta(accountId)` or account-id substring decoding for taxonomy meaning
- UI review: screenshot/browser review for `/`, `/reports`, report detail, `/portfolio`, account overview, holdings, trades, calendar, statistics; confirm command-palette targets still match the final route map.

## Status
Completed and verified for release.
