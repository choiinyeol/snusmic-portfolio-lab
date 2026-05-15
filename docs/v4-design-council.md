# V4 Design Council — Decision Brief Redesign

Date: 2026-05-15
Branch: `redesign/v4-formal-ui-kit`

## Council outcome

The previous overview failed because it was a compressed copy of every downstream page. It showed many valid data blocks, but did not answer the investor's first question: **what needs attention today?**

V4 changes the product stance from “dashboard of available artifacts” to **Decision Brief**:

1. **Main / 메인화면** answers: current state, review items, activation candidates, data caveats.
2. **Portfolio / 원장** owns holdings, cash, treemap, trades, position evidence.
3. **Research Inbox / 리포트 검증** owns report validation and candidate filters.
4. **Strategy Lab / 전략 비교** owns benchmarks, strategy risk-return, drawdown, and future efficient-frontier work.
5. **Guide/Data quality** owns methodology and implementation caveats.

## Decisions adopted

### 1. Overview is no longer a mini-dashboard

Remove from `/`:

- full treemap,
- full strategy leaderboard,
- full performance chart,
- current holdings table,
- mixed activity tape,
- duplicated candidate cards.

Keep only:

- state strip,
- decision queue,
- portfolio risk snapshot,
- research quality / exclusions,
- changed-since-snapshot facts,
- drilldown launchers.

### 2. Korean, literal copy only on primary surfaces

Avoid English dashboard cosplay:

- Do not use `Portfolio research console`, `Strategy leaderboard`, `Activity tape`, `Review candidates`, `No active positions`.
- Prefer `스냅샷`, `원장 상태`, `확인할 항목`, `재검토 후보`, `리포트 품질`, `데이터 점검`.

### 3. Single formal UI system

V4 uses a shadcn-style component layer:

- `Button`, `Card`, `Badge`, `Table`, `Progress`, `Separator`, `cn()`.
- Geist Sans/Mono for interface and tabular numbers.
- Lucide icons.
- Tailwind utilities at call sites instead of new global CSS.

`daisyUI` is no longer a runtime dependency. New V4 surfaces should not add `btn`, `badge`, `lab-panel`, `archive-*`, or page-specific global classes.

### 4. No fake signal language

- Historical trades are not live `BUY` signals.
- Candidates are not recommendations.
- Weak Prophet/oracle baselines must not compete with investable strategies in first-glance surfaces.
- Read-only/static status appears clearly but is not repeated everywhere.

### 5. Efficient frontier is deferred until data is defensible

A strategy-mix frontier can be computed from strategy curves, but a true asset-level efficient frontier requires new artifacts:

- `portfolio/risk-model.json`,
- `portfolio/efficient-frontier.json`,
- `portfolio/exposures.json`,
- optional `strategies/risk-return.json`.

Do not show a decorative frontier without covariance, assumptions, constraints, and named portfolios.

## V4 acceptance criteria

- Home page contains no large table, treemap, strategy leaderboard, or full chart.
- First screen answers:
  1. What is current book state?
  2. What needs review?
  3. What can be activated or watched?
  4. What data should be distrusted?
- Every decision item has state, reason, evidence path, and source metric.
- Primary route smoke passes for `/`, `/main`, `/portfolio`, `/reports`, `/reports/statistics`, `/strategies`, `/guide`; deleted `/snapshot` and `/screener` do not appear in build routes.
- No page-level horizontal overflow at 390px, 768px, 1440px.
- `pnpm --dir apps/web check`, `typecheck`, `artifact:check`, `check:report-ui`, and `build` pass.

## Slop detector

Before adding a UI block, ask:

1. Can an investor say what this block helps decide in 5 seconds?
2. Is this Korean finance copy, not English dashboard cosplay?
3. Does this repeat a nearby metric?
4. Does it imply live trading, signal, alert, recommendation, or order flow?
5. Are benchmark, strategy, oracle, report, and holding visually distinct?
6. Does an empty state explain why empty and what to inspect next?
7. Would it still make sense without gradients, shadows, and decorative badges?
