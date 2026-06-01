# Technical Architecture

## 한국어

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
4. `refresh-web-artifacts`가 account artifact를 최신 warehouse price date까지 전진시키고 `data/web/**`를 씁니다.
5. `rebuild-web-artifacts`는 clean local regeneration이 필요할 때 fixed-account/PIT-board/web 전체를 다시 만듭니다.

### 웹 route

- `/`: report verification 및 report board.
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

`data/web/pages/**`의 page bundle은 screen-level metadata, metric, view, warning, table/chart payload의 선호 shape입니다. `data/web/reports/**`, `data/web/portfolio/**`, `data/web/prices/**`의 canonical artifact는 재사용 가능한 데이터의 source of truth입니다. Portfolio time series는 `data/web/portfolio/equity/**` 및 `data/web/portfolio/daily-decisions/**`의 account shard이며, web app은 전체 simulation branch aggregate가 아니라 선택된 account shard를 읽어야 합니다.

### Cross-Platform Tooling

Project script는 Bash wrapper 대신 Node 또는 Python entrypoint입니다. `pnpm build`는 `scripts/vercel_build.mjs`를 호출하고, Vercel prebuilt output은 `scripts/prepare_vercel_prebuilt.mjs`가 준비하므로 macOS, Windows, Linux CI에서 같은 deploy build path를 씁니다.

### Contract

Python exporter가 data shape를 소유합니다. TypeScript Zod schema는 build time에 생성 artifact를 검증합니다. Frontend는 account taxonomy를 위해 `data/web/accounts/catalog.json`를 읽어야 하며, account-id string에서 의미를 추론하면 안 됩니다.

Daily-forward checkpoint는 local replay cache입니다. committed product artifact가 아니며, 삭제하면 다음 run이 warehouse에서 다시 replay할 뿐입니다.

## English

The repository is layered by job:

- `src/snusmic_pipeline/ingest`: source discovery, PDF download, extraction, quality checks, markdown export, and report metadata models.
- `src/snusmic_pipeline/market_data`: currency and market-data normalization helpers.
- `src/snusmic_pipeline/sim`: fixed account simulation, PIT warehouse IO, brokerage math, local daily-forward checkpoints, and visualization.
- `src/snusmic_pipeline/web`: Python-side web artifact contracts and exporters.
- `apps/web`: static Next.js reader for generated JSON artifacts.
- `scripts`: small CI/deployment utilities only; data refresh and rebuild flows live in the package CLI.

### Data Flow

1. `sync` and extraction commands produce raw report rows.
2. `build-warehouse` writes typed PIT CSV tables.
3. `refresh-prices` writes OHLCV price history.
4. `refresh-web-artifacts` advances account artifacts to the latest warehouse price date and writes `data/web/**`.
5. `rebuild-web-artifacts` performs the full fixed-account/PIT-board/web rebuild when a clean local regeneration is needed.

### Frontend Data Bridge

The web app remains a static reader over committed `data/web` artifacts. Route files should call page view models, then pass display-ready props into React components. Low-level file reads stay in server-only artifact readers; React components should not recompute target-hit, split adjustment, benchmark coverage, or report-window logic.

Portfolio time series are account shards under `data/web/portfolio/equity/**` and `data/web/portfolio/daily-decisions/**`; the web app should read selected account shards rather than aggregate all simulation branches.
