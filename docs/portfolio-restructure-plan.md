# Portfolio Restructure Plan — code-traced next phase

Status: **Phase C route decomposition + deep UI redesign implemented; docs are audit notes**
Last updated: 2026-05-19

이 문서는 과거 table-chrome proposal에서 출발했지만, 현재는 코드 상태를 기준으로 `/portfolio/[strategy]` route split 구현 상태를 기록하는 계획서다. 최종 truth는 코드다.

---

## 1. 현재 코드 상태

### Route structure

현재 파일:

```text
apps/web/app/(app)/portfolio/page.tsx
apps/web/app/(app)/portfolio/[strategy]/layout.tsx
apps/web/app/(app)/portfolio/[strategy]/page.tsx
apps/web/app/(app)/portfolio/[strategy]/holdings/page.tsx
apps/web/app/(app)/portfolio/[strategy]/equity/page.tsx
apps/web/app/(app)/portfolio/[strategy]/trades/page.tsx
apps/web/app/(app)/portfolio/[strategy]/methodology/page.tsx
apps/web/app/(app)/portfolio/portfolio-page-content.tsx
apps/web/app/(app)/portfolio/portfolio-view-model.ts
apps/web/components/trading/portfolio-views/*.tsx
```

현재 동작:

- `/portfolio`는 redirect가 아니라 strategy-only landing을 직접 렌더한다.
- `/portfolio/[strategy]`는 overview이며, `[strategy]/layout.tsx`가 static params 검증과 shared shell을 담당한다.
- `/portfolio/[strategy]/holdings`, `/equity`, `/trades`, `/methodology`는 각각 자기 view만 렌더한다.
- `portfolioStrategyHref(strategyId)`는 selectable strategy에만 portfolio 링크로 쓰인다. benchmark/follower/oracle 원장은 포트폴리오가 아니라 `/strategies`의 비교 기준이다.
- 기존 `PortfolioStrategyView` 파일은 제거했다. URL link nav는 `PortfolioStrategyFrame`이 담당한다.

### DataPanel / dense table state

`DataPanel` 적용 완료:

- `ReportsTable` — presets, global search, dropdown filters, CSV, sticky per-column filter row
- `PortfolioTables` — Holdings table
- `TradesTable` — episode/trade panels
- `PortfolioHistory`
- `StrategyRiskTable`

자체 chrome 유지:

- `screener-table` — 여전히 dense table reference implementation. TanStack, per-column filters, visibility presets가 있음.
- `DailyEquityHistory` — route split 때 view 단위로 재평가.

### 과거 table-chrome proposal 중 해결된 문제

- `<DataPanel>` 공유 컴포넌트가 생겼다.
- Holdings/Trades/History/StrategyRisk/Reports 계열의 CSV와 footer pagination이 공유 패턴에 가까워졌다.
- ReportsTable도 DataPanel + per-column filter row로 정합화됐다.
- daisyui 버튼/표 class 잔재는 주요 dense table에서 제거된 상태로 보인다.

---

## 2. 해결된 핵심 문제

`PortfolioStrategyView`에 묶여 있던 route-level 관심사를 분리했다.

- 데이터 조립은 `buildPortfolioViewModel(selectedPersona?: string)`로 이동했다.
- overview, holdings, equity, trades, methodology는 `components/trading/portfolio-views/` 아래 view component로 나뉘었다.
- 내부 `<Tabs>`는 제거했고 URL sub-route link nav를 사용한다.
- `/portfolio`는 default detail이 아니라 strategy-only landing이다. 사용자가 실제 포트폴리오를 선택하고 현재 비중 treemap, strategy-only frontier, 손익 경로를 먼저 본다.

---

## 3. 목표 route hierarchy

```text
/portfolio                              → strategy-only landing (선택 + 현재 비중 + frontier + PnL path)
/portfolio/[strategy]                   → overview (KPI + analytics + treemap summary)
/portfolio/[strategy]/holdings          → Holdings table
/portfolio/[strategy]/equity            → Daily equity view
/portfolio/[strategy]/trades            → Trade ledger
/portfolio/[strategy]/methodology       → buy/sell/risk rules + params
```

원칙:

