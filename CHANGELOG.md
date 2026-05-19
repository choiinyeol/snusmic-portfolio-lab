# 변경 이력

이 프로젝트의 사용자 가시 변경사항을 모두 정리합니다. 릴리스의 진실은 git 태그이며, 본 파일은 태그 단위로 의도를 한국어로 기록합니다.

## Unreleased

### 추가
- yfinance `Stock Splits` 이벤트를 웨어하우스·웹 가격 아티팩트에 보존해 액면분할/병합 진단 정보(이벤트 종류·비율 문자열)를 함께 유지합니다.
- 누적 분할 계수와 분할 조정 OHLCV 필드를 추가해 캐노니컬 시뮬레이션 OHLC 컬럼은 그대로 두고 보조 정보로만 제공합니다.
- broker-ledger 전략 탐색에서 `broker_strategy_trials.csv`를 내보내고, 웹 감사 흐름을 위해 `strategy-admission.json` / `strategies/admission.json`을 생성합니다.

### 변경
- 사용자 노출 웹 아티팩트에서 승격된 MTT 계열 전략 이름을 `Overseas Report Trend Broad #1`처럼 행동 기반 라벨로 교체했습니다.
- `MTT`는 내부 추세 필터/규칙 템플릿명으로만 다루고 사용자에게는 노출하지 않습니다.
- 폐기된 페르소나를 가리키는 stale 월간 보유 행은 옵셔널 경로에서 조용히 걸러내고, 필수 원장 아티팩트의 stale은 빌드 단계에서 빠르게 실패시킵니다.
- `report-statistics-lab.json`을 익스포터 소유의 결정적 아티팩트로 만들어 아티팩트 리프레시 직후에 리포트 상세/통계가 곧바로 빌드됩니다.
- `/screener`에 스프레드시트 스타일의 컬럼별 필터를 추가하고, 발간 2년 경과 리포트는 기본 숨김 처리(만료 필터는 명시적으로 제공)했습니다.
- 데스크탑 사이드바를 접기 가능하게 만들어 넓은 표가 가로 공간을 더 쓰도록 했습니다.
- `/screener` 필터에 NativeSelect 래퍼를 적용해 한글 옵션이 잘리는 문제를 해결했습니다.

---

## v0.21.6-prose-trim.1 — 2026-05-19

### 변경
- `PortfolioStrategyView`에서 전략 셀렉터 아래의 boilerplate caption("…보유·현금·체결·매수/매도 규칙을 함께 봅니다") 한 줄과, 트리맵 아래에 있던 6줄짜리 "매도 후 즉시 다른 종목을 사지 않는 경우…" caveat 단락을 제거. 같은 패널의 `AccountingExplanationPanel` 산문도 단일 산문 + 짧은 공식 한 줄(`계산 현금 = 입금 누계 + 확정 손익 − 보유 원가`)로 압축하고, 자동 생성되던 보조 단락("따라서 일부 리포트 추세 전략처럼…")을 삭제.
- `/strategies`의 4개 Section caption 산문을 제거(eyebrow + title + 표만 남김).
- `/reports`의 `PageHero` subtitle과 Section caption을 제거하고 제외 표본 정보는 그대로 배지에 합쳤다(`제외 N건 (X%)`).

### 변경 (구조)
- `lib/report-statistics.ts`를 새로 만들고 `isNumber`·`mean`·`quantileFromSorted`·`formatMultiple`를 `ReportStatisticsStory.tsx`(1063줄)에서 분리. 동일 코드를 클라이언트 컴포넌트 안에 묶어두지 않고 server·non-client 호출자도 재사용 가능하도록 모듈화. 향후 `/reports/statistics`의 데이터 prep을 본격적으로 server-side로 옮길 때 시작점이 된다.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

## v0.21.5-polish-batch.1 — 2026-05-19

### 수정
- PDF에서 추출한 진입가가 발간 당일 종가와 5배 이상 어긋나면 액면분할/추출 결함으로 보고 발간 종가로 진입가를 스냅하고 목표가도 같은 비율로 다시 스케일한다. 코세스(089890.KQ)의 "진입가 10원" 같은 케이스가 스크리너·리포트 표·리포트 상세에서 더 이상 노출되지 않는다.

