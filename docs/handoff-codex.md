# Codex handoff — 2026-05-19

이 문서는 다른 코딩 에이전트(Codex 등)가 작업을 이어받을 때 필요한 모든 컨텍스트를 한 곳에 모은다. 이 문서를 먼저 읽고 시작하면 된다.

---

## 1. 저장소 / 빌드 / 배포

- **Repo**: `smic-portfolio` (origin: `https://github.com/ChoiInYeol/snusmic-portfolio-lab.git`, redirect to `SNUSMIC-Portfolio.git`)
- **Branch**: `main`
- **HEAD**: `3368d71` (DESIGN.md §11 status update)
- **Latest release tag**: `v0.22.0-datapanel-unify.1` (`0175dcf`)
- **Stack**: Next.js 16 App Router static export, TypeScript 5 strict, Tailwind CSS v4, Biome lint, pnpm
- **CWD for app**: `/Users/qraft_inyeolchoi/Desktop/inyeol/code/smic-portfolio/apps/web`
- **Verify commands** (must pass on every commit):
  - `pnpm --dir apps/web typecheck`
  - `pnpm --dir apps/web lint`
  - `pnpm --dir apps/web build` (413 static pages prerendered)
- **Pre-commit hooks**: trailing whitespace, biome check (auto-fix), JSON check, mixed line ending. Biome may auto-modify files; re-stage and re-commit when it does.

---

## 2. Design contract — 반드시 읽기

`DESIGN.md`는 이 세션에서 백지부터 다시 썼다 (commit `d3acf8f`). 핵심 룰:

- **Single visual vision**: "Research archive · static ledger" (학술지 부록 톤). 이전 라벨 "Light fintech SaaS", "Research command board"는 모두 폐기.
- **Product sentence**: "발간된 분석 리포트가 시장에서 어떻게 끝났는지를 기록하는, 학부 동아리의 정적 검증 원장."
- **Copy contract** (§8.2 in DESIGN.md, FIXED):
  - H1: 명사구, 6~14자, 동사·수사·2인칭·motivational 금지
  - 메타라인: H1 바로 아래 한 줄 `font-mono text-xs` (기준일 · 표본 · 윈도우)
  - 본문 prose 기본 금지. 강조 prose(`<strong>` wrapping marketing copy) 금지.
  - Eyebrow / "지금 시작하기" CTA / SaaS hero 금지.
  - "읽기 전용" 같은 dev-flavor copy 금지 (이미 제거됨).
- **Page types** (§7):
  - Dashboard (`/`, `/portfolio`): KPI strip + treemap + feed rails
  - Analytics (`/statistics`): minimal header + figure stack
  - Detail (`/reports/[symbol]/[id]`, `/guide`): header + tabs/scroll
  - Index (`/reports`, `/screener`, `/strategies`): single dominant sortable table

[FIXED] vs [GUIDELINE] tags throughout. Changes to FIXED sections require a Decision log entry (Appendix A).

---

## 3. /statistics 페이지 — 데이터 / 컴포넌트 / 의미 계약

### 윈도우 / 지표 (DESIGN.md §4.4 — FIXED)
- **Validity window**: 500 trading days from publication (≈ 2 years).
- **maxFavorableExcursion (MFE)**: 윈도우 내 일중 고가 ÷ 발간일 종가 − 1. 첫 도달 가능 폭.
- **expiryReturn**: 윈도우 마지막 날 종가 ÷ 발간일 종가 − 1. 윈도우 미경과 시 `null`.
- **hit10/08/06**: 윈도우 내 일중 고가가 목표가의 1.0x / 0.8x / 0.6x 한 번이라도 넘었는가.
- **daysToTarget**: 윈도우 내 첫 1.0x 도달일 (없으면 `null`).
- 모든 지표는 close_krw 우선, 일중 KRW 환산은 `high * (close_krw / close)`.

### Outcome 6-class (DESIGN.md §4.5 — FIXED)
```
target       hit10                                                  → blue
partial      hit08 || hit06                                          → violet
upside       not hit, MFE >= +30%                                    → teal
flat         not hit, |expiryReturn| < 10% AND MFE < 30%             → slate
declining    not hit, -30% < expiryReturn <= -10%                    → amber
devastating  not hit, expiryReturn <= -30% (low MFE)                 → rose
```
기회비용 관점: target / partial / upside = 성공, flat / declining / devastating = 실패.

