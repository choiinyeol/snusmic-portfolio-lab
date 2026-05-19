# Codex handoff — 2026-05-19

이 문서는 다른 코딩 에이전트(Codex 등)가 작업을 이어받을 때 필요한 현재 컨텍스트를 코드 기준으로 정리한다. **최종 truth는 코드와 산출물이다.** `DESIGN.md`와 계획 문서는 의도·맥락·작업 순서를 돕는 문서이며, 코드와 충돌하면 코드를 먼저 확인한다.

---

## 1. 저장소 / 빌드 / 배포

- **Repo**: `smic-portfolio` (origin: `https://github.com/ChoiInYeol/snusmic-portfolio-lab.git`, redirect to `SNUSMIC-Portfolio.git`)
- **Branch**: `main`
- **Observed HEAD while updating this handoff**: `1a7465d` + local working tree edits
- **Latest tag from current checkout**: `v0.22.0-datapanel-unify.1-4-g1a7465d`
- **Stack**: Next.js 16 App Router static export, TypeScript strict, Tailwind CSS v4, Biome lint, pnpm
- **CWD for app**: `/Users/qraft_inyeolchoi/Desktop/inyeol/code/smic-portfolio/apps/web`
- **Verify commands**:
  - `pnpm --dir apps/web typecheck`
  - `pnpm --dir apps/web lint`
  - `pnpm --dir apps/web build`
- **Pre-commit hooks**: trailing whitespace, biome check/auto-fix, JSON check, mixed line ending. Biome may auto-modify files; re-stage and re-run verification when it does.
- **현재 주의점**: `.playwright-mcp/`가 untracked로 보인다. 작업 범위 밖이면 건드리지 않는다.

---

## 2. Design notes — 코드가 우선

`DESIGN.md`는 제품 방향과 UI 언어를 정리한 문서다. 단, 이 세션의 운영 원칙은 다음이다.

- **코드와 산출물이 단일 truth**다.
- `DESIGN.md`의 `[FIXED]` 표기는 “안정적으로 유지하려는 의도”이지 코드보다 높은 권위가 아니다.
- 문서와 코드가 다르면 코드 기준으로 문서를 고치거나, 별도 구현 작업으로 명시한다.
- 현재 visual/copy 방향은 여전히 유효하다:
  - Single visual vision: **Research archive · static ledger**
  - Product sentence: “발간된 분석 리포트가 시장에서 어떻게 끝났는지를 기록하는, 학부 동아리의 정적 검증 원장.”
  - SaaS hero, eyebrow, motivational copy, 과한 CTA 금지
  - 페이지 상단은 짧은 H1 + `font-mono text-xs` 메타라인 중심
- Page types:
  - Dashboard: `/`, `/portfolio`, `/portfolio/[strategy]`
  - Analytics: `/statistics`
  - Detail: `/reports/[symbol]/[id]`, `/guide`
  - Index: `/reports`, `/screener`, `/strategies`

---

## 3. `/statistics` 페이지 — 현재 코드 기준

### 윈도우 / 지표

실제 구현 위치: `apps/web/app/(app)/statistics/page.tsx`

- `clipSummary`가 각 row를 **500거래일 window**로 재계산한다.
- `maxFavorableExcursion`: window 내 KRW 환산 일중 고가 최대값 ÷ 발간일 종가 − 1.
- `expiryReturn`: window 마지막 날 종가 ÷ 발간일 종가 − 1. 아직 window가 끝나지 않으면 `null`.
- `hit10/08/06`: window 내 목표가 1.0x / 0.8x / 0.6x 터치 여부.
- KRW 환산은 `close_krw` 우선, 일중 고가는 `high * (close_krw / close)` 패턴.

### Outcome 6-class — 현재 코드 기준

실제 구현 위치:

- server: `apps/web/app/(app)/statistics/page.tsx` `classifyOutcomeServer`
- client: `apps/web/components/reports/ReportStatisticsStory.tsx` `classifyOutcome`, `OUTCOME_CATEGORIES`

```text
target       hit10                                                  → blue
partial      hit08 || hit06                                          → violet
upside       not hit, MFE >= +30%                                    → teal
flat         not hit, |expiryReturn| < 10% AND MFE < 30%             → slate
declining    not hit, -30% < expiryReturn <= -10%                    → amber
devastating  not hit, expiryReturn <= -30%                           → rose
```