### 변경
- `/main` 헤더의 4줄 안내 문단과 현금·통계 카드의 caveat 문단을 모두 제거해 페이지를 본문 데이터 중심으로 좁혔다. h1 크기도 `text-3xl md:text-5xl` → `text-2xl md:text-4xl`로 완화.
- `/main` 하단의 4개 정사각 Drilldown 카드를 한 줄짜리 리스트(아이콘 칩 + 라벨 + 캡션 + 화살표) 4행으로 압축. 포트폴리오는 어두운 칩으로 primary 표시.
- 리포트 상세 ScenarioTable에서 "현재가" 행을 제거해 FactsTable과의 중복을 정리.
- 리포트 상세 FactsTable의 발간가·목표가·현재가에 비KRW 통화일 때 `≈ formatKrw(...)` 캡션을 추가해 환산 가격도 같이 본다.
- `/guide` 250줄을 헤더 + 핵심 수치 그리드 + 검증 질문 표 + 전략 비교 표 + amber caveat 한 줄 형태로 슬림화. 카드 위주의 산문 블록을 표 위주로 재구성하고 h1 자간도 `-0.045em` → `-0.02em`로 CJK 친화화.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

## v0.21.4-slim-report-detail.1 — 2026-05-19

### 변경
- 리포트 상세 페이지를 표 중심으로 재설계했습니다. 6개 패널·약 850줄을 압축 헤더 + 핵심 지표 표 + 가격 차트 + 가격대별 사후 수익률 표만 남기는 약 270줄로 슬림화했습니다. `ReportHero`·`ReportEvidenceStrip`·`ReportOutcomePanel`·`PriceEvidencePanel`·`PathScenarioPanel`·`ReportSourcesPanel`·`TrendSignalCard`·`SymbolPersonaTrades`의 산문 narrative, classifyPath 5종 분기, 시나리오 카드 행·바 그리드, 투자 메모 글머리표, 마크다운 미리보기를 모두 제거했습니다. 매매내역은 포트폴리오 페이지에서 보기 때문에 상세에서 빠집니다.
- 스크리너 sparkline의 ±30% 공유 밴드 클램프를 제거하고 행 단위 자동 스케일로 되돌렸습니다. 50% 이상 움직인 종목이 시작점 직후부터 상한선에 붙어 일자로 그려지던 버그가 사라지고, 시작가가 중앙 기준선에 고정되어 방향성도 그대로 유지됩니다.
- `SidebarNav` 활성 상태의 색 처리를 명시 분기로 단순화했습니다. `tailwind-merge`가 `text-slate-600`과 `text-white`를 병합할 때 발생하던 모호함을 제거해, 활성 항목에서 박스(`bg-slate-950`)와 텍스트(`text-white`)가 항상 함께 적용됩니다.
- 저장소 루트의 참고 이미지(`example_*.png`)를 정리하고 `.gitignore`에 `example_*.{png,jpg,jpeg}`, `*.bak`, `*.swp`, `*~` 패턴을 추가했습니다.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.21.3-ultragoal-polish.1 — 2026-05-18

### 추가
- 모바일 사이드바 포커스 트랩 (`useFocusTrap` 훅)을 추가해 드로어가 열려 있을 때 `Tab` / `Shift+Tab`이 내부에서 순환하고 `Esc`로 닫으면 트리거에 포커스가 복귀합니다. 빈 컨테이너에서는 `tabIndex={-1}`로 자체 포커스를 받아 트랩이 깨지지 않습니다.
- 명령 팔레트 인덱스를 `(app)` 서버 레이아웃에서 빌드 타임에 만들어 페이지뿐 아니라 모든 선택 가능 전략과 고유 리포트 종목까지 포함했습니다. 각 결과는 `kind` 칩(페이지·전략·종목)을 달고 `keywords`로 매칭되어 `⌘K` 한 번에 티커나 페르소나로 점프할 수 있습니다.
- 스크리너 필터 드롭다운에 제네릭 `Select<T extends string>`를 도입했습니다. 옵션 배열을 `as const`로 잠가 `as SignFilter` / `as BooleanFilter` / `as MaFilter` 4건의 unsafe cast가 사라졌습니다.
- 모바일(`< sm`)에서 `StrategyRiskTable` 우측에 `mask-image` 페이드를 추가해 가로 스크롤이 있다는 사실을 시각적으로 알립니다.
- `/main` Drilldown 4개 중 포트폴리오를 `variant="primary"`로 격상(slate-950 fill)해 시선이 자연스럽게 모이도록 했습니다.

