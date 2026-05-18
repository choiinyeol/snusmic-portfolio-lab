# Changelog

All notable user-facing changes are tracked here. This project uses git tags as the release source of truth.

## Unreleased

### Added
- Preserve yfinance `Stock Splits` events in warehouse and web price artifacts as split/reverse-split diagnostics, including event type and ratio text.
- Add cumulative split factors and split-adjusted OHLCV fields without changing canonical simulation OHLC columns.
- Export `broker_strategy_trials.csv` from the broker-ledger strategy search and `strategy-admission.json` / `strategies/admission.json` for the web audit trail.

### Changed
- Rename promoted MTT-family strategies in user-facing web artifacts to behavior-based labels such as `Overseas Report Trend Broad #1`.
- Treat `MTT` as an internal trend filter/rule template, not the visible strategy name.
- Filter stale optional monthly holding rows that refer to retired personas while failing fast on stale required ledger artifacts.
- Make `report-statistics-lab.json` a deterministic exporter-owned artifact so report detail/statistics pages build after artifact refresh.
- Add spreadsheet-style per-column filters to `/screener` and hide reports older than two years by default while keeping an explicit expired filter.
- Add a collapsible desktop sidebar so wide data tables can use more horizontal space.
- Add a styled native select wrapper and use it in `/screener` filters to avoid clipped Korean option text.

## v0.21.2-command-palette.1 - 2026-05-18

### Added
- Add a global command palette to `AppShell`. Pressing `⌘K` / `Ctrl+K` opens a filtered list of in-app destinations (메인, 포트폴리오, 리포트, 후보 탐색, 리포트 통계, 전략, 가이드); the palette supports arrow-key navigation, Enter to open, and Esc to dismiss. Built on raw DOM elements with `role="listbox"` and `role="option"` so the static-export bundle stays free of any extra command-palette runtime.

### Changed
- Sort the `currentReturns` array once in `ReportStatisticsStory` and call a new `quantileFromSorted` helper for all seven percentile lookups, reducing 7×O(n log n) sorts per render to 1.
- Drop the unused `quantile()` helper now that all call sites flow through `quantileFromSorted`.
- Soften the `PageHero` h1 from `text-3xl/md:text-4xl tracking-[-0.045em]` to `text-2xl/md:text-3xl tracking-[-0.02em]` so Hangul glyph fitting stays clean and the heading no longer competes with the page's own data density.
- Restructure the `(app)/loading.tsx` skeleton so the KPI strip placeholder matches the actual page layout (`border-y` + `divide-x` columns) instead of rendering as bordered cards.

### Verified
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (413 static pages generated)

## v0.21.1-mobile-and-polish.1 - 2026-05-18

### Added
- Add a mobile drawer to `AppShell`: the sidebar is now a sliding overlay on `<lg` viewports with a hamburger toggle in the top header, a scrim that closes the drawer on tap, and an auto-close on route change. The mobile chrome also surfaces the brand mark + product name on the top bar so phone users always know which app they're in.
- Add a polished empty state to the `/reports` and `/screener` table bodies — when the active filter combination returns 0 rows, the table now shows a `SearchX` icon, an explanation of which filters can have over-narrowed the result, and a one-click "필터 초기화" button that resets the table back to its default preset.

### Changed
- Revert `formatKrw` back to raw comma-separated 원 (`12,345원`) per user direction. The earlier 억/만 chunking convention is removed; ledger pages, KPI tiles, and tooltips all display every digit again.
- Strengthen the `SidebarNav` active state from `bg-slate-100 ring-1 ring-slate-200` (≈1.15:1 contrast vs. hover) to `bg-slate-950 text-white` so the current page is always the highest-contrast item in the navigation column.
- Switch the `ReportsTable` `activeRowIdx` initial state from `0` to `null` so the first row no longer renders as "selected" before the user has touched `j`/`k`. The visual highlight only appears after the first navigation keystroke.
- Make the screener `Select` component generic (`Select<T extends string>`) and pass `as const` option arrays so the `SignFilter`, `BooleanFilter`, and `MaFilter` `onChange` casts at four call sites are eliminated and the option literals statically constrain the value type.
- Translate the screener column-pill labels in the active-filter chip row (`Ticker → 종목`, `Target Up → 상승여력`, `Gap → 목표 갭`, `Hit → 목표달성`, `Peak → 고점`, `Trough → 저점`, etc.) so the active-filter UI matches the Korean column headers.
- Hide the "컬럼 필터 0개" noise from the screener helper bar when the count is zero and add a `/` shortcut hint inline.
- Replace the screener "52W high" toggle's `<label>+<button>` dual-click area with a plain `<div>+<button>` (with `aria-pressed`) so the label text no longer pretends to be a clickable affordance.
- Switch the `AppShell` sidebar collapse animation from a width-only transition to `transition-[transform,width,padding]` so the desktop collapse and the mobile drawer slide share a single transition pass.

