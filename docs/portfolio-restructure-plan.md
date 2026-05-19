# Portfolio Restructure Plan — table-chrome focus

Status: **proposal, not executed**
Last updated: 2026-05-19

## 1. 현재 layout 문제점 (focused on tables)

`/portfolio` 페이지에 들어가면 표 chrome이 일관되지 않고 어느 표는 affordance가 빠져 있음. 직접 본 문제들:

### PortfolioTables (현재 보유)

1. **페이지네이션이 표 위에만 있음** — 사용자가 표를 다 보고 내려갔는데 페이지 버튼은 상단. 가운데 아래에 있어야.
2. **CSV 버튼이 고립된 wrapper에 있음** — `<div class="flex justify-end" aria-label="포트폴리오 필터">`로 단독 wrapper. "포트폴리오 필터"라는 aria-label이 거짓 (실제 필터는 없고 CSV 버튼만 있음).
3. **이중 box** — 바깥 `<section class="rounded-2xl border">` 안에 또 `<div class="table-wrap inset rounded-2xl border">`로 박스가 겹침. 시각적 잡음.
4. **글로벌 검색 없음** — 종목명/심볼로 빨리 찾을 수 없음. TradesTable에는 있는데 PortfolioTables에는 없음.
5. **컬럼 가시성 토글 없음** — 11컬럼 전부 항상 표시. /screener는 core/price/all 모드로 줄였음.
6. **다중 wrapper로 인한 가로폭 압박** — `min-w-0` 중첩 + 두 단계 padding. 표가 좁아짐.

### TradesTable (매매내역)

1. **포지션 표 + 매매 표 2개를 같은 컴포넌트에서 따로 chrome으로 감쌈** — 헤더 스타일이 비슷하지만 다시 짠 코드. DRY 위반.
2. **검색은 있는데 위치가 어색** — 별도 header section에 있고, CSV 버튼과 같이 있어서 "필터" header가 또 따로 만들어짐.
3. **페이지네이션 두 개 (episode + trade)** — 각각 다른 페이지 상태인데 둘 다 상단.

### 전체 (cross-cutting)

- 표 chrome (header + body + footer) 패턴이 페이지마다 새로 짜여 있음. `<DataPanel>` 공유 컴포넌트가 없음.
- CSV 다운로드 affordance가 일부 표에만 있음 (Holdings ✓, Trades ✓, History ?, Reports ✗, StrategyRisk ✗).
- 정렬은 두 갈래 구현: TradesTable·PortfolioTables는 custom `sortRows` + `SortHeader`, ReportsTable·ScreenerTable은 TanStack table. accessibility(aria-sort)도 갈라짐.
- 페이지네이션 footer 톤이 다름 (TableControls의 PaginationControls는 grid 1fr/auto/1fr로 fix 했지만, ReportsTable은 자체 grid 사용).
- 버튼 스타일 혼재: `<button class="btn btn-sm btn-outline">` (daisyui) vs `<Button variant="outline">` (shadcn). PortfolioTables는 daisyui, ReportsTable은 shadcn.

## 2. 목표 (layout-focused)

- **`<DataPanel>` 단일 컴포넌트** — `components/ui/data-panel.tsx` (or 동등). 모든 dense 표가 chrome을 재사용.
- **표준 chrome 레이아웃**:
  ```
  ┌────────────────────────────────────────────────────────┐
  │ Title       count badge        [search] [CSV] [presets] │  ← header bar
  ├────────────────────────────────────────────────────────┤
  │  thead (sticky top-0, bg-slate-100, mono uppercase)     │
  │  tbody (scroll)                                          │
  ├────────────────────────────────────────────────────────┤
  │  총 N행 · 1/X쪽      [« 1 2 3 »]      페이지당 [25]      │  ← footer (grid 1fr/auto/1fr)
  └────────────────────────────────────────────────────────┘
  ```
- **모든 표가 동시에 갖춰야 할 affordance**:
  - 정렬 (정렬 가능 컬럼에 sort indicator + aria-sort)
  - 페이지네이션 (footer 중앙)
  - CSV 다운로드 (header 우측, 항상)
  - 글로벌 검색 (header 우측, 필요 시)
  - 빈 상태 UX (조건이 너무 좁을 때 명확한 reset 액션)
  - sticky header (이미 v0.21.21 batch 2에서 CSS 단에서 적용됨)

## 3. 단계별 실행

### Phase A. `<DataPanel>` 도입

1. `components/ui/data-panel.tsx` 신설. 다음을 받음:
   - `title: ReactNode`
   - `subtitle?: ReactNode` (optional row count, period 등)
   - `actions?: ReactNode` (CSV 버튼, etc.)
   - `search?: { value, onChange, placeholder }` (optional)
   - `children` (table area)
   - `pagination` (page, pageCount, totalRows, pageSize, onPageChange, onPageSizeChange)
2. `<DataPanel>`이 단일 box (외곽 border + 둥근 모서리), 내부 grid (header / body / footer).
3. 내부 table area는 `max-h-[72vh] overflow-auto` + sticky thead 자동 적용.

### Phase B. 마이그레이션 (한 PR에 한 표씩)

순서:

1. **PortfolioTables** (Holdings) — 가장 단순. 이중 box 제거, CSV 버튼 header로 이동, 페이지네이션 footer로 이동, 글로벌 검색 추가.
2. **TradesTable** — 2개 표(episodes/trades)를 각각 `<DataPanel>`로 감쌈. 검색·CSV가 panel header로.
3. **PortfolioHistory** — 동일.
4. **ReportsTable** — CSV 추가, panel로 마이그레이션.
5. **StrategyRiskTable** — CSV 추가, panel로 마이그레이션.
6. **screener-table** (마지막) — 이미 가장 완성형. panel API에 맞게만 다듬음.

### Phase C. 정렬 통일 (옵션, 별도 작업)

TanStack로 통일하거나, 현재 두 갈래(`sortRows` + TanStack)를 그대로 두되 `<DataPanel>` 안에서는 적어도 sort indicator·aria-sort 시각이 동일하도록.

## 4. 부가 결정사항

- CSV 파일명 규약: `snusmic-{view}-{strategy}-{snapshotDate}.csv`
- CSV BOM 유지 (한글 깨짐 방지) — `﻿` prefix
- 각 panel의 max-height는 `72vh` 표준 (이미 globals.css)
- 빈 상태는 모두 `<SearchX>` + 메시지 + reset 액션 패턴 (screener·reports에 이미 있음)

## 5. 별도 trackingThe per-strategy hierarchy (`/portfolio/[strategy]/{holdings,equity,trades,methodology}`) plan은 이 layout 작업 이후로 미룬다. 표 chrome이 통일된 후에 sub-route로 쪼개야 각 sub-route가 같은 panel 패턴을 다시 쓸 수 있음.
