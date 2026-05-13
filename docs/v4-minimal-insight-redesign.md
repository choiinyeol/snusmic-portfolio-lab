# V4 Minimal Insight Redesign

## User direction consolidated
- Move away from card walls and generic AI-dashboard scaffolding.
- Use a formal, minimal, button/list/table-led financial SaaS rhythm closer to YASUN.GG information density.
- Keep only investor-useful insight: target hit counts, near-target counts, wait-period hypotheses, momentum persistence, loser persistence, post-target holding questions, and portfolio risk/return context.
- Do not claim statistical significance until the corresponding artifact exists.
- Fix the portfolio default so the heatmap/ledger shows real holdings, not a cash-only or empty default.
- Use TradingView lightweight-charts for serious financial charting and add a risk/return frontier view.
- Delete obsolete guide interactivity and move type-only packages out of production dependencies.

## Product decisions
1. `/` is now a landing page; the app workspace starts at `/snapshot`.
2. The app overview is a decision brief: status strip, review queue, data-quality rows, and drilldown buttons.
3. The guide is no longer onboarding fluff. It is an evidence board with verified facts and explicit next statistical tests.
4. The screener is a single compact candidate list. Buckets are labels, not duplicated card sections.
5. The portfolio default prefers `smic_follower_v2` when open holdings exist, avoiding cash-only/empty heatmap behavior.
6. The portfolio page now adds a lightweight-charts cumulative return comparison and a risk/return frontier scatter.
7. Weak Prophet/oracle results are pushed out of default portfolio selector priority and labeled as non-investable upper-bound context.

## Remaining intentional constraints
- DaisyUI still exists because several legacy report/table/detail components depend on its classes. It should be removed only after those components are migrated to the shadcn/Radix/Tailwind primitives.
- Efficient frontier is currently a strategy risk/return frontier from available summaries, not a full asset-level optimizer. A real optimizer needs return/covariance/constraint artifacts.
- Waiting-period, post-hit drift, and momentum persistence should not be shown as conclusions until new artifacts and significance tests are generated.
