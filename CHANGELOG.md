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