### 컴포넌트 (apps/web/components/reports/ReportStatisticsStory.tsx)
- DistributionSignature, WholeSampleMap (Q-Q, signed-log y), OutcomeBreakdownPanel, WinnersLosersBoard, PricePathOverlay (lightweight-charts 멀티 라인 + OHLCV 캔들 선택), ConcentrationInsight, ConfirmationSignalsTable, FeatureBucketsTable, PathBucketPanel, VintageCohortTable, DataNoteFooter.

### Server-side analysis (apps/web/app/(app)/statistics/page.tsx)
- `clipSummary` → 모든 row를 500거래일 윈도우로 재계산
- `buildPricePaths` → top 10 winners / bottom 10 losers + OHLCV bars
- `buildFeatureBuckets` → 정배열 / 52w high 근접 + Mann-Whitney U p-value
- `buildConfirmationSignals` → 6 코호트 (r5 음봉 / 20D −15% / 60D +5% 미도달 / 5D +5% 돌파 / 21-60D +5% / dip-recover) outcome 분포

### 데이터 마이닝 발견
- 가장 강한 위험 신호: 첫 20거래일에 -15% 이상 drop → 치명적 비율 42%, 성공률 38%
- 가장 강한 확인 신호: 첫 +5%가 21-60D 사이 → 치명적 0%, target 72%
- 단순 stop-loss는 약함; 발간 직후 가격 동작 코호트가 더 의미 있다고 사용자 평가

---

## 4. /portfolio 및 dense tables (v0.22.0 DataPanel unify)

### 공유 컴포넌트
- `apps/web/components/ui/data-panel.tsx`:
  - `<DataPanel>` — header(title, subtitle, actions, search) + sticky body + centered footer(pagination, page-size selector)
  - `<CsvDownloadButton>`, `<EmptyTableState>`
  - `downloadCsv(filename, headers, rows)` — UTF-8 BOM, csvEscape 포함
- `apps/web/components/trading/helpers.ts`:
  - `marketLabel(region)`, `capitalContribution(pnl, capital)`, `nativeFromKrw(...)`, `reportTargetHref(target)`

### 적용된 표 (모두 DataPanel chrome 사용)
- `components/reports/ReportsTable.tsx` (TanStack 기반, presets + 검색 + 3 dropdown + CSV. per-column filter row만 미적용 — open question)
- `components/screener/screener-table.tsx` (TanStack 기반, 모든 affordance + CSV + per-column filter row 보유)
- `components/trading/PortfolioTables.tsx` (Holdings, custom sortRows)
- `components/trading/TradesTable.tsx` (episodes + trades 2 panel, 공유 search/side row)
- `components/trading/PortfolioHistory.tsx` (월말 selector + CSV header)
- `components/trading/StrategyRiskTable.tsx` (정렬 + CSV, title/csvFilename prop)
- `components/trading/DailyEquityHistory.tsx` (간단한 표, sticky header)

### 페이지네이션 룰 (globals.css)
- `.pagination-bar { display: grid; grid-template-columns: 1fr auto 1fr; }` — BlockPagination 자동 중앙
- `.table-wrap` / `.board-table-wrap`: `max-height: 72vh; overflow: auto;` + sticky thead th

### daisyui 잔재
- `badge badge-*` → `rounded-md bg-{tone}-50 px-1.5 py-0.5 text-[11px] font-medium text-{tone}-700`
- `link` → `text-slate-700 hover:underline`
- `select select-*` / `input input-*` → tailwind h-7/8 utilities + NativeSelect
- `table table-sm table-zebra` → `w-full text-sm`
- 전부 제거됨 (commit `5837dbe`).

---

## 5. 남은 작업 (open questions, DESIGN.md §11)

### A. ReportsTable per-column filter row (medium effort)

**목표**: ReportsTable에 컬럼별 inline 필터 입력을 추가. 헤더 행 바로 아래 `sticky top-[31px]`로.

**참조 구현**: `apps/web/components/screener/screener-table.tsx`
- `ColumnFilterControl` 컴포넌트 (line 1235~)
- `rowPassesColumnFilters` 함수 (line 1019~)
- `COLUMN_META` 설정 (line 132~)
- thead 두 번째 `<tr>` 렌더 (line 686~699)

**적용 가이드**:
- ReportsTable은 이미 TanStack table 사용. `columnFilters` state로 처리하면 자연스러움.
- 필터 kind 목록: text(company/symbol/marketRegion), percent(targetUpsideAtPub/currentReturn/peakReturn/troughReturn/targetProgressPct), date(publicationDate/lastCloseDate prefix), boolean(targetHit/expired).
- 빈 상태 reset 액션에 `clearColumnFilters` 호출 추가.