### Removed
- Remove the unused `useEffect`-based initial state hydration for `sidebarCollapsed` in favour of a lazy `useState` initialiser — the layout no longer flashes expanded-then-collapsed on hard reload.

### Verified
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (413 static pages generated)

## v0.21.0-product-density-i18n.1 - 2026-05-18

### Added
- Add `app/(app)/error.tsx` so the app shell renders a recoverable error state instead of a blank screen when a route's data parsing throws at runtime.
- Define a CSS fallback for the DaisyUI-style `badge`, `badge-ghost`, `badge-soft`, `badge-success`, `badge-error`, `badge-warning`, `badge-primary`, `badge-outline`, `badge-sm`, and `badge-xs` classes referenced by 30+ status pills across reports, screener, portfolio, strategies, and trades; status colour was previously rendering as unstyled text.
- Add `j` / `k` row navigation and `Enter` to open detail to the reports table so analysts can drive the queue from the keyboard end-to-end (`/` and `Esc` were already wired in the previous release).
- Add an explicit "no results" empty state row to both `/reports` and `/screener` when the active filter combination returns 0 rows.

### Changed
- Reformat KRW values via `formatKrw` so amounts ≥ 1억 render as `123억 4,568만원` and amounts ≥ 1만 render as `3,457만원`, matching Toss/Kakao Pay convention for at-a-glance reading. `formatKrw(value, { exact: true })` keeps the raw ledger form for places that need every digit.
- Translate the screener column headers (`Price → 현재가`, `Target Up → 상승여력`, `Gap → 목표 갭`, `Remain → 목표 잔여`, `Progress → 달성률`, `Current → 현재 수익률`, `Peak → 고점`, `Trough → 저점`, `Hit → 목표달성`, `Days → 도달일수`, `Exp → 만료`, `Vol → 거래량`, etc.), filter labels (`Return → 수익률 방향`, `Bucket → 후보 유형`, `MA → 이동평균`), section title, footnote, and metric captions to Korean.
- Apply `formatDateKo` on the reports table and portfolio holdings publication-date cells so dates stop leaking as raw ISO strings.
- Normalise every screener `Sparkline` to a shared "% return from first point" band (±30%) with a zero-return baseline so rows are visually rank-comparable instead of each rendering on its own auto-scaled axis.
- Memoise the screener `filteredRows` and route the search input through `useDeferredValue` so filter keystrokes stop re-sorting and re-filtering the full row set inside render, eliminating noticeable keystroke INP jank.
- Switch `AppShell`'s sidebar collapse state to a lazy `useState` initialiser so the desktop sidebar no longer flashes expanded-then-collapsed on every hard reload.
- Type the `HoldingsTreemap` d3 hierarchy with a `TreemapDatum` discriminated union and an `isLeafNode` type guard, eliminating three `as unknown as LeafNode[]` casts and restoring leaf-level type safety.
- Configure `next.config.ts` with `poweredByHeader: false`, `images: { unoptimized: true }` (consistent with `output: 'export'`), and `experimental.optimizePackageImports: ['lucide-react', 'd3']` so the lucide and d3 barrel imports tree-shake at build time.
- Drop the lightweight-charts attribution logo on the cumulative-return and price-evidence charts, hide vertical gridlines, and lighten horizontal gridlines (`#f1f3f6 → #f4f6f9`) so the data lines carry visual primacy.
- Set `KpiTile`'s `showToneBadge` default to `false` so the value's colour, not a redundant pill, communicates tone.
- Re-enable biome's `useExhaustiveDependencies` rule at `warn` level so future stale-closure exposure surfaces in lint output.
- Soften the `메인화면` h1 letter-spacing from `-0.045em` to `-0.02em` to respect CJK glyph fitting.

### Removed
- Delete the four non-functional `snapshot-pill` mode buttons ("전체 / 평가액 / 미실현 / 목표 진행") from the holdings treemap toolbar, since they were decorative affordances that did not switch the colour encoding.
- Stop rendering the `↕` unsorted indicator on every reports-table header glyph; the active `↑` / `↓` direction is still shown.