### 변경
- 스크리너의 수동 필터 9개 `useState`(`activePreset`, `bucket`, `return`, `targetHit`, `expired`, `caveat`, `ma`, `nearHighOnly`, `columnFilters`, `page`)를 단일 `useReducer` + 판별 `FilterAction`으로 통합했습니다. `applyPreset`이 원자적으로 적용되고, `useCallback` 의존성에서 stale closure가 새지 않습니다.
- 4개의 병렬 필터 ID Set(`PERCENT_FILTER_IDS`, `NUMBER_FILTER_IDS`, `BOOLEAN_FILTER_IDS`, `TEXT_FILTER_IDS`)과 `COLUMN_FILTER_LABELS` 맵을 컬럼 ID로 키잉된 단일 `COLUMN_META` 레코드로 통합했습니다. 새 컬럼 추가 시 한 줄만 편집하면 됩니다.
- `HoldingsTreemap` 색 스케일을 6단계 이산 버킷에서 ±25% 클램프 사이의 연속 RGB 보간으로 교체했습니다. +8%와 +24% 보유가 명백히 다른 녹색으로 표시됩니다. 범례도 3개 pill 대신 동일 인코딩의 그라데이션 바로 바꿔 거짓 정보가 사라졌습니다.
- `ReportsTable` 목표 진행률 바를 `h-1.5 w-14`(6×56)에서 `h-2.5 w-20`(10×80)으로 확장하고 2px 중앙 슬레이트-400 영점 틱을 추가해 아날로그 판독이 가능해졌습니다.
- `SeriesToggleChart`의 활성 토글 pill을 시리즈 색과 동일 색조로 칠해 토글과 차트 라인이 시각적으로 한 시스템에 속하도록 했습니다.
- `/reports`에 남아 있던 세 개의 raw `<select>`를 `NativeSelect`로 마이그레이션하고 `htmlFor`/`id`를 명시적으로 연결했습니다.
- 스크리너 컬럼 모드(`핵심 / 가격 / 전체 컬럼`) 토글을 라벨이 붙은 segmented control로 바꿔, 그 아래 10개의 필터 프리셋 pill과 시각적으로 구분되도록 했습니다.
- `PageHero` h1을 `text-3xl md:text-4xl tracking-[-0.045em]` → `text-2xl md:text-3xl tracking-[-0.02em]`로 완화해 한글 자간이 안정되고, 페이지의 데이터 밀도와 경쟁하지 않습니다.
- `(app)/loading.tsx` 스켈레톤을 실제 KPI 스트립 레이아웃(`border-y` + `divide-x` 컬럼)과 동일하게 재구성해 로드 직후 layout shift가 줄었습니다.
- 스크리너 `52W high` 토글의 `<label>+<button>` 이중 클릭 영역을 `<div>+<button aria-pressed>`로 정리해, 라벨 텍스트가 더 이상 클릭 가능한 어포던스인 척하지 않습니다.

### 수정
- `matchesDateFilter` / `matchesNumberFilter` / `parseMetricNumber`의 세 정규식 리터럴에서 소스 레벨 `\\s`·`\\d`가 공백/숫자 클래스가 아니라 백슬래시 리터럴 클래스로 컴파일되어, 연산자 접두 컬럼 필터(`>=100`, `<=120`, `>-10` 등)가 조용히 텍스트 매칭으로 떨어지던 P0 버그를 수정했습니다. 단일 백슬래시로 정정해 `COLUMN_META`가 안내하는 연산자 의미를 복원했습니다.

### 제거
- 도달 불가 분기였던 `SeriesToggleChart`의 `colorWithAlpha` 길이 가드, 타입 유니온이 이미 보장하는 `applyPreset` 런타임 throw, 호출지가 항상 인덱스를 채워 보내는 `CommandPalette`의 `DEFAULT_NAV_TARGETS` 폴백을 모두 제거했습니다.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)
- AI slop 스윕 (`oh-my-claudecode:code-reviewer`) — PASS, 5건의 LOW nit 모두 반영
- 최종 코드 리뷰 (`oh-my-claudecode:code-reviewer`) — P0 정규식 버그 수정, P1 포커스 트랩 ESC `onEscape` 라우팅, P2 `previouslyFocused`에 `document.contains` 가드, 빈 컨테이너 fallback 포커스(`tabIndex={-1}`)까지 처리 후 APPROVE

