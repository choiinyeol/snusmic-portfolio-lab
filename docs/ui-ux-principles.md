# SNUSMIC Portfolio Lab UI/UX Principles

Last updated: 2026-05-13

This document is the durable product-design contract for `apps/web`. It translates the user's repeated UI/UX feedback into rules future changes must follow. The goal is not to copy YASUN.GG, Toss, Moneytoring, or Butler; it is to adapt their information density, scan rhythm, and financial-product clarity to SNUSMIC's static research-validation product.

## 1. Product frame

SNUSMIC Portfolio Lab is a **static snapshot-based investment research dashboard**.

It is:

- 리서치 추천 성과 검증
- share-based 포트폴리오 원장 뷰어
- 전략/백테스트 후보 실험실
- 커밋된 canonical artifact 기반 대시보드

It is not:

- 실시간 주문/체결 제품
- 브로커 대시보드
- live trading terminal
- Bloomberg/HTS clone
- black-box buy/sell recommender

Required visible language:

- `Static Artifacts`, `No live trading`
- `정적 스냅샷`, `커밋된 아티팩트 기준`
- `리서치 추천`, `포트폴리오 원장`, `전략 검증`
- `보고서 성과 기반 실험`, `가격 매칭`, `목표가 검증`

Avoid user-facing words that imply execution authority: `실시간 주문`, `체결 가능`, `지금 사라`, `수익 보장`, `라이브 거래`, `터미널`.

## 2. Information architecture ownership

Primary navigation stays:

```text
Overview → Portfolio → Research → Strategy → Screener
```

Each page owns one product question:

| Page | User question | UI responsibility |
| --- | --- | --- |
| Overview | “30초 안에 지금 상태가 좋은가?” | Project status, current portfolio, best strategy, latest research, key risks. |
| Portfolio | “무엇을 어떻게 샀고 지금 원장은 어떤가?” | Persona selector, holdings, trades, position lifecycle, report basis. |
| Research | “리포트가 실제로 맞았나?” | Target-price validation, post-publication return, hit status, ranking and archive. |
| Strategy | “어떤 후보 전략이 기준선을 이겼나?” | Candidate leaderboard, MWR/MDD/Sharpe/Sortino, benchmark excess, parameter sensitivity. |
| Screener | “지금 검토할 리서치 후보는 무엇인가?” | Explainable report-derived candidate filters, not a black-box score. |

A page should not duplicate another page's primary job. Link out instead.

## 3. Same data, one integrated view

When multiple views share the same underlying rows, do not split them into disconnected duplicate screens. Use one integrated table/list with:

- tabs for interpretation modes,
- filters for subsets,
- sorting for ranking,
- pagination for scale,
- saved/page-local state only when it improves scan speed.

Examples:

- Report rankings are views over `ReportRow`; use ranking tabs plus a single archive table.
- Portfolio holdings/trades should stay inside one persona-selected ledger context.
- Strategy candidates and benchmarks should share one leaderboard when the user is comparing them.

## 4. Table default contract

If a table can exceed roughly 20 rows, it should include these by default unless there is a documented exception:

1. Search/filter toolbar relevant to the row type.
2. Sortable headers for important columns.
3. Pagination or row-windowing.
4. Sticky header inside the table wrapper.
5. Numeric columns right-aligned with tabular numbers.
6. Long text clipped with title/tooltip or line-clamp.
7. Horizontal scroll contained inside the table wrapper, never page-level overflow.
8. CSV/export only when the current artifact semantics are clear.

Small ranking cards/lists may omit pagination only when they intentionally show a fixed top-N preview and link to the full table.

## 5. Card, panel, and density rules

The product should feel like a polished fintech SaaS dashboard: dense, clean, institutional, and readable.

- Use `PageHero`, `Section`, `KpiTile`, `DataTable/TableCard`, `Money`, `HoldingsTreemap`, and shared chart components before creating new shapes.
- KPI strips should be consistent height and resilient to long values.
- Feed rails should use compact items with right-aligned values.
- Cards should have one clear information role; do not stack unrelated meanings in one card.
- Use badges for state, not full-card red/green backgrounds.
- Use color for metric direction only; always include text labels so status is not color-only.

YASUN.GG is a reference for information density, cards, feed rails, treemap/heatmap emphasis, compact tabs, and market-dashboard rhythm — not a visual skin to copy.

## 6. Financial number rules

- Individual asset prices use native currency first; KRW is secondary only where relevant.
- Aggregate portfolio values are KRW.
- Return, MDD, target progress, and benchmark excess use percent formatting consistently.
- Table metric columns use right alignment and tabular numbers.
- Use `signedTextClass`, `numCellClass`, `formatKrw`, `formatPercent`, and `Money` rather than ad-hoc formatters.

## 7. Visual hierarchy and responsiveness

- Desktop: dense board layout, strong scan paths, stable chart heights.
- Tablet/mobile: stacked cards and table-internal horizontal scroll.
- No page-level horizontal overflow.
- Focus states must be visible.
- Treemaps/charts need captions or `aria-label` because they are visual summaries.
- Long Korean labels, strategy names, and company names must truncate/wrap gracefully.

## 8. Data/artifact integrity

`apps/web/lib/artifacts.ts` and derived product-model helpers remain the web source of truth.

- Do not add realtime fetches or live market APIs.
- Do not make `public/downloads` the source of truth.
- Missing optional fields render `—` or a polished empty state.
- Required schema drift should fail at the artifact boundary; do not add legacy/fallback/deprecated compatibility layers.
- Screener outputs must remain explainable from report fields such as recency, upside, target progress, target status, and price matching.

## 9. Strategy and screener ethics

Strategies and candidates are validation views, not instructions.

- Strategy page must keep the “보고서 성과 기반 후보 실험” disclaimer visible.
- Screener must not say “매수 추천” or imply execution.
- Risk warnings use badges such as `낙폭 점검 필요`, not alarmist full-card styling.
- No black-box score unless its ingredients and formula are visible.

## 10. Change acceptance checklist

Before shipping frontend UI changes, verify:

- [ ] App still says `SNUSMIC Portfolio Lab`.
- [ ] No user-facing “Terminal” framing was introduced.
- [ ] `Static Artifacts · No live trading` remains visible.
- [ ] Overview answers the product state in about 30 seconds.
- [ ] Tables with scale have sorting/filtering/pagination or a documented fixed-preview reason.
- [ ] Shared data is unified through tabs/filters, not duplicated into conflicting views.
- [ ] No external realtime data fetches were introduced.
- [ ] `pnpm --dir apps/web check`, `typecheck`, and `build` pass.
- [ ] Browser smoke finds no page-level horizontal overflow on core routes.