### Verified
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (413 static pages generated)

## v0.20.4-ui-density-a11y.1 - 2026-05-18

### Added
- Add `/` keyboard shortcut to focus the search input and `Esc` to clear it on `/reports` and `/screener` via a shared `useSearchShortcut` hook so analysts can drive filtering without leaving the keyboard.
- Add `app/(app)/loading.tsx` skeleton so route transitions inside the app shell never flash a blank screen, and `app/not-found.tsx` so broken or stale URLs return to the product instead of a bare static `404.html`.
- Add a top-level "본문으로 건너뛰기" skip link (WCAG 2.4.3) targeting `id="main-content"` on `<main>` so keyboard users bypass the sidebar on every page.
- Add an `sr-only` parallel DOM list of holdings inside `HoldingsTreemap` so screen-reader users get one accessible-name per cell (symbol, market value, weight, unrealized return) instead of a single canvas-wide label.
- Persist the desktop sidebar collapsed state in `localStorage('snusmic.sidebar-collapsed')` so the layout choice survives reloads.

### Changed
- Trim `apps/web/app/globals.css` from ~1110 lines to ~440 by deleting unused legacy classes (`.feed-*`, `.histogram*`, `.distribution-*`, `.stack-*`, `.bento-*`, `.metric-strip`, `.side-nav__*`, `.brand__*`, `.sidebar-card`, `.brand__mark` gradient) and removing decorative body radial gradients, `.lab-panel:hover translateY`, deep elevation shadows, and the gradient sidebar active-state.
- Lower the panel radius scale (`--radius-sm` 10→4, `--radius` 16→6, `--radius-lg` 22→8) so panels read as research artifacts, not consumer cards, per `DESIGN.md` §7.4.
- Raise the muted text colour `--faint` from `#8b95a1` to `#6a7480` so secondary text passes WCAG AA contrast on white (≈4.7:1 vs. ≈3.4:1) and switch `:focus-visible` outline to `--accent-strong` for SC 2.4.11 contrast.
- Standardize the `/main` overview's `border-t border-slate-950` accent to `border-t border-slate-200` so the editorial accent does not contradict the rest of the panel system.
- Replace the topbar's repeated product title and `backdrop-blur-xl` translucent header with a solid `bg-white` chrome strip; the sidebar logo already carries product identity.
- Mark sortable `<th>` cells in `/reports` with `aria-sort` and expose the filtered result count via `aria-live="polite"` so screen readers announce sort direction and filter changes.
- Auto-right-align any `table td.tabular-nums` cell so numbers in `PortfolioTables` and `ReportsTable` column-align without per-cell `text-right` retrofits.
- Replace `transition-duration: .01ms` in the `prefers-reduced-motion` block with `transition: none` so vestibular-sensitive users get a true motion-off experience.

### Removed
- Drop the dead `data-scroll-behavior="smooth"` HTML attribute from the root layout.

### Verified
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (413 static pages generated successfully)

## v0.20.0-screener-board.1 - 2026-05-18

### Added
- Added `/screener` to the existing `apps/web` Next.js app and sidebar navigation.
- Built a compact read-only stock board from `getReportRows()` as the primary symbol universe.
- Overlaid `getScreenerCandidates()` for candidate bucket, score, and rank basis instead of treating candidate rows as the full universe.
- Calculated price-derived board metrics from `getPriceSeries(symbol)`: last price, YTD return, 1Y return, 52-week high gap, 1Y sparkline, and 20/50/200 SMA status.
- Added compact presets and filters for recent reports, upside, near target, top returns, drawdowns, 52-week-high proximity, MA stack, caveats, and active target misses.

### Changed
- Compressed the screener table to avoid horizontal scrolling in the normal desktop view.
- Removed low-signal default columns from the board: exchange, report count, 1M, 3M, and RS 1M.
- Kept the screener distinct from `/reports`: `/reports` remains report validation, while `/screener` is a price-aware symbol review board.

### Not Added
- Did not invent market cap, P/E, P/S, sector, industry, or logo data because those fields are not present in canonical artifacts yet.

### Verified
- `pnpm --dir apps/web check`
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web build`
- `pnpm --dir apps/web artifact:check`
- Local smoke: `http://localhost:3000/screener/` returned 200.