---

## v0.21.2-command-palette.1 — 2026-05-18

### 추가
- `AppShell`에 전역 명령 팔레트를 추가했습니다. `⌘K` / `Ctrl+K`로 메인·포트폴리오·리포트·후보 탐색·리포트 통계·전략·가이드를 필터링·이동할 수 있고, 화살표 이동/Enter 진입/Esc 닫기를 지원합니다. raw DOM(`role="listbox"`/`role="option"`)으로 직접 구현해 정적 export 번들에 추가 라이브러리가 들어가지 않습니다.

### 변경
- `ReportStatisticsStory`의 `currentReturns`를 한 번만 정렬하고 7개 백분위 계산이 새 `quantileFromSorted` 헬퍼를 공유하도록 변경해, 렌더 한 번당 7×O(n log n)이던 정렬이 1회로 줄었습니다.
- 사용되지 않게 된 `quantile()` 헬퍼를 제거했습니다.
- `PageHero` h1 자간을 `tracking-[-0.045em]` → `tracking-[-0.02em]`로, 크기를 `text-3xl md:text-4xl` → `text-2xl md:text-3xl`로 완화했습니다.
- `(app)/loading.tsx` 스켈레톤을 실제 페이지의 `border-y` + `divide-x` 컬럼 레이아웃과 매칭되도록 재구성했습니다.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.21.1-mobile-and-polish.1 — 2026-05-18

### 추가
- `AppShell`에 모바일 슬라이드 드로어를 추가했습니다. `< lg`에서는 사이드바가 오버레이로 슬라이드하고, 헤더의 햄버거가 토글, 스크림 탭이 닫기, 라우트 이동 시 자동 닫힘이 동작합니다. 모바일 헤더는 브랜드 마크와 제품명을 노출해 페이지를 잃지 않습니다.
- `/reports`와 `/screener` 표 본문에 빈 상태 셀을 추가했습니다. 필터 조합이 0행을 반환하면 `SearchX` 아이콘, 어떤 필터가 너무 좁혀졌을 가능성이 있는지에 대한 설명, 그리고 한 번에 기본 프리셋으로 되돌리는 "필터 초기화" 버튼이 나옵니다.

### 변경
- 사용자 지시에 따라 `formatKrw`를 원본 형식(`12,345원`)으로 되돌렸습니다. 이전의 억/만 단위 청크는 모두 제거되어 원장 페이지, KPI 타일, 툴팁이 모든 자릿수를 그대로 표시합니다.
- `SidebarNav` 활성 상태를 `bg-slate-100 ring-1 ring-slate-200`(호버 대비 ~1.15:1)에서 `bg-slate-950 text-white`로 강화해, 현재 페이지가 사이드바에서 가장 명도 대비가 큰 항목이 됩니다.
- `ReportsTable`의 `activeRowIdx` 초기값을 `0`에서 `null`로 변경해, 첫 행이 사용자 입력 없이 "선택된 듯" 그려지던 가짜 신호를 제거했습니다. 하이라이트는 첫 `j`/`k` 입력 후에만 나타납니다.
- 스크리너 `Select` 컴포넌트를 제네릭(`Select<T extends string>`)으로 바꾸고 `as const` 옵션 배열을 받아 `SignFilter`, `BooleanFilter`, `MaFilter`의 onChange 캐스트 4건을 제거했습니다.
- 스크리너 컬럼 칩 라벨(active-filter 영역)을 한국어로 번역했습니다 — `Ticker → 종목`, `Target Up → 상승여력`, `Gap → 목표 갭`, `Hit → 목표달성`, `Peak → 고점`, `Trough → 저점` 등.
- 스크리너 헬퍼 바의 "컬럼 필터 0개" 노이즈를 카운트가 0일 때 숨기고, `/` 단축키 힌트를 인라인으로 표시했습니다.
- 스크리너 `52W high` 토글의 `<label>+<button>` 이중 클릭 영역을 `<div>+<button aria-pressed>`로 단순화했습니다.
- `AppShell` 사이드바 collapse 트랜지션을 폭 전용에서 `transition-[transform,width,padding]`로 통합해 데스크탑 collapse와 모바일 드로어 슬라이드가 한 트랜지션 패스를 공유합니다.

