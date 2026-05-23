# Frontend Design System

## Design Personality

This app is a professional trading and portfolio analytics workspace.

The UI should feel:

- Calm
- Dense
- Precise
- Data-first
- Fast to scan
- Institutional fintech
- Modern Korean brokerage inspired, without cloning any product

It should not feel like a generic SaaS marketing dashboard or a toy app.

## Stack

Use the existing stack:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Local shadcn-style components
- Radix primitives where available
- lucide-react
- TanStack Table for complex tables
- lightweight-charts for market and portfolio charts

Do not introduce MUI, Ant Design, random CSS modules, or one-off component systems.

## Layout

Use compact analytical layouts:

1. Header: title, subtitle, primary action, status metadata
2. Summary strip: 4 to 8 key metrics
3. Main content: chart/table/detail panels
4. Secondary content: signals, logs, diagnostics, quality metadata

Avoid centered marketing heroes, huge whitespace, decorative illustrations, and oversized cards on analytical pages.

Report and statistics pages should be decision-first:

1. What changed or what matters.
2. What should be inspected first.
3. What evidence supports that priority.
4. What raw detail remains available below.

## Typography

- Page title: `text-2xl` to `text-3xl`, `font-semibold`
- Section title: `text-base` to `text-lg`, `font-semibold`
- Body: `text-sm`
- Metadata: `text-xs text-slate-500`
- Financial numbers: `font-mono` and `tabular-nums`

Use strong hierarchy, but keep dashboard text compact.

## Spacing

Use predictable spacing:

- `gap-2`: tight inline groups
- `gap-3`: compact card internals
- `gap-4`: normal section internals
- `gap-6`: major dashboard grouping
- `gap-8`: large page separation

Avoid random spacing unless the layout has a concrete reason.

## Surfaces

Default analytical surface:

- `rounded-md` for dense analytical panels
- `border border-slate-200`
- `bg-white`
- No heavy shadows

Repeated item cards may use subtle border accents. Do not put cards inside cards.

## Color

Use restrained semantic color:

- Slate for structure and text
- Emerald for positive outcomes
- Red for losses or danger
- Amber for review or caution
- Blue/indigo only for neutral emphasis or data status

Do not add arbitrary hex colors inside components unless they are chart palette constants.

## Copy

Public UI copy should explain value plainly:

- Good: "같은 기준일로 리포트, 가격, 계좌 기록을 맞춰 봅니다."
- Bad: "PIT 보드"
- Good: "리포트 신호가 이후 가격 경로에서 어떤 기회와 손실을 만들었는지 봅니다."
- Bad: "분석 아티팩트 행을 렌더링합니다."

Internal docs may use technical terms, but product screens should not lead with jargon.

## States

Every data component should deliberately handle empty and partial data. Loading and error states are required for client-fetched or async surfaces.
