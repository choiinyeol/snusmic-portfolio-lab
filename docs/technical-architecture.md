# Technical Architecture

저장소는 다음 verification-first domain chain을 중심으로 동작합니다.

- `ReportArtifact`: PDF, markdown, structured extraction 결과를 담는 source artifact
- `VerificationCase`: 리포트 주장(목표가/논지)의 PIT 사후 검증 단위
- `AlphaHypothesis`: 여러 검증 케이스에서 반복되는 selection rule
- `PortfolioStrategy`: alpha를 allocation/rebalance/risk rule로 연결한 benchmark proof
- `Execution trace`: 과거 daily 기준 buy/sell reason, quantity, fill, PnL 설명층

현재 코드 레이어:
- `src/snusmic_pipeline/ingest`: source discovery, PDF download, extraction, quality checks, markdown export
- `src/snusmic_pipeline/market_data`: currency and market-data normalization helpers
- `src/snusmic_pipeline/sim`: fixed account simulation, PIT warehouse IO, brokerage math, local daily-forward checkpoints, visualization
- `src/snusmic_pipeline/web`: Python-side web artifact contracts and exporters
- `apps/web`: static Next.js reader for generated JSON artifacts
- `scripts`: small CI/deployment utilities only

현재 제품은 working PIT/export pipeline 위에 verification→alpha→proof 계약을 직접 얹는 brownfield 구조입니다.

### Data Flow

1. `sync` and extraction commands produce `ReportArtifact` inputs.
2. `build-warehouse` writes typed PIT CSV tables.
3. `refresh-prices` writes OHLCV price history.
4. verification builders convert structured artifacts + PIT prices into `VerificationCase` records.
5. alpha promotion consumes verification cases and emits `AlphaHypothesis` candidates.
6. strategy proof consumes promoted hypotheses and benchmark data.
7. `export-web` writes verification / alpha / proof artifacts for the static app.

### Frontend Data Bridge

웹 앱은 커밋된 `data/web` artifact를 읽는 static reader입니다. Route file은 page view model을 호출하고 display-ready props를 React component에 전달해야 합니다. Low-level file read는 server-only artifact reader에 머물러야 하며, React component는 target-hit, split adjustment, benchmark coverage, report-window logic을 다시 계산하지 않습니다.

`data/web`는 verification-first chain을 반영해야 합니다.
- source side: report artifact / markdown / structured extraction 결과
- verification side: case-level quality와 veto 결과
- alpha side: repeated rule support/stability proof
- portfolio side: benchmark proof + historical execution trace

Portfolio time series는 계속 account shard로 읽을 수 있지만, product framing은 account ledger가 아니라 `PortfolioStrategy` proof여야 합니다. `external_artifacts` pointer는 선택적 운영 경로입니다.
현재 GA 기본 serving mode는 **local committed shards**입니다. `external_artifacts`는 hydrate / validate / build proof를 다시 통과한 경우에만 활성화합니다.

### Current Product Inventory

- `/`: VerificationCase board
- `/reports`: source report / evidence table
- `/reports/[symbol]/[reportId]`: report evidence detail
- `/calendar`: PIT observation-date diagnostics
- `/statistics`: validation-case outcome diagnostics
- `/portfolio`: portfolio proof catalogue
- `/portfolio/[account]`: selected strategy proof
- `/portfolio/[account]/holdings`: proof holdings
- `/portfolio/[account]/trades`: historical execution trace