### 제거
- `sidebarCollapsed` 초기 상태를 `useEffect`로 hydrate하던 코드를 lazy `useState` 이니셜라이저로 대체했습니다. 강제 새로고침마다 펼침→접힘으로 깜빡이던 layout shift가 사라졌습니다.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.21.0-product-density-i18n.1 — 2026-05-18

### 추가
- `app/(app)/error.tsx`를 추가해, 라우트에서 런타임에 데이터 파싱이 던지면 흰 화면 대신 복구 가능한 에러 상태를 렌더링합니다.
- DaisyUI 스타일의 `badge`, `badge-ghost`, `badge-soft`, `badge-success`, `badge-error`, `badge-warning`, `badge-primary`, `badge-outline`, `badge-sm`, `badge-xs` 클래스에 대한 CSS fallback을 정의했습니다. 30개 이상의 status pill이 모두 무스타일 텍스트로 렌더링되던 P0 버그를 해결했습니다.
- 리포트 표에 `j` / `k` 행 이동과 `Enter` 상세 진입을 추가했습니다(`/`와 `Esc`는 이전 릴리스에 이미 연결).
- `/reports`와 `/screener` 모두에 0행 일 때 명시적인 "결과 없음" 행을 추가했습니다.

### 변경
- `formatKrw`가 ≥1억은 `123억 4,568만원`, ≥1만은 `3,457만원`으로 한국 핀테크 관례에 맞춰 청크합니다(이후 v0.21.1에서 raw 원으로 되돌림).
- 스크리너 컬럼 헤더(`Price → 현재가`, `Target Up → 상승여력`, `Gap → 목표 갭`, …), 필터 라벨(`Return → 수익률 방향`, `Bucket → 후보 유형`, `MA → 이동평균`), 섹션 타이틀, 푸트노트, 메트릭 캡션을 한국어로 번역했습니다.
- 리포트 표와 포트폴리오 보유 표의 발간일 셀에 `formatDateKo`를 적용해 raw ISO 문자열 노출을 정리했습니다.
- 스크리너 `Sparkline`을 시작점 대비 % 수익률 ±30% 공유 밴드로 정규화하고 영점 기준선을 그렸습니다(이후 v0.21.4에서 클램프 제거, 행 단위 자동 스케일로 회귀).
- 스크리너 `filteredRows`를 메모이즈하고 검색 입력을 `useDeferredValue`로 라우팅해 모든 키스트로크마다 전체 행을 재정렬·재필터링하던 INP 부담을 제거했습니다.
- `AppShell`의 사이드바 collapse 상태를 lazy `useState` 이니셜라이저로 전환했습니다.
- `HoldingsTreemap`의 d3 hierarchy를 `TreemapDatum` 판별 유니온 + `isLeafNode` 타입 가드로 다시 타이핑해 `as unknown as LeafNode[]` 캐스트 3건을 제거하고 leaf 단위 타입 안전성을 회복했습니다.
- `next.config.ts`에 `poweredByHeader: false`, `images: { unoptimized: true }`, `experimental.optimizePackageImports: ['lucide-react', 'd3']`를 설정했습니다.
- lightweight-charts 누적 수익률 차트와 가격 근거 차트의 attribution 로고를 비활성화하고, 세로 그리드라인을 숨기고 가로 그리드라인을 옅게(`#f1f3f6 → #f4f6f9`) 처리했습니다.
- `KpiTile`의 `showToneBadge` 기본값을 `false`로 바꿔 값의 색이 직접 톤을 전달하도록 했습니다.
- biome의 `useExhaustiveDependencies` 규칙을 `warn` 레벨로 재활성화했습니다.
- `메인화면` h1 자간을 `-0.045em` → `-0.02em`로 완화해 CJK 글리프 fitting을 개선했습니다.