- route별 page는 자기 view만 렌더한다.
- strategy header + view nav는 `/portfolio/[strategy]/layout.tsx`와 base `/portfolio` shell에서 공유한다.
- 데이터 의미는 artifact/product-model에서 오며, route component가 string taxonomy를 새로 추론하지 않는다. 포트폴리오 라우트는 selectable strategy만 포함하고 benchmark/follower/oracle은 `/strategies` 비교 기준으로 남긴다.
- 기존 `/portfolio/:strategy` 링크는 overview로 유지한다.
- `/portfolio?strategy=:id` compatibility는 기존 notice/redirect로만 유지한다. primary route는 `/portfolio/:strategy`다.

---

## 4. 구현 phase 결과

### Phase C1. Portfolio view model 분리 — done

목표: route split 전에 현재 데이터 조립을 한 곳으로 모은다.

작업:

1. `portfolio-page-content.tsx`의 데이터 로드/필터/label 조립을 `buildPortfolioViewModel(selectedPersona?: string)` 형태의 pure server helper로 분리한다.
2. 반환값은 다음을 포함한다.
   - `persona`, `invalidStrategyId`, `personas`, `personaLabels`, `strategyOptions`
   - `holdings`, `accounting`, `equity`, `trades`, `episodes`
   - `capitalByPersona`, `cashByPersona`, `methodsByPersona`
   - `reportSymbolsById`, `targetsBySymbol`, `targetsByReportId`
3. 기존 `PortfolioPageContent`는 이 helper를 호출해 현재 UI를 그대로 렌더한다.
4. 이 phase에서는 route 추가 없이 behavior를 고정한다.

검증:

- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build`

### Phase C2. View components 분리 — done

목표: `PortfolioStrategyView` 내부 섹션을 URL route에서 재사용 가능한 컴포넌트로 나눈다.

후보 파일:

```text
apps/web/components/trading/portfolio-views/PortfolioOverviewView.tsx
apps/web/components/trading/portfolio-views/PortfolioHoldingsView.tsx
apps/web/components/trading/portfolio-views/PortfolioEquityView.tsx
apps/web/components/trading/portfolio-views/PortfolioTradesView.tsx
apps/web/components/trading/portfolio-views/PortfolioMethodologyView.tsx
```

주의:

- 파일 분리 후에도 `/portfolio/[strategy]` 기존 화면이 깨지지 않아야 한다.
- 현재 내부 `<Tabs>`와 기존 `PortfolioStrategyView` wrapper는 제거됐다.

### Phase C3. Sub-route 추가 — done

목표: URL 단위 navigation을 추가한다.

작업:

1. `apps/web/app/(app)/portfolio/[strategy]/layout.tsx` 추가.
2. link-tab nav:
   - 개요 → `/portfolio/[strategy]`
   - 현재 보유 → `/portfolio/[strategy]/holdings`
   - 일별 평가액 → `/portfolio/[strategy]/equity`
   - 매매내역 → `/portfolio/[strategy]/trades`
   - 방법론 → `/portfolio/[strategy]/methodology`
3. 각 sub-route `page.tsx` 추가.
4. `generateStaticParams`를 sub-route에서도 공유.
5. 기존 `/portfolio/[strategy]`는 overview로 유지.

### Phase C4. Cleanup / compatibility — done

- 내부 `<Tabs>`는 URL link nav로 대체했다.
- `/portfolio` default behavior는 direct render로 유지한다.
- `?strategy=:id` legacy notice/redirect는 기존 `PortfolioLegacyQueryNotice`를 유지한다.
- benchmark/follower/oracle 원장은 portfolio 라우트, selector, serialized model, strategy table link에서 제외한다.

---

## 5. 보류 / 별도 작업

- `/screener`를 DataPanel로 강제 이전할지는 보류한다. 현재는 reference implementation 역할이 있어 성급히 통일하지 않는다.
- `DailyEquityHistory` DataPanel 적용 여부는 `/portfolio/[strategy]/equity` route split 후 실제 화면 밀도 기준으로 판단한다.
- Python pipeline의 코세스 PDF parsing bug는 portfolio route 작업과 분리한다.

## 6. Deep-change follow-up (2026-05-19)

- `/portfolio` 메인은 `PortfolioLandingView`가 소유한다. 더 이상 default detail shell을 재사용하지 않는다.
- `[strategy]` 상세는 report-detail식 header/facts/nav shell을 사용한다.
- `PortfolioEquityTradeChart`가 누적 손익 곡선 위에 매수·매도 marker를 표시한다.
- `StrategyRiskTable`은 selectable strategy만 portfolio link를 제공한다. benchmark/follower/oracle row는 `/portfolio`로 보내지 않는다.
