# SNUSMIC Portfolio Lab — Design Contract

Last updated: 2026-06-08
Status: current UI/product contract. Runtime behavior is still defined by code and exported artifacts; product intent is defined by `docs/product-spec.md`.

---

## 1. Product Frame

SNUSMIC Portfolio Lab is a static, artifact-backed **verification-first research workstation**.

The app does three primary things in order:

1. Shows **VerificationCase** evidence: report claims, price paths, drawdown, failure-tail, and veto/eligibility state.
2. Shows **AlphaHypothesis** promotion evidence: which repeated rules survive support, quality, and regime stability gates.
3. Shows **PortfolioStrategy** proof: benchmark comparison plus historical daily execution trace.

It does **not** search for trading rules automatically, admit generated accounts blindly, provide live signals, call broker APIs, or recommend orders.

One-line product sentence:

> SMIC 리포트 주장과 일별 가격 경로를 VerificationCase로 검증하고, 살아남은 반복 규칙을 알파로 승격한 뒤, 마지막에 포트폴리오 proof로 benchmark 대비 우위를 설명한다.

---

## 2. Current Routes

Only these web routes are active product surfaces:

| Route | Role | Primary question |
| --- | --- | --- |
| `/` | Verification board | 지금 어떤 리포트 주장이 좋은/나쁜 증거인가? |
| `/alpha` | Alpha board | 어떤 반복 규칙이 승격되거나 탈락했는가? |
| `/reports` | Report evidence table | 원문 리포트와 개별 근거는 어디서 확인하나? |
| `/reports/[symbol]/[reportId]` | Report detail | 발간일 이후 이 리포트 주장은 어떻게 끝났나? |
| `/calendar` | Verification calendar | 과거 특정 날짜에 어떤 검증 후보를 볼 수 있었고 이후 어떻게 검증됐나? |
| `/statistics` | Verification statistics | 전체 검증 표본의 수익/실패 분포와 반복 패턴은 무엇인가? |
| `/portfolio` | Portfolio proof catalogue | 어떤 전략 proof를 다음으로 열어봐야 하나? |
| `/portfolio/[account]` | Strategy proof overview | 선택 전략의 현재 상태와 기준 차트는 무엇인가? |
| `/portfolio/[account]/holdings` | Strategy proof holdings | 현재 proof를 구성하는 포지션은 무엇인가? |
| `/portfolio/[account]/trades` | Historical execution trace | 어떤 이유로 언제 사고팔았나? |

---

## 3. Data Boundary

The web app is a static reader over committed `data/web` artifacts.

Python owns:
- report extraction cleanup
- price, FX, and benchmark normalization
- verification-case generation
- alpha promotion logic
- portfolio proof generation
- canonical web artifact export

TypeScript owns:
- artifact validation
- page-level view models
- display grouping, labels, route hrefs, and light presentation metrics

React owns:
- layout
- local controls
- table sort/filter UI
- chart hover/selection/toggle state

React components must not reconstruct verification, alpha-promotion, or portfolio-proof logic.

---

## 4. Artifact Map

The relevant static artifact tree is evolving toward:

```text
data/web/
  manifest.json
  overview/
    snapshot.json
    research-pulse.json
    data-quality.json
  verification/
    cases.json
  alpha/
    hypotheses.json
  pages/
    verification-board.json
    alpha-board.json
    report-verification.json
    report-board.json
    report-statistics.json
    portfolio-dashboard.json
    research-calendar.json
  research-calendar/
    calendar.json
  reports/
    table.json
    rankings.json
    detail-metrics.json
    return-windows.json
    target-hit-distribution.json
  portfolio/
    accounts.json
    holdings.json
    monthly-holdings.json
    trades.json
    episodes.json
    equity/
      index.json
      {ACCOUNT_ID}.json
    daily-decisions/
      index.json
      {ACCOUNT_ID}.json
  accounts/
    catalog.json
    curves.json
    leaderboard.json
  prices/
    {SYMBOL}.json
```

Required artifacts fail loudly when missing. Do not add alternate branches that hide missing data or contract errors.

---

## 5. Page Shape

- First screen starts at **VerificationCase board**, not account snapshot.
- Every route must answer one operator question.
- Portfolio surfaces are proof and trace surfaces, not broker/account dashboards.
- Historical buy/sell trace is required, but it is subordinate to strategy proof.
- Diagnostics (`reports`, `calendar`, `statistics`) support the main verification → alpha → proof spine.

---

## 6. Shared Components

Preferred shared components:
- `PageHero`
- `DataQualityNotice`
- `SeriesToggleChart`
- `CumulativeReturnChart`
- `ReportsTable`
- `PortfolioEquityTradeChart`

Do not create page-specific duplicates when a shared component already fits the job.
