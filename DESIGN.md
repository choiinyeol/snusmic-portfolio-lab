# SNUSMIC Action Queue Workstation — Design Contract

Last updated: 2026-06-09
Status: current UI/product contract. Runtime behavior is defined by code and exported artifacts; product intent is defined by `docs/product-spec.md`.

---

## 1. Product Frame

SNUSMIC is a static, artifact-backed **Action Queue-centered trading intelligence workstation**.

The app does four primary things:

1. Builds an **Action Queue** from existing trades, holdings, and reports.
2. Uses **Prices** only to validate and annotate queue rows: current price, target gap, entry/exit zone, and confidence adjustment.
3. Lets the operator inspect **Strategy**, **Portfolio**, and **Report Pool** evidence around each queued action.
4. Preserves historical proof and drilldowns without treating broker execution as product scope.

It does **not** place orders, call broker APIs, mutate positions, or treat price-only symbols as action candidates.

One-line product sentence:

> SNUSMIC은 과거 거래·보유·보고서 근거에서 지금 확인할 매수/매도/관찰 후보를 만들고, 가격 데이터로 보조 검증해 Action Queue 중심으로 보여준다.

---

## 2. Current Routes

| Route | Role | Primary question |
| --- | --- | --- |
| `/` | Action Queue workstation | 지금 어떤 매수/매도/관찰 후보와 근거를 봐야 하나? |
| `/alpha` | Strategy drilldown | 어떤 전략 규칙과 신호 근거가 후보를 만들었나? |
| `/reports` | Report Pool table | 보고서 근거 풀과 후보 원문은 어디서 확인하나? |
| `/reports/[symbol]/[reportId]` | Report detail | 이 리포트 근거와 이후 가격 경로는 어떻게 연결되나? |
| `/calendar` | Research calendar | 특정 관측일의 보고서/검증 후보는 무엇이었나? |
| `/statistics` | Market memory / statistics | 전체 표본의 분포와 실패 꼬리는 무엇인가? |
| `/portfolio` | Portfolio catalogue | 어떤 포트폴리오 proof를 열어봐야 하나? |
| `/portfolio/[account]` | Portfolio overview | 선택 포트폴리오의 상태와 성과는 무엇인가? |
| `/portfolio/[account]/holdings` | Portfolio holdings | 현재 포트폴리오 노출은 무엇인가? |
| `/portfolio/[account]/trades` | Portfolio trade ledger | 어떤 이유로 언제 사고팔았나? |

---

## 3. Data Boundary

The web app is a static reader over committed `data/web` artifacts.

Python owns canonical export and heavy historical research logic. TypeScript may own a **first-release Action Queue view model** only when it is deterministic, transparent, and explicitly displayed as a heuristic.

TypeScript owns:
- artifact validation;
- page-level view models;
- Action Queue candidate grouping from trades, holdings, and reports;
- price-based validation/annotation;
- display grouping, labels, route hrefs, and light presentation metrics.

React owns layout, local controls, table UI, chart interaction, and light micro-interactions. React components must not hide missing artifacts, invent broker execution, or treat confidence as calibrated probability.

---

## 4. Core Ontology

| Concept | Meaning |
| --- | --- |
| Action Queue | First-screen list of Buy/Sell/Watch candidates with planned price, current price, reason, evidence, portfolio impact, and confidence. |
| Strategy | Rule/signaling context that explains why a candidate exists. `Signal` is internal to Strategy. |
| Portfolio | Current/historical exposure and outcome context. `Trade Ledger` is internal to Portfolio. |
| Report Pool | Source evidence from report rows, target prices, opinions, and success/failure state. |
| Prices | Supporting validation data only. Prices enrich queue rows but never create candidate symbols alone. |

---

## 5. Artifact Map

Relevant static artifact tree:

```text
data/web/
  manifest.json
  overview/
  reports/
    table.json
    rankings.json
  portfolio/
    accounts.json
    holdings.json
    monthly-holdings.json
    trades.json
    episodes.json
  prices/
    {SYMBOL}.json
  pages/
```

Required artifacts fail loudly when missing. Do not add alternate branches that hide missing data or contract errors.

---

## 6. Page Shape

- First screen starts at **Action Queue**, not verification board or account snapshot.
- Every queue row must show: Ticker, Action, Planned Price, Current Price, Strategy Reason, Report Evidence, Portfolio Impact, Confidence.
- Candidate symbols originate from trades, holdings, or reports; prices only validate and annotate.
- Top-level navigation language is Action Queue, Strategy, Portfolio, Report Pool.
- Diagnostics (`reports`, `calendar`, `statistics`) support the workstation rather than define the product spine.

---

## 7. Visual Language

Use a template-like institutional dashboard language rather than a bespoke neon terminal:

- Prefer existing shadcn-style primitives (`PageHero`, `Section`, `KpiTile`, `Table`, `Badge`, `Money`, `Button`) over new page-specific components.
- Base palette: white, slate, zinc, subtle blue/emerald/amber/red semantics.
- Avoid Hyperliquid-like bright green-on-black dominance unless a specific trading screen demands it.
- Keep density high through table layout, sticky/simple navigation, compact KPI tiles, and tabular numbers.
- Use React Bits-style ideas only as selective micro-interaction inspiration. Do not add heavy animation/WebGL/cursor dependencies without separate approval.
- Use CSS/Tailwind transitions and `prefers-reduced-motion` for small state changes.

Do not create page-specific duplicates when a shared component already fits the job.
