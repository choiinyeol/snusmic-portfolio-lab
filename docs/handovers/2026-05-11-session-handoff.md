# 2026-05-11 Session Handoff

## Current state

- Branch: `main`
- Latest pushed commit: `655b024 Move drag-measure badge to pane bottom to avoid OHLC legend overlap`
- GitHub Actions on `main`:
  - `web` (Vercel build) — green
  - `ci` — **1 pytest snapshot failing** (daily-rebalance change shifted v1 trade ledger; deployment unaffected; see "Known issues" below)
- Vercel production: `https://smic-portfolio-lab.vercel.app/` — green, latest deploy reflects this commit
- Working tree should be clean after this handoff commit. `.claude/` and `.omc/` are runtime artifacts.

## What this session delivered (rounds A → G + chart primitive)

The session worked through a 13-item user feedback list, refactored chart interactions to lightweight-charts native primitives, and locked down the data-boundary contract with zod.

### Round A — report-list & target metric polish (`3c7c8af`)
- Added `targetRemainingPct` (always non-negative — additional move needed to reach target) and `targetProgressPct` (capped 0..1) derived in `withTargetMetrics`.
- KPI tile no longer shows the misleading "잔여 업사이드 -38.80%" sign — now displays `+38.80%` with `달성률 60%` caption.
- `RankingTabs` got per-tab pagination (10/25/50/100), sortable headers, removed the 8-row cap. Renamed "목표가 괴리" → "도달까지 거리".
- Reports page hero now matches nav label: `RESEARCH` / `리서치 — 리포트 성과`.
- PDF buttons fall back to `report.pdfUrl` when `pdfFilename` is empty (221/221 reports get a working link).

### Round B — chart enhancements (`efe52fc`)
- Default visible range = ~1mo before to ~6mo after publication (was `fitContent`).
- Publication / expiry dates drawn as DOM-overlay vertical lines (later partially replaced — see "Outstanding work").
- MA20/60/200 right-axis titles stripped; values surfaced in a top-left floating legend.
- PathScenarioPanel header explicitly states "% = 이 가격에서 매수했다면 거두었을 수익률"; cards inline both 현재까지/목표까지 deltas; bars render two tracks.

### Round C — dashboard layout (`efe52fc`)
- Recent reports: `sm:grid-cols-2 lg:grid-cols-3` so 12 latest reports fit above the fold.
- `HoldingsTreemap` — initially CSS flexbox, later rewritten to d3-hierarchy + Canvas with HiDPI base/overlay layers and tooltip.

### Round D — portfolio strategy single-source-of-truth + daily timeline (`1c6f2c7`)
- Strategy state was duplicated across `PortfolioStrategyView` (URL-synced) and each inner table (own state). Inner selectors removed; persona is now passed as a prop from the outer view. URL is the sole source of truth.
- "월말 히스토리" tab replaced with new `DailyEquityHistory` driven by `getEquityDaily()` (1392 days × 5 personas) — 4 KPI tiles, CumulativeReturnChart, recent 30/90/180/365-day table.

### Round E — zod schema lockdown (`de583a2`)
- `apps/web/lib/schemas.ts` ships `z.object` shapes for reports, current-holdings, trades, equity-daily.
- `parseRows(label, schema, raw)` runs at the data boundary in `lib/artifacts.ts` — JSON drift in `snusmic_pipeline.web_artifacts` now fails the build with a path-aware error instead of silently coalescing to `null`.

