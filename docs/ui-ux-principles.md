# SNUSMIC Portfolio Lab UI/UX Principles

Last updated: 2026-05-15

This document is the durable product-design contract for `apps/web`. It translates the user's repeated UI/UX feedback into rules future changes must follow. The goal is not to copy YASUN.GG, Toss, Moneytoring, or Butler; it is to adapt their information density, scan rhythm, and financial-product clarity to SNUSMIC's static research-validation product.

## 1. Product frame

SNUSMIC Portfolio Lab is a **read-only investment research and portfolio validation dashboard**.

It is:

- 리서치 추천 성과 검증
- share-based 포트폴리오 원장 뷰어
- 벤치마크 대비 원장형 전략 검증
- 가격 확인이 끝난 기준 데이터 기반 대시보드

It is not:

- 실시간 주문/체결 제품
- 브로커 대시보드
- live trading terminal
- Bloomberg/HTS clone
- black-box buy/sell recommender

Preferred user-facing language:

- `기준 데이터`, `읽기 전용`
- `리포트 검증`, `포트폴리오 원장`, `전략 비교`
- `가격 확인`, `목표가 진행`, `낙폭 점검`

Avoid user-facing words that imply execution authority: `실시간 주문`, `체결 가능`, `지금 사라`, `수익 보장`, `라이브 거래`, `터미널`.

Implementation words such as `Static Artifacts`, `canonical`, `schema`, `data/web`, or `커밋된 아티팩트` belong in technical/data-quality documentation, not in primary SaaS copy.

## 2. Information architecture ownership

Primary navigation follows the current app shell labels:

```text
메인화면(/main) → 포트폴리오(/portfolio) → 리포트(/reports) → 리포트 통계(/reports/statistics) → 전략(/strategies) → 가이드(/guide)
```

Each page owns one product question:

| Page | User question | UI responsibility |
| --- | --- | --- |
| 메인화면 | “30초 안에 지금 상태가 좋은가?” | Review queue, portfolio state, report-statistics entry points, data caveats. |
| 포트폴리오 | “무엇을 어떻게 샀고 지금 원장은 어떤가?” | Persona selector, holdings, trades, position lifecycle, report basis. |
| 리포트 | “리포트가 실제로 맞았나?” | Target-price validation, post-publication return, hit status, unified sortable table, candidate presets. |
| 리포트 통계 | “전체 표본에서 어떤 규칙을 검정할 수 있나?” | Fat-tail distribution, target multiples, path pain, delayed-entry/post-hit hypotheses. |
| 전략 | “어떤 고유 전략이 기준선을 이겼나?” | Benchmark set vs selectable broker-ledger strategies, MWR/MDD/Sharpe/Sortino, benchmark excess. |
| 가이드 | “이 데이터를 어떻게 해석해야 하나?” | Methodology, caveats, navigation shortcuts, and read-only framing. |

A page should not duplicate another page's primary job. Link out instead.

## 3. Same data, one integrated view

When multiple views share the same underlying rows, do not split them into disconnected duplicate screens. Use one integrated table/list with:

- tabs for interpretation modes,
- filters for subsets,
- sorting for ranking,
- pagination for scale,
- saved/page-local state only when it improves scan speed.

Examples:

- Report rankings are views over `ReportRow`; use one shared-column table whose presets only change sort/filter state.
- Portfolio holdings/trades should stay inside one persona-selected ledger context.
- Benchmarks and selectable strategies may share one comparison board, but must be visually labeled and semantically separated.

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

Page-owned artifacts and shared domain readers remain the web source of truth. `apps/web/lib/product-model.ts` should not become a second database or invent taxonomy locally.

- Do not add realtime fetches or live market APIs.
- Do not make `public/downloads` the source of truth.
- Missing optional fields render `—` or a polished empty state.
- Required schema drift should fail at the artifact boundary; do not add legacy/fallback/deprecated compatibility layers.
- Screener outputs must remain explainable from report fields such as recency, upside, target progress, target status, and price matching.

## 9. Strategy and screener ethics

Strategies and candidates are validation views, not instructions.

- Strategy page must separate benchmarks from selectable broker-ledger strategies.
- Screener must not say “매수 추천” or imply execution.
- Risk warnings use badges such as `낙폭 점검 필요`, not alarmist full-card styling.
- No black-box score unless its ingredients and formula are visible.

## 10. Change acceptance checklist

Before shipping frontend UI changes, verify:

- [ ] App still says `SNUSMIC Portfolio Lab`.
- [ ] No user-facing “Terminal” framing was introduced.
- [ ] Primary copy says read-only/basis data in user language, not developer artifact language.
- [ ] 스냅샷 화면이 제품 상태를 약 30초 안에 설명한다.
- [ ] Tables with scale have sorting/filtering/pagination or a documented fixed-preview reason.
- [ ] Shared data is unified through tabs/filters, not duplicated into conflicting views.
- [ ] No external realtime data fetches were introduced.
- [ ] `pnpm --dir apps/web check`, `typecheck`, and `build` pass.
- [ ] Browser smoke finds no page-level horizontal overflow on core routes.
