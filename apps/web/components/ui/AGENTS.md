# UI Primitives — Usage Rules

This folder holds the small set of components every page must reuse. The user has flagged repeated alignment/aesthetic regressions; the cure is *one* component per role used everywhere, not new per-page variants.

## When to use which

- **`PageHero`** — top of every page (`/`, `/reports`, `/strategies`, `/portfolio`, `/reports/[symbol]`). One short title, optional badges/actions/kpis. **No marketing copy.** Subtitle is optional and ≤1 sentence. Replaces ad-hoc `<section className="hero ...">` blocks.
- **`Section`** — every secondary block on a page. Accepts `eyebrow`, `title`, optional `caption` (≤1 sentence), `actions`. Don't recreate section headers inline.
- **`KpiTile`** — single KPI with label/value/delta/tone. Use for any "big number with subtitle" pattern. Don't roll inline `Metric` helpers.
- **`Money`** — every per-asset price. Native currency primary, KRW secondary. Aggregate KRW totals (portfolio NAV, fund summaries) may keep `formatKrw` directly.
- **`numCellClass` / `signedTextClass`** (from `@/lib/format`) — table number cells: `<td className={numCellClass}>` and signed coloring via `signedTextClass(value)`.

## Don't

- ❌ New `<section className="hero ...">` blocks. Use `PageHero`.
- ❌ Inline `<div>` "stat-like" cards built from raw legacy stats classes. Use `KpiTile`.
- ❌ `<span className="display-num">{formatKrw(price)}</span>` for an asset price. Use `<Money native krw currency>`.
- ❌ New custom CSS classes (`.muted`, `.panel`, `.dossier-card`, `.display-num`, `.display-1`, `.trend-*`). Use Tailwind utilities and local UI primitives.
- ❌ Marketing copy on internal pages ("…를 한 화면에서 검증합니다.", "수익률보다 …", "성과의 원인을 …").

## Number/currency rule

Per [`DESIGN.md`](../../../../DESIGN.md):

- US/JP/HK stock: USD/JPY/HKD primary, KRW secondary
- KR stock: KRW only
- Aggregate values (portfolio NAV, total contribution): KRW
- Never show only KRW for an overseas asset price.

`Money` enforces this; just pass `native`, `krw`, and `currency`.

## Tone tokens

When you need success/warn/error coloring on a number or badge:
- Tailwind: `text-emerald-600`, `text-rose-600`, `text-amber-600`, `text-blue-600`
- Don't introduce `.good` / `.bad` / `.warn` shortcut classes anywhere new (existing ones get cleaned in P-E).
