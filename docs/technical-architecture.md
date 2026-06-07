# Technical Architecture

이 저장소는 job별 layer로 나뉩니다.

- `src/snusmic_pipeline/ingest`: source discovery, PDF download, extraction, quality check, markdown export, report metadata model.
- `src/snusmic_pipeline/market_data`: currency 및 market-data normalization helper.
- `src/snusmic_pipeline/sim`: fixed account simulation, PIT warehouse IO, brokerage math, local daily-forward checkpoint, visualization.
- `src/snusmic_pipeline/web`: Python 측 web artifact contract와 exporter.
- `apps/web`: 생성된 JSON artifact를 읽는 정적 Next.js reader.
- `scripts`: 작은 CI/deployment utility만 둡니다. data refresh와 rebuild flow는 package CLI에 있습니다.

### 데이터 흐름

1. `sync`와 extraction command가 raw report row를 만듭니다.
2. `build-warehouse`가 typed PIT CSV table을 씁니다.
3. `refresh-prices`가 OHLCV price history를 씁니다.
4. `refresh-web-artifacts`가 account artifact를 최신 warehouse price date까지 전진시키고, deterministic/cross-reference check를 통과한 뒤 `data/web/**`를 씁니다.
5. `rebuild-web-artifacts`는 clean local regeneration이 필요할 때 fixed-account/PIT-board/web 전체를 다시 만듭니다.

### 웹 route

- `/`: 데이터 상태, 대표 계좌, 리포트/계좌/통계/캘린더 진입점을 정리하는 운영 허브.
- `/reports`: canonical report verification table.
- `/reports/[symbol]/[reportId]`: report evidence detail.
- `/statistics`: report-level outcome, concentration, price-path diagnostics.
- `/portfolio`: account chooser.
- `/portfolio/[account]`: account overview.
- `/portfolio/[account]/equity`: account equity와 trade path.
- `/portfolio/[account]/holdings`: current holdings.
- `/portfolio/[account]/trades`: trade ledger.

이 목록이 현재 web product inventory입니다. 이 밖의 route file은 구현 전에 product decision이 필요합니다.

### Frontend Data Bridge

웹 앱은 커밋된 `data/web` artifact를 읽는 static reader입니다. Route file은 `apps/web/lib/view-models/**`의 page view model을 호출하고, display-ready props를 React component에 전달해야 합니다. Low-level file read는 server-only artifact reader에 머물러야 하며, React component는 target-hit, split adjustment, benchmark coverage, report-window logic을 다시 계산하지 않습니다.

`data/web/pages/**`의 page bundle은 screen-level metadata, metric, view, warning, table/chart payload의 선호 shape입니다. `data/web/reports/**`, `data/web/portfolio/**`, `data/web/prices/**`의 canonical artifact는 재사용 가능한 데이터의 source of truth입니다. Portfolio time series는 `data/web/portfolio/equity/**` 및 `data/web/portfolio/daily-decisions/**`의 account shard이며, web app은 전체 simulation branch aggregate가 아니라 선택된 account shard를 읽어야 합니다. 큰 shard는 필요하면 `manifest.json`의 `external_artifacts` pointer를 통해 외부 mirror/object storage로 옮기고, build 전에 hydrate cache에서 다시 읽을 수 있어야 합니다.
`data/web/health.json`은 shell-level 서비스 상태와 내부 운영 점검을 함께 담는 health artifact입니다. Public UI는 사용 가능 여부와 기준일만 노출하고, missing-price coverage/action 같은 상세 조치 문구는 admin/release gate에서만 확인합니다. `apps/web artifact:check`는 현재 날짜 기준 price/report freshness threshold도 적용해 오래된 snapshot 배포를 막습니다.
`data/web/report-health.json`은 source report 240개 전체를 대상으로 "전사됨 / 추출 재검토 / 가격 누락 / 정책상 웹 제외"를 설명하는 리포트별 내부 진단 artifact입니다. Public Report Board는 이 artifact의 제외·오류 행을 직접 보여주지 않고, 검증 가능한 공개 후보와 전체 visible report table만 표시합니다. `missing-symbols.json`은 가격 누락 symbol의 category/action까지 포함해 상장폐지와 provider gap을 구분합니다.

### Cross-Platform Tooling

Project script는 Bash wrapper 대신 Node 또는 Python entrypoint입니다. `pnpm build`는 `scripts/vercel_build.mjs`를 호출하고, Vercel prebuilt output은 `scripts/prepare_vercel_prebuilt.mjs`가 준비하므로 macOS, Windows, Linux CI에서 같은 deploy build path를 씁니다.

### Contract

Python exporter가 data shape를 소유합니다. TypeScript Zod schema는 build time에 생성 artifact를 검증합니다. Frontend는 account taxonomy를 위해 `data/web/accounts/catalog.json`를 읽어야 하며, account-id string에서 의미를 추론하면 안 됩니다.
Symbol resolution은 `src/snusmic_pipeline/market_data/symbols.py`가 단일 source of truth입니다. Report extraction, warehouse normalization, yfinance suffix formatting은 이 registry의 company/ticker/exchange/yfinance/currency rule을 공유해야 하며, 신규 리포트 보정 rule을 `extract_pdf.py`나 `warehouse.py`에 별도 상수로 추가하지 않습니다.

Daily-forward checkpoint는 local replay cache입니다. committed product artifact가 아니며, 삭제하면 다음 run이 warehouse에서 다시 replay할 뿐입니다.
