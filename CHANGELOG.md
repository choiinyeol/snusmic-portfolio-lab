# Changelog

All notable user-facing changes are tracked here. This project uses git tags as the release source of truth.

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