- `target` / `partial` / `upside`를 성공 계열로 집계한다.
- `flat` / `declining` / `devastating`은 실패 계열로 본다.
- `DESIGN.md`에 다른 threshold가 보이면 코드 기준으로 갱신해야 한다.

### 주요 컴포넌트

`apps/web/components/reports/ReportStatisticsStory.tsx`:

- DistributionSignature
- WholeSampleMap
- OutcomeBreakdownPanel
- WinnersLosersBoard
- PricePathOverlay
- ConcentrationInsight
- ConfirmationSignalsTable
- FeatureBucketsTable
- PathBucketPanel
- VintageCohortTable
- DataNoteFooter

### Server-side analysis

`apps/web/app/(app)/statistics/page.tsx`:

- `buildPricePaths` — top 10 winners / bottom 10 losers + OHLCV bars
- `buildFeatureBuckets` — 정배열 / 52w high 근접 + Mann-Whitney U p-value
- `buildConfirmationSignals` — r5 음봉, 20D -15%, 60D +5% 미도달, 5D +5%, 21-60D +5%, dip-recover 코호트

---

## 4. `/portfolio` 및 dense tables — 현재 코드 기준

### 공유 컴포넌트

`apps/web/components/ui/data-panel.tsx`:

- `<DataPanel>` — title/subtitle/actions/search/toolbar/body/pagination chrome
- `<CsvDownloadButton>`
- `<EmptyTableState>`
- `downloadCsv(filename, headers, rows)` — UTF-8 BOM + csvEscape

`apps/web/components/trading/helpers.ts`:

- `marketLabel(region)`
- `capitalContribution(pnl, capital)`
- `nativeFromKrw(...)`
- `reportTargetHref(target)`

### DataPanel 적용 상태

현재 `<DataPanel>` 사용:

- `components/reports/ReportsTable.tsx` — TanStack, presets, global search, 3 dropdowns, CSV, sticky per-column filter row
- `components/trading/PortfolioTables.tsx` — Holdings, search, CSV, pagination
- `components/trading/TradesTable.tsx` — episodes + trades 2 panels, CSV, pagination
- `components/trading/PortfolioHistory.tsx` — monthly selector + CSV + pagination
- `components/trading/StrategyRiskTable.tsx` — 정렬 + CSV

현재 자체 chrome 유지:

- `components/screener/screener-table.tsx` — TanStack, per-column filter row, CSV, visibility presets. `/screener`가 dense table reference로 남아 있다.
- `components/trading/DailyEquityHistory.tsx` — 일별 평가액 표/차트 흐름. DataPanel 적용 여부는 다음 portfolio sub-route 작업에서 다시 판단한다.

### ReportsTable 이번 변경 상태

- `ReportsTable`은 이제 `DataPanel` chrome을 사용한다.
- `/screener` 패턴을 따라 sticky 두 번째 header row에 per-column filter를 추가했다.
- 지원 filter kind:
  - text: 리포트(company/symbol/title), 시장
  - date: 게시일, 최근 가격일
  - number: 진입가, 목표가, 도달 소요일
  - percent: 제시 상승여력, 현재 수익률, 목표 잔여, 달성률, 최고, 최저
  - boolean: 목표 달성
- 빈 상태 reset은 global/dropdown/column filters를 모두 초기화한다.

---

## 5. 남은 작업 / open questions

### 최근 해결. `/portfolio/[strategy]` 객체 sub-route — implemented 2026-05-19

현재 코드:

- `apps/web/app/(app)/portfolio/page.tsx` — strategy-only landing을 렌더한다. redirect가 아니다.
- `apps/web/app/(app)/portfolio/[strategy]/layout.tsx` — strategy param 검증, PageHero/selector/link nav shared shell.
- `apps/web/app/(app)/portfolio/[strategy]/page.tsx` — overview만 렌더.
- `apps/web/app/(app)/portfolio/[strategy]/{holdings,equity,trades,methodology}/page.tsx` — 각 객체 view만 렌더.
- `apps/web/app/(app)/portfolio/portfolio-view-model.ts` — landing/detail 모델 분리, persona 검증, strategy-only selector/static params 구성.
- `apps/web/components/trading/portfolio-views/*.tsx` — landing, detail overview, holdings/equity/trades/methodology, PnL trade-marker chart 분리. Phase 2 기준: detail header는 4-KPI, holdings는 treemap+근거 카드+표, methodology는 진입 후보/편입/청산·교체/위험·예외 구조.
- `apps/web/lib/product-model.ts`의 `portfolioStrategyHref(strategyId)`는 `/portfolio/${strategyId}`를 반환한다. 단, `/portfolio` static params/selector는 selectable strategy만 포함한다; benchmark/follower/oracle 원장은 `/strategies`의 비교 기준이다.

