# Portfolio Restructure Plan

Status: **proposal, not executed**
Owner: requires sign-off before applying

## Problem

`/portfolio/[strategy]` currently renders all strategy views (현재 보유, 일별 평가액, 매매내역, 방법론, …) inside a single page using `<Tabs>`. Switching views never changes the URL, so:

- Sub-views cannot be deep-linked or bookmarked
- Sub-views cannot own their own loading boundaries, metadata, or analytics
- The strategy never feels like a "thing with parts" — it feels like a tabbed dashboard
- Sidebar/breadcrumb cannot reflect which sub-view the reader is on

The user (2026-05-19) said: 「portfolio가 좀 더 객체로서 동작해야할 거 같습니다. 페이지 내에서 탭으로 전환되는 형식보다는 portfolio/<strategy> 이런식으로 더 계층적 페이지가 동작하고 고유의 파라미터들을 보유하고 소유하고 있는 데이터들도 있고 이런식으로.」

## Target architecture

```text
/portfolio                          → redirect to default strategy
/portfolio/[strategy]               → strategy overview (KPI strip + treemap + summary)
/portfolio/[strategy]/holdings      → current holdings table (owns: holdings.json filter, treemap, sort/filter UI)
/portfolio/[strategy]/equity        → daily equity time series (owns: equity_daily filter, chart controls)
/portfolio/[strategy]/trades        → trade ledger (owns: trades + episodes data)
/portfolio/[strategy]/methodology   → buy/sell rules + params (owns: catalog.params/rules)
```

Each strategy becomes a "thing":

- Owned URLs (one per sub-view)
- Owned data (each route reads only what it needs)
- Owned parameters (e.g. `?from=2024-01&to=2024-12` lives on `equity`, doesn't pollute other routes)
- Each sub-view has a clean prerender boundary at static export

A shared `layout.tsx` under `/portfolio/[strategy]` holds the strategy selector + sub-view nav (5 links) + active highlight, so all 5 routes share the persistent shell.

## Migration phases

1. **layout.tsx** — create `apps/web/app/(app)/portfolio/[strategy]/layout.tsx` with the strategy header (current title, KPI strip, selector) and the 5-tab-as-links nav rail. Page becomes the overview sub-route.
2. **Sub-routes** — create one folder/page per sub-view:
   - `holdings/page.tsx` reads holdings.json, calls existing `<PortfolioTables>` extracted
   - `equity/page.tsx` reads equity_daily.json, renders existing equity chart component
   - `trades/page.tsx` reads trades + episodes, renders `<TradesTable>`
   - `methodology/page.tsx` reads strategy catalog, renders rule/param cards
3. **PortfolioStrategyView decomposition** — break the monolithic component into per-sub-view components (`HoldingsView`, `EquityView`, `TradesView`, `MethodologyView`). The overview page composes summary tiles only.
4. **Static params** — `generateStaticParams` already exists; each sub-route reuses the same set.
5. **Navigation contract update** — DESIGN.md §6.2 already says strategy/benchmark rows open `/portfolio/[strategy]`. Extend the entry to surface the canonical sub-routes.
6. **Cleanup** — drop `<Tabs>` usage. Remove tab-related state. Remove the legacy `?strategy=` redirect after one release if any external links still exist.

## Backward compatibility

- `/portfolio` keeps redirecting to default strategy.
- `/portfolio?strategy=:id` → `/portfolio/:id` (keep a permanent redirect for a release or two).
- Existing in-app links pointing to `/portfolio?strategy=:id` (via `portfolioStrategyHref`) start emitting the new path immediately.

## Effort estimate

~3–4 commits:

1. layout + overview page
2. holdings sub-route
3. trades + equity sub-routes
4. methodology sub-route + cleanup

Each commit is independently shippable; build doesn't regress because the existing `page.tsx` keeps working until phase 4.

## Open questions

- Sub-view label set: stick with current Korean (현재 보유 / 일별 평가액 / 매매내역 / 방법론) or refine for noun-heavy 원장 톤?
- Overview page contents: KPI strip + treemap + recent trades feed, or just KPI strip + "보러 가기" link grid into sub-routes?
- 방법론 page: do we promote the strategy catalog row's `buyRules`/`sellRules`/`riskControls` to their own typography or keep current method card?