### Round F — post-deploy review follow-ups (`e373ba7`, `2978201`)
- Archive 표에 "목표 잔여" + "달성률" 컬럼 + 진행 막대 추가.
- SmicFollower v1·v2 default rebalance cadence: `monthly` → **`daily`**. `_rebalance_days` got a `daily` branch (= every trading day). Result: v1 trades 2.6k → 30k, v2 trades 1.8k → 21k. CSV column header column also includes `expired`/`expiry_date` from earlier round.
- Drag refactored to use `chart.chartElement()` + `subscribeCrosshairMove` per official pattern.
- MA legend overlap fixed — separate MaLegend overlay removed; merged into OhlcLegend.
- Y axis price clamp `paddedMin = max(0, …)`.
- Holdings treemap rewritten on d3 + Canvas with HiDPI.
- `as LeafNode[]` cast → `as unknown as LeafNode[]` (Vercel's stricter TS check).
- Test `test_holdings_artifact_exposes_native_currency_for_foreign_positions` generalised to "any USD holding has native+KRW within sensible bounds" + QQQ (always held by all_weather).

### Round G — sort tie-break, block pagination, line clamp, scenario reorder (`1f2fc5c`)
- `RankingTabs` adds `publicationDate desc` tie-breaker on every sort, and "최근 발간" tab defaults to `sortBy: 'publicationDate'`.
- New shared `BlockPagination` (`‹‹ ‹ 1 2 3 4 5 › ››`). Applied via `PaginationControls` → automatically benefits PortfolioTables / PortfolioHistory / TradesTable / StrategyExperimentTables. `RankingTabs` uses it directly.
- Vertical lines hidden when `timeToCoordinate(x)` is outside `[0, width]` (no more `left: -351px` ghosts).
- PathScenarioPanel reordered: 발간 후 고점 → 75% → 25% → 발간 후 저점 → 현재가 for a "level up" visual.

### Chart measure-mode pane primitive (`d86b38e` → `655b024`)
Five iterations: Shift+drag → toggle button → DOM overlay drag rect → transparent overlay capture div + wrapper → **lightweight-charts `IPanePrimitive`**.

Final shape:
- `apps/web/components/charts/dragSelectionPrimitive.ts` — implements `IPanePrimitive<Time>` with `paneViews()` returning a renderer that draws the band + label using `target.useMediaCoordinateSpace`.
- React renders a transparent overlay div for pointer capture; primitive owns all canvas drawing. Result: the band aligns with candles pixel-perfectly under pan/zoom.
- Badge anchored to the bottom of the candle pane to avoid the OHLC HTML legend at the top-left.

## Known issues / carry-overs

| # | Item | Severity | Notes |
|---|---|---|---|
| 1 | `ci` workflow's pytest has 1 snapshot mismatch | low | Daily rebalance shifted v1 trade ledger; the failing test pins specific trade objects. **Deployment is unaffected** because the `web` workflow is independent. Either update the snapshot fixture or relax the assertion to count-based. |
| 2 | `data/strategy_search/*` artifacts are stale | medium | Generated under monthly-rebalance + pre-expiry semantics. Run `uv run python scripts/run_optuna_search.py` (expensive) to regenerate when ready. |
| 3 | Publication / expiry vertical lines still DOM-based | low | Could also become `IPanePrimitive` for visual cohesion with the drag band. The current DOM lines work but only display when `0 ≤ x ≤ width`. |
| 4 | No regression test pinning the new daily-rebalance behavior | low | Add a test that asserts `len(smic_follower_v2 trades) > 10_000` and `v1 trades > 20_000` so a future monthly-default regression is caught. |
| 5 | zod schemas cover only 4 entities | low | Extend to `monthly-holdings`, `position-episodes`, `summary`, `report-rankings` for full coverage. |
| 6 | UI verification was WebFetch-only | low | No Playwright e2e for chart drag-to-measure / canvas treemap interaction. |
| 7 | `StrategyExperimentTables` uses its own pagination state | low | Already migrated indirectly via `PaginationControls`. But its internal sort/page reset behavior wasn't audited end-to-end. |
| 8 | Treemap doesn't reposition tooltip on chart resize | low | If the user resizes the window while hovering, the tooltip stays at last x/y. Cheap to fix. |
| 9 | "측정 모드" toggle has no onboarding hint after first reveal | low | Users may not discover it; consider a one-time tooltip or making the band wider/dimmer to suggest interactivity. |
| 10 | `PriceEvidencePanel` KPI tile "목표가까지 추가 상승" tone | low | Always `warn` for not-yet-hit; could go `bad` when `expired`. |
| 11 | v1 daily-rebalance produces 30k+ trades | medium | TradesTable paginates but the initial sort over 30k rows happens client-side. Consider server-side filtering or stricter default sort/limit. |
| 12 | `RankingTabs` "도달까지 거리" tab does not include downside reports | low | Filter is `targetUpsideAtPub > 0`; downside (매도 의견) reports never appear here. Could be intentional, but the UI doesn't say so. |

## Suggested next-session priorities

In rough order of value/risk:

1. **Fix `ci` pytest snapshot** so green CI is the floor again. Either:
   - regenerate the snapshot fixture, or
   - relax the assertion to row-count / structural invariants instead of pinning specific trades.
2. **Add daily-rebalance regression test** (item 4) — single Python test that locks in the new default.
3. **Re-run optuna** for strategy_search so the `/strategies/[runId]` pages reflect daily rebalance + 730d expiry, not the stale monthly-pre-expiry state.
4. **Promote vertical lines to `IPanePrimitive`** (item 3). The drag-selection primitive already proves the pattern works.
5. **Extend zod coverage** (item 5) — 4 more loaders, mechanical refactor.
6. **Playwright e2e** (item 6) — at minimum a smoke test that:
   - report detail page renders chart,
   - measure-mode toggle activates,
   - dragging fires the band overlay.

## Key files touched this session

```
apps/web/
  app/page.tsx                       # recent-reports grid
  app/portfolio/page.tsx             # equity-daily wiring
  app/reports/page.tsx               # RESEARCH/리서치 hero
  app/reports/[symbol]/page.tsx      # pdfHrefFor fallback, full-history chart
  components/charts/
    PriceEvidenceChart.tsx           # 6mo zoom, MA legend, vertical lines, measure mode + overlay + primitive bridge
    dragSelectionPrimitive.ts        # NEW — IPanePrimitive drag-measure renderer
  components/reports/
    PathScenarioPanel.tsx            # header copy, level-up reorder, two-track bars
    RankingTabs.tsx                  # pagination, sortable, tie-breaker
    ReportsTable.tsx                 # 목표 잔여 + 달성률 columns
    PriceEvidencePanel.tsx           # targetRemainingPct + 달성률 caption
  components/trading/
    DailyEquityHistory.tsx           # NEW — replaces PortfolioHistory
    HoldingsTreemap.tsx              # d3 + canvas
    PortfolioStrategyView.tsx        # persona prop drilling
    PortfolioTables.tsx              # inner-strategy selector removed
    PortfolioHistory.tsx             # inner-strategy selector removed
    TradesTable.tsx                  # inner-strategy selector removed
    TableControls.tsx                # BlockPagination + PaginationControls
  lib/
    artifacts.ts                     # withTargetMetrics + zod parseRows + EquityPoint loader
    schemas.ts                       # NEW — zod schemas for 4 entities
    format.ts                        # formatPercent default digits=2; remove formatKrwMillions
  app/globals.css                    # block-pagination, .tabs override removed
src/snusmic_pipeline/sim/
  contracts.py                       # report_expiry_days, daily literal, daily default
  personas/smic_follower.py          # _rebalance_days daily branch
  report_stats.py                    # expiry_days window cap
tests/test_web_artifacts.py          # 12 tests including expired-report regression
data/web/*.json                      # refreshed from sim (daily rebalance)
data/sim/*.csv                       # refreshed from sim
docs/frontend-product-direction.md   # §9 리포트 라이프사이클 / 만료 정책
```

## Environment / commands

- Web build: `cd apps/web && pnpm build`
- Python regression: `uv run pytest tests/test_web_artifacts.py`
- Sim regenerate: `uv run python scripts/run_persona_sim.py`
- Web export: `uv run python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web --extraction-quality data/extraction_quality.json`
- Deploy: `git push origin main` — Vercel `web` workflow auto-deploys.

## Memory rules in force this session

- No fallbacks/workarounds — raise errors instead.
- Static export deploy stays; no BFF migration.
- Public artefacts use GitHub raw URLs only.
- KRW is displayed in full digits (no 만원/억원), `formatPercent` default 2 decimal places.
- Reports expire 730 days after publication; v1/v2 followers force-close at that point and the report shows a 만료 badge.