구현된 라우트:

```text
/portfolio                              → strategy-only landing (선택 + 현재 비중 + frontier + PnL path)
/portfolio/[strategy]                   → overview
/portfolio/[strategy]/holdings          → Holdings treemap + 상위 보유 근거 카드 + Holdings 표
/portfolio/[strategy]/equity            → 일별 평가액
/portfolio/[strategy]/trades            → 매매 ledger
/portfolio/[strategy]/methodology       → Entry · 진입 / Rebalance · 편입·조정 / Exit-Risk · 청산 / Exceptions · 예외 방법론
```

결정:

1. `/strategies`는 strategy/benchmark 비교 카탈로그다.
2. `/portfolio`는 실제 selectable strategy 원장이다. benchmark/follower/oracle은 selector/static params/sub-route/serialized model에서 제외한다.
3. `/portfolio?strategy=:id` backward compat는 기존 notice/redirect component를 유지하되 primary href는 `/portfolio/:id`다. benchmark/follower/oracle id는 invalid로 취급된다.

### A. 코세스 PDF 파싱 버그 (Python 트랙)

- `data/web/reports/table.json`의 `089890.KQ` row에서 `entry_price_native = 9.6`로 확인됨.
- 원본 PDF의 “9,600원” 콤마 처리 오류로 보인다.
- 웹앱은 일부 KRW 경로에서 가격 파일로 보정하지만 artifact 값 자체는 틀렸다.
- Python pipeline에서 parsing/normalization 수정 필요.

### C. `/statistics` outcome threshold 재검토

- 현재 코드는 `upside >= +30%`, `devastating <= -30%`다.
- `-30%` vs `-20%` 등 임계값 변경은 코드 변경으로 다뤄야 한다.
- 지금은 decision pending으로 유지한다.

---

## 6. 절대 깨면 안 되는 컨벤션

- **언어**: 사용자 노출 페이지·README·CHANGELOG·commit·문서는 한국어. agent prompts·design notes·코드 식별자는 영어.
- **포맷**: `formatKrw`는 raw `12,345원` 형태. 억/만 축약 금지. 퍼센트는 `formatPercent` 사용.
- **사이드바**: active state는 `bg-slate-100 + border-l-2 border-l-slate-950` 계열. 다크 풀바 금지.
- **카피 톤**: SaaS marketing copy(hero/eyebrow/CTA) 금지. academic appendix / static ledger 톤 유지.
- **컴포넌트 재사용**: 새 dense table은 우선 `<DataPanel>` 사용. CSV는 `downloadCsv` helper 사용.
- **검증**: 의미 있는 코드 변경은 typecheck + lint + build로 확인한다.
- **버전 태깅**: 의미 있는 릴리스 단위 변경 시 `v0.X.Y-{slug}.1` 형태 tag와 CHANGELOG 한국어 entry를 준비한다.

---

## 7. 작업 진행 패턴

- 새 큰 작업은 먼저 plan 문서로 현재 코드 기준 상태와 phase를 명확히 한다.
- 작은 cleanup/feature는 한 commit으로 처리한다.
- 큰 refactor는 phase별 commit + 각 phase마다 verify한다.
- Biome auto-fix가 파일을 바꾸면 diff 확인 후 re-stage/re-run verification한다.

---

## 8. 컨텍스트 메모리

`~/.claude/projects/-Users-qraft-inyeolchoi-Desktop-inyeol-code-smic-portfolio/memory/`에 4개 메모리:

- `feedback_rigor_calibration.md` — academic 통계 엄밀성 디폴트 금지
- `feedback_retail_empathy_framing.md` — 통계가 아니라 retail 호기심을 긁어주기
- `feedback_formal_report_tone.md` — SaaS hero/copy 금지, 제목-내용-figure 패턴
- `reference_screener_playbook.md` — `/screener`가 dense table 표준, 14가지 affordance pattern 목록

`memory/MEMORY.md`가 인덱스다.