### 제거
- 동작하지 않던 트리맵 툴바의 `snapshot-pill` 4개("전체·평가액·미실현·목표 진행")를 제거했습니다.
- 리포트 표 헤더의 미정렬 상태 표시(`↕`)를 제거했습니다(활성 정렬의 `↑`/`↓`는 유지).

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.20.4-ui-density-a11y.1 — 2026-05-18

### 추가
- `/reports`와 `/screener`에서 `/`로 검색에 포커스, `Esc`로 비우기를 공통 `useSearchShortcut` 훅으로 연결했습니다.
- `app/(app)/loading.tsx` 스켈레톤을 추가해 라우트 전환 시 흰 깜빡임을 없애고, `app/not-found.tsx`로 깨진 URL이 앱 셸 안에서 복귀 경로를 제공합니다.
- 모든 페이지의 첫 포커스가 되도록 "본문으로 건너뛰기" skip link(WCAG 2.4.3)를 추가했습니다(`<main id="main-content">` 타깃).
- `HoldingsTreemap` 캔버스 옆에 `sr-only` 보유 종목 리스트를 병기해, 스크린리더 사용자가 셀별로 종목명·평가액·비중·미실현을 읽을 수 있습니다.
- 데스크탑 사이드바 collapse 상태를 `localStorage('snusmic.sidebar-collapsed')`에 저장해 새로고침에도 유지됩니다.

### 변경
- `apps/web/app/globals.css`를 약 1110줄에서 440줄로 정리했습니다. `.feed-*`, `.histogram*`, `.distribution-*`, `.stack-*`, `.bento-*`, `.metric-strip`, `.side-nav__*`, `.brand__*`, `.sidebar-card`, `.brand__mark` 그라데이션 등 미사용 레거시 클래스와 body radial 그라데이션·`.lab-panel:hover translateY`·과한 그림자·사이드바 그라데이션 활성 상태를 제거했습니다.
- 패널 radius 스케일을 낮췄습니다(`--radius-sm` 10→4, `--radius` 16→6, `--radius-lg` 22→8) — `DESIGN.md` §7.4의 low-radius 원칙 준수.
- `--faint`를 `#8b95a1` → `#6a7480`로 격상해 흰 배경 위에서 WCAG AA(약 4.7:1)를 통과하도록 했습니다. `:focus-visible` outline은 `--accent-strong`으로 교체해 SC 2.4.11 대비를 확보했습니다.
- `/main`의 `border-t border-slate-950` 강조를 `border-t border-slate-200`으로 표준화해 다른 패널 시스템과 충돌하지 않도록 했습니다.
- 상단 바의 제품명 중복과 `backdrop-blur-xl` 반투명 헤더를 제거하고 단색 `bg-white` 띠로 바꿨습니다.
- `/reports`의 정렬 가능한 `<th>`에 `aria-sort`를 달고, 필터 결과 수를 `aria-live="polite"`로 노출했습니다.
- `table td.tabular-nums` 셀을 자동 우측정렬해 `PortfolioTables`·`ReportsTable`의 숫자 컬럼이 셀별 retrofit 없이 정렬되게 했습니다.
- `prefers-reduced-motion` 블록의 `transition-duration: .01ms`를 `transition: none`으로 바꿔 전정 민감 사용자에게 진짜 모션-오프 경험을 제공합니다.

### 제거
- 루트 레이아웃의 의미 없는 `data-scroll-behavior="smooth"` HTML 속성을 제거했습니다.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.20.0 이전 릴리스

v0.20.x 초기 라인은 스크리너 보드의 도입과 관련 폴리시가 중심이었습니다. 영문 원문은 git 태그 메시지에 보존되어 있습니다.

- **v0.20.3-screener-width.1** — 스크리너에 가로 공간을 더 부여.
- **v0.20.2-screener-filters.1** — 스크리너에 스프레드시트 스타일 컬럼 필터.
- **v0.20.1-strategy-admission.1** — 전략 승격을 감사 가능하게 만들고 라벨을 행동 기반으로 변경.
- **v0.20.0-screener-board.1** — `/screener` 신설, `getReportRows()` 기반 보드, 가격 매칭 메트릭(YTD/1Y/52W/SMA), 프리셋 및 필터 추가.
- 그 이전(v0.19.x — v0.18.x)은 product evidence flow, exact report drilldown, statistics lab 위주의 변화입니다.
