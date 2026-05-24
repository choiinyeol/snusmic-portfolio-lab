# SNUSMIC Portfolio Lab — Design Contract

Last updated: 2026-05-24
Status: current UI/product contract. Runtime behavior is still defined by code and exported artifacts; product intent is defined by `docs/product-spec.md`.

---

## 1. Product Frame

SNUSMIC Portfolio Lab is a static, artifact-backed research ledger for SMIC report data, fixed account simulations, and follower account reports.

The app does three things:

1. Shows report-level evidence: target prices, price paths, returns, drawdowns, and outcome factors.
2. Shows fixed account paths: SMIC follower accounts, holdings, trades, equity curves, cash/RP, and benchmark comparisons.
3. Exports research-ready data so future buy/sell/position rules can be designed manually and explicitly.

It does **not** search for trading rules, admit generated accounts, provide live signals, call broker APIs, or recommend orders.

One-line product sentence:

> SMIC 리포트와 일별 가격 데이터를 정적 원장으로 묶어, 리포트 성과와 follower 계좌 경로를 같은 기준으로 검증한다.

---

## 2. Current Routes

Only these web routes are active product surfaces:

| Route | Role | Primary question |
| --- | --- | --- |
| `/` | Report board | 지금 어떤 리포트와 후보를 먼저 봐야 하나? |
| `/reports` | Report table | 전체 리포트를 한 표에서 어떻게 비교하나? |
| `/reports/[symbol]/[reportId]` | Report detail | 발간일 이후 이 리포트는 어떻게 끝났나? |
| `/statistics` | Report statistics | 전체 표본의 수익/실패 분포와 반복 패턴은 무엇인가? |
| `/portfolio` | Account chooser/dashboard | SMIC follower 계좌와 benchmark는 어떻게 비교되나? |
| `/portfolio/[account]` | Account overview | 선택 계좌의 현재 보유와 리스크는 무엇인가? |
| `/portfolio/[account]/equity` | Account equity | 누적 성과, benchmark, 매수/매도 시점은 어떻게 겹치나? |
| `/portfolio/[account]/holdings` | Account holdings | 현재 보유 종목과 기여도는 무엇인가? |
| `/portfolio/[account]/trades` | Trade ledger | 어떤 이유로 언제 사고팔았나? |

---

## 3. Data Boundary

The web app is a static reader over committed `data/web` artifacts.

Python owns:

- report extraction cleanup
- price, FX, and benchmark normalization
- fixed account simulation
- PIT warehouse and research-board export
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

React components must not reconstruct simulation logic, target-hit rules, split adjustment, benchmark coverage, or live market data.

---

## 4. Artifact Map

The relevant static artifact tree is:

```text
data/web/
  manifest.json
  overview/
    snapshot.json
    research-pulse.json
    data-quality.json
  pages/
    report-verification.json
    report-board.json
    report-statistics.json
    portfolio-dashboard.json
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
    equity-daily.json
  accounts/
    catalog.json
    curves.json
    leaderboard.json
  prices/
    {SYMBOL}.json
```

Required artifacts fail loudly when missing. Do not add alternate branches that hide missing data or current-contract errors.

---

## 5. Page Shape

Every page should read as a research ledger: compact, evidence-first, and decision-oriented.

### Dashboard

Used by `/` and `/portfolio`.

```text
compact header
metric strip
primary evidence panel
secondary table/feed panels
```

### Index

Used by `/reports`.

```text
compact header
metric strip
single unified table
lightweight controls
```

Ranking modes sort/filter the same table. They must not create competing table concepts.

### Detail

Used by `/reports/[symbol]/[reportId]` and portfolio account subroutes.

```text
compact object header
tabs or section rail
chart/table evidence
visible caveats and links
```

### Analytics

Used by `/statistics`.

```text
compact header
executive summary
figures with one-sentence takeaways
drilldown tables or selected examples
```

Charts should answer a question. A chart without a takeaway is treated as unfinished.

---

## 6. Visual Language

Target style:

```text
Research archive · static ledger
```

Use:

- white panels
- hairline dividers
- compact rows
- tabular numbers
- subdued slate surfaces
- restrained semantic color
- visible text labels for status

Avoid:

- landing-page heroes
- SaaS eyebrow labels
- glossy gradients
- decorative cards
- oversized marketing titles
- Windows-style filter grids
- color-only status
- page-level horizontal overflow

Korean labels must not be cropped. Buttons, chips, tabs, and selectors need enough vertical padding and normal line height.

---

## 7. Copy Rules

H1 is a short noun phrase.

Good:

```text
리포트 검증
리포트 통계
포트폴리오 원장
SMIC Follower v1
```

Bad:

```text
리포트 신호가 실제 수익으로 이어졌는지 봅니다
여러분의 투자 인사이트를 발견하세요
```

Use long explanations as short muted descriptions or tooltips. Do not put internal terms such as PIT in public-facing copy unless the page is explicitly technical.

CTA labels are nouns or concrete actions:

```text
리포트 보기
원본 PDF
계좌 선택
성과 통계
CSV
```

---

## 8. Tables

Tables are the decision surface.

Rules:

- one dataset per page
- sortable headers where sorting is expected
- right-align numeric cells
- use tabular numbers
- keep identity columns compact
- use internal scroll if the table is wide
- no page-level horizontal overflow
- hide diagnostics until needed
- status is text plus color

For report rows:

- Korean listings show company names first.
- US listings may show ticker first.
- Exchange suffixes and market codes stay secondary or hidden when they do not help scanning.

---

## 9. Charts

Use `lightweight-charts` for time-series market or performance charts:

- price paths
- OHLCV
- cumulative account return
- benchmark overlays
- trade marker overlays

Use custom SVG only for static analytical graphics:

- distributions
- bins
- rankings
- outcome bands

Multi-series performance charts must have on/off controls. Strategy/account and benchmark lines should be visible together when comparing performance.

Trade markers may use tooltips, but portfolio pages must also expose a visible trade-event timeline or ledger.

---

## 10. Portfolio Account Contract

The portfolio surface is a fixed account ledger, not a strategy discovery UI.

Portfolio charts should compare:

- selected SMIC follower account
- other follower accounts when useful
- KODEX200
- QQQ
- SPY
- GLD
- All Weather when present in artifacts

Benchmarks are comparison baselines. They are not report-backed holdings and should not link to report detail pages.

Cash/RP is an asset class and must be included in account value when present.

---

## 11. Report And Statistics Contract

Report-level statistics use a 500-trading-day validity window unless an exported artifact says otherwise.

Current metric meanings:

- `MFE`: maximum favorable excursion inside the validity window.
- `expiryReturn`: close-to-close return at the end of the validity window; ongoing reports may be null.
- `target hit`: whether the report reached the target threshold inside the window.
- `peak return bins`: distribution of how far reports ran after publication.

Outcome buckets are diagnostic categories for research. They are not buy/sell recommendations.

When statistics show a distribution, the UI should let users inspect which stocks are in a bucket when practical.

---

## 12. Shared Components

Preferred shared components:

- `PageHeader`
- `MetricStrip`
- `DataQualityNotice`
- `SeriesToggleChart`
- `CumulativeReturnChart`
- `ReportsTable`
- `HoldingsTreemap`
- `PortfolioEquityTradeChart`

Do not create page-specific duplicates when a shared component already fits the job.

---

## 13. Accessibility And Platform Constraints

- Semantic tables for tabular data.
- Chart and treemap panels need captions or `aria-label`.
- Interactive controls need visible focus.
- Mobile stacks sections; wide tables scroll inside their own panel.
- No new runtime dependency without explicit approval.
- No live market API in web runtime.
- No external runtime scraping.
- No alternate runtime path that hides artifact or routing errors.

---

## 14. Open Questions

- PDF extraction bug examples such as comma parsing in native prices remain Python pipeline work.
- Statistics bucket thresholds may be refined after more sample review.
- Future rule work must first define buy timing, sell timing, stop loss, take profit, sizing, cash policy, rebalance cadence, and no-lookahead proof.