### B. /portfolio/[strategy] 객체 sub-route (large effort)

**계획서**: `docs/portfolio-restructure-plan.md` — Phase A/B/C 단계 명시.

**목표 라우트**:
```
/portfolio                              → default strategy로 redirect (현재 동작)
/portfolio/[strategy]                   → overview (KPI + treemap + 요약)
/portfolio/[strategy]/holdings          → Holdings 표
/portfolio/[strategy]/equity            → 일별 평가액 차트
/portfolio/[strategy]/trades            → 매매 ledger
/portfolio/[strategy]/methodology       → buy/sell rules + params
```

**현재 구조**:
- `apps/web/app/(app)/portfolio/[strategy]/page.tsx` — `PortfolioPageContent({ selectedPersona: strategy })` 호출
- `apps/web/app/(app)/portfolio/portfolio-page-content.tsx` — 270+ 라인, 모든 데이터 로드 + persona 검증
- `apps/web/components/trading/PortfolioStrategyView.tsx` — `<Tabs>`로 holdings/equity/trades/methodology 내부 전환

**필요한 변경**:
1. `layout.tsx`를 `/portfolio/[strategy]` 디렉토리에 추가 — strategy header + 5-tab-as-links 네비
2. PortfolioStrategyView를 per-view 컴포넌트로 분해 (HoldingsView, EquityView, TradesView, MethodologyView, OverviewView)
3. 각 sub-route는 자기 view 컴포넌트만 렌더
4. Backward compat: `?strategy=:id` → `/portfolio/:id` (한 릴리스 동안 redirect)
5. `portfolioStrategyHref(persona)`가 새 경로 emit하도록 갱신

### C. 코세스 PDF 파싱 버그 (Python 트랙)

- `data/web/reports/table.json`의 `entry_price_native = 9.6` for 089890.KQ
- 원본 PDF의 "9,600원"을 콤마 처리 잘못해 9.6으로 추출
- Next.js 웹앱은 영향 없음 (KRW 경로가 가격 파일에서 직접 보정). Python 파이프라인에서 fix 필요.

---

## 6. 절대 깨면 안 되는 컨벤션

- **언어**: 사용자 노출 페이지·README·CHANGELOG·commit·문서는 한국어. agent prompts·design contract sections·코드 식별자는 영어.
- **포맷**: `formatKrw`는 raw `12,345원` (억/만 줄임 금지). `formatPercent` 사용.
- **사이드바**: active state는 `bg-slate-100 + border-l-2 border-l-slate-950` (다크 풀바 금지).
- **카피 톤**: SaaS marketing 카피(hero/eyebrow/CTA) 절대 금지. 모든 페이지가 academic appendix 톤.
- **컴포넌트 재사용**: dense table을 새로 만들면 반드시 `<DataPanel>` 사용. CSV 다운로드 추가하면 `downloadCsv` helper.
- **Outcome 분류**: 새 통계 컴포넌트가 outcome을 표현하면 `OUTCOME_CATEGORIES`와 `classifyOutcome` 재사용.
- **검증**: 매 커밋마다 typecheck + build pass. 빌드 실패 시 commit 안 함.
- **버전 태깅**: 의미 있는 변경 시 `v0.X.Y-{slug}.1` 형태로 tag. CHANGELOG에 한국어 entry 추가.

---

## 7. 작업 진행 패턴

- 새 작업은 `docs/portfolio-restructure-plan.md` 같은 plan 문서 먼저 작성, 사용자 승인 후 phase별 실행.
- `omc ultragoal`로 큰 작업을 G001-G00N 스토리로 분해. `.omc/ultragoal/` 상태 확인하려면 `omc ultragoal status`.
- 작은 cleanup은 commit 1개로 처리. 큰 refactor는 phase별 commit + 각 phase마다 verify.
- biome auto-fix로 commit이 실패하면 re-stage + recommit (그 변경은 의도적).

---

## 8. 컨텍스트 메모리

`~/.claude/projects/-Users-qraft-inyeolchoi-Desktop-inyeol-code-smic-portfolio/memory/`에 4개 메모리:
- `feedback_rigor_calibration.md` — academic 통계 엄밀성 디폴트 금지
- `feedback_retail_empathy_framing.md` — 통계가 아니라 retail 호기심을 긁어주기
- `feedback_formal_report_tone.md` — SaaS hero/copy 금지, 제목-내용-figure 패턴
- `reference_screener_playbook.md` — /screener가 dense table 표준, 14가지 affordance pattern 목록

`MEMORY.md`가 인덱스.
