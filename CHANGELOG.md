# 변경 이력

이 프로젝트의 사용자 가시 변경사항을 모두 정리합니다. 릴리스의 진실은 git 태그이며, 본 파일은 태그 단위로 의도를 한국어로 기록합니다.

## v0.28.0-performance-contracts.1 — 2026-05-23

### 추가
- `web_contracts` Pydantic 모델을 추가해 웹 artifact 경계에서 manifest, portfolio, report, strategy 산출물의 구조를 명시적으로 검증합니다.
- `scripts/perf_semantic_smoke.py`를 추가해 기본 개발 루프에서 느린 전체 replay 대신 핵심 semantic/export 계약을 빠르게 확인할 수 있게 했습니다.
- market benchmark cache와 target adjustment 회귀 테스트를 추가해 계산 경로 최적화 후에도 의미가 흔들리지 않도록 고정했습니다.
- `docs/testing-performance-strategy.md`에 fast/slow/contract 테스트 계층과 릴리즈 검증 기준을 문서화했습니다.

### 변경
- 시뮬레이션 hot path는 Pandas 행 단위 계산 대신 NumPy 배열, vectorized 연산, 캐시 재사용을 우선하도록 정리했습니다.
- Pydantic은 계산 루프 내부가 아니라 입출력/웹 산출물 경계에 배치해 타입 안정성과 성능을 동시에 유지했습니다.
- 장시간 전체 replay 성격의 테스트는 `slow`/`contract` 계층으로 분리하고, 기본 `not slow` 테스트는 개발 중 빠르게 돌 수 있도록 재조정했습니다.
- 웹 artifact validator와 CI/deploy 스크립트가 새 계약 검증 및 fast smoke 경로를 사용하도록 맞췄습니다.
- price refresh와 public artifact 산출물을 재생성해 새 검증 계약과 현재 데이터 스냅샷을 일치시켰습니다.

### 검증
- `uv run ruff check ...` touched files 통과
- `uv run ruff format --check ...` touched files 통과
- `uv run mypy src` → `45 source files` 통과
- `uv run pytest -q -m "not slow"` → `163 passed, 23 deselected`
- `uv run pytest -q` → `186 passed`
- `uv run python scripts/perf_semantic_smoke.py` → `artifact_count=260`, `price_artifact_count=212`, `web_report_rows=202`, `summary_rows=8`
- Rebase 후 재검증: conflict marker 없음, `uv run python scripts/perf_semantic_smoke.py` 통과, `uv run pytest -q -m "not slow"` → `163 passed, 23 deselected`

## v0.27.0-daily-forward-checkpoints.1 — 2026-05-22

### 추가
- `daily-forward` CLI를 추가해 매일 새 가격/리포트만 들어오는 운영 경로에서 마지막 checkpoint 이후 거래일만 전진 처리할 수 있게 했습니다.
- `Account`, follower, follower v2, MTT, All Weather persona에 snapshot/restore와 persona-local daily step을 추가했습니다.
- `daily_decisions.csv`, `data/web/daily-decisions.json`, `data/web/portfolio/daily-decisions.json`을 생성해 매일 pool/candidate/buy/sell 의사결정을 감사할 수 있게 했습니다.
- `docs/product-spec.md`, `docs/backtest-contract.md`, `docs/agent-playbook.md`, `docs/incremental-forward-contract.md`, `docs/simplification-candidates.md`로 LLM/agent가 같은 목적과 실행 계약을 읽고 작업하도록 정리했습니다.

### 변경
- `scripts/refresh_web_artifacts.sh`의 기본 운영 경로를 full strategy generation에서 `daily-forward -> export-web`으로 바꾸고, full rebuild는 `scripts/full_rebuild_web_artifacts.sh`로 분리했습니다.
- checkpoint가 없거나 과거 가격/리포트/config/schema가 바뀌거나 요청 종료일이 checkpoint보다 과거이면 full replay fallback을 수행하고 `daily-forward-metadata.json`에 사유를 남깁니다.
- All Weather checkpoint 복원 시 과거의 유한한 rebalance calendar를 재사용하지 않고, 새 요청 기간으로 다시 계산한 future calendar를 유지하도록 수정했습니다.
- 웹 artifact validator가 daily decision metadata와 compact portfolio daily decision artifact를 필수 산출물로 검증합니다.

### 검증
- `ruff check src/snusmic_pipeline/sim/brokerage.py src/snusmic_pipeline/sim/personas/smic_follower.py src/snusmic_pipeline/sim/personas/smic_follower_v2.py src/snusmic_pipeline/sim/personas/smic_mtt_strategy.py src/snusmic_pipeline/sim/personas/all_weather.py src/snusmic_pipeline/sim/runner.py src/snusmic_pipeline/sim/forward_runner.py src/snusmic_pipeline/cli.py src/snusmic_pipeline/web_artifacts.py tests/sim/test_forward_runner.py tests/test_web_artifacts.py`
- `pytest tests/sim/test_strategy_generation.py tests/sim/test_stock_rule_search.py tests/sim/test_forward_runner.py tests/sim/test_decision_ledger.py tests/test_web_artifacts.py::test_daily_decision_artifacts_expose_checkpoint_metadata tests/test_web_artifacts.py::test_extended_web_artifacts_support_insights_and_downloads -q` → `24 passed`
- `bash scripts/refresh_web_artifacts.sh` → `daily-forward` `mode=noop`, `latest_date=2026-05-21`
- `pnpm --dir apps/web artifact:check` → `ok schema=1.0.0 reports=202 benchmarks=7 strategies=3 price_files=212`
- Architect verification: All Weather 월 경계 checkpoint bug fix 후 `APPROVE`

## v0.26.2-korean-strategy-labels.1 — 2026-05-22

### 변경
- `Stock Rule`, `PIT Research Board`, `Top 10`, `Weak Prophet`, `SMIC Follower`처럼 섞여 보이던 전략 표시명을 `종목룰`, `리서치보드`, `상위`, `미래정보 상한선`, `리포트 추종` 계열로 통일했습니다.
- stock-rule persona 생성기, PIT 리서치보드 기본 config, persona simulation loader, 웹 strategy catalog export가 같은 한글 라벨 계약을 쓰도록 맞췄습니다.
- `/portfolio`의 비교 기준선·효율 곡선 문구에서 `benchmark`, `oracle`, `frontier` 등 화면 노출 영어를 한글 설명으로 바꿨습니다.
- `data/sim`과 `data/web` 산출물 및 다운로드 CSV를 새 표시명으로 재생성했습니다.

### 검증
- `ruff check scripts/run_stock_rule_search.py scripts/run_persona_sim.py src/snusmic_pipeline/web_artifacts.py src/snusmic_pipeline/sim/pit_research_board.py src/snusmic_pipeline/sim/contracts.py tests/test_web_artifacts.py`
- `pytest tests/test_web_artifacts.py::test_strategy_catalog_uses_behavior_labels_and_admission_audit -q`
- strategy label scan: 주요 `data/sim`, `data/web`, 다운로드 산출물에서 예전 영어 표시명 없음

## v0.26.1-portfolio-objective-gate.1 — 2026-05-22

### 변경
- `/portfolio`가 더 이상 후보끼리의 efficient frontier만으로 전략을 노출하지 않고, `objective_passed=true`인 전략만 실제 포트폴리오 선택지로 보여주도록 수정했습니다.
- 목표 벤치마크·낙폭 기준을 통과한 전략이 없으면 포트폴리오 화면, 동적 전략 라우트, 사이드바 전략 수, 커맨드 팔레트가 모두 “승인 전략 없음/0개” 상태를 따릅니다.
- 메인 대시보드의 전략 차트와 best-strategy 요약도 objective-passed 전략만 사용하도록 맞췄습니다.

### 검증
- `pnpm --dir apps/web check`
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web build`

## v0.26.0-stock-rule-oos.1 — 2026-05-22

### 추가
- 개별 종목 룰 기반 `stock_rule_*` persona 10개를 strict point-in-time OOS admission으로 생성해 `/portfolio/[strategy]` 원장에 통합했습니다.
- stock-rule admission artifact가 실제 룰 패밀리(`target_upside_momentum`, `target_gap_reversal`, `price_momentum` 등)를 그대로 보존하도록 schema/test를 고정했습니다.
- OOS materialization gate를 추가했습니다: OOS Sharpe/Sortino `>= 0.7` 또는 OOS total return `>= 200%`, 그리고 OOS MDD `<= 65%`.
- `.omx/quant-insights/stock-rule-oos-admission-20260522.md`에 IS/OOS split, admission count, materialization gate, 병목 개선 결과를 기록했습니다.

### 변경
- `scripts/run_stock_rule_search.py` 기본 validation mode를 full-sample에서 strict OOS로 전환했습니다.
- stock-rule search가 동일 window의 report-state, returns, MA/RSI, rebalance index를 캐시해 1,368개 룰 grid 재생성 시간을 약 `78s`에서 `19s`로 줄였습니다.
- `generate-strategies` 경로도 `2023-01-02` 이후 stock OOS window와 `validation_mode=oos` artifact를 쓰도록 맞췄습니다.
- 목표가를 failure window 이후에 늦게 터치한 종목이 다시 coverage pool로 살아나지 않도록 stock-rule coverage failure 판정을 고정했습니다.
- OOS admission 계약이 없는 `pit_research_board_alpha_top*` 실험 persona는 자동 포트폴리오 노출에서 제외했습니다.
- `scripts/refresh_web_artifacts.sh`가 OOS stock-rule admission과 deployability gate를 기본값으로 사용합니다.
- README를 현재 `/portfolio/[strategy]` 중심 구조와 OOS stock-rule pipeline 기준으로 정리했습니다.

### 검증
- `ruff check scripts src tests`
- `pytest tests/sim/test_stock_rule_search.py tests/sim/test_persona_sim_loader.py tests/sim/test_stock_admission.py tests/sim/test_pit_research_board.py -q`
- `mypy src/snusmic_pipeline/sim scripts/run_stock_rule_search.py src/snusmic_pipeline/cli.py scripts/run_persona_sim.py scripts/run_strategy_generation_pipeline.py`
- `python scripts/run_stock_rule_search.py ... --validation-mode oos` → 1,368 searched / 75 IS finalists / 53 OOS admissions / 10 materialized personas
- `python scripts/run_persona_sim.py ... --disable-broker-strategy-search --stock-rule-personas data/sim/stock-rule-personas.json`
- `python scripts/export_web_artifacts.py --warehouse data/warehouse --sim data/sim --out data/web --check`
- `node scripts/validate-artifacts.mjs` → 15 strategies / 212 price files
- `scripts/vercel_build.sh` → 425 static pages

## v0.25.3-mpt-frontier.1 — 2026-05-20

### 변경
- `/portfolio` 메인의 전략 원장 표를 제거하고, 큰 현재 비중 히트맵을 먼저 보여준 뒤 compact 선택 버튼으로 전략을 고르게 바꿨습니다.
- 수익률/낙폭 곡선을 MPT efficient frontier 스타일로 재디자인해 benchmark 기준점, frontier 점선, 최대 위험조정 점수, 최소 낙폭 표시, hover/focus tooltip을 함께 제공합니다.
- KODEX200, QQQ, SPY, GLD, All-Weather 등 benchmark를 frontier 차트에 모두 추가하되, 실제 포트폴리오 선택 버튼은 All-Weather MWR 이상 전략만 남기도록 필터링했습니다.

### 검증
- `pnpm --dir apps/web check`
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web build` (정적 페이지 506개)
- static scan: `/portfolio` build output includes `KODEX200`, `QQQ`, `SPY`, `GLD`, removes `실제 전략 원장` and `<table` from the portfolio landing HTML

## v0.25.2-portfolio-ux-refine.1 — 2026-05-19

### 변경
- `/portfolio`의 큰 카드형 선택기를 조밀한 실제 전략 원장 테이블로 바꿔 전략 수가 늘어나도 한 화면에서 비교·선택할 수 있게 했습니다.
- portfolio frontier 차트가 실제 MDD/MWR 최소·최대값 기반 도메인과 패딩을 계산해 점들이 한쪽에 뭉치지 않도록 하고, hover/focus tooltip에 MWR·MDD·RP이자·보유 수를 표시합니다.
- `/portfolio/[strategy]` 상세 상단의 중복 전략 selector를 제거하고, `포트폴리오 선택`/`전략 비교` 복귀 버튼과 간결한 보고서 섹션 내비게이션으로 대체했습니다.
- `/portfolio/[strategy]/trades`의 `포지션 단위 매수·매도` 표를 제거하고 `매매내역` 단일 원장으로 통합했습니다.
- 사용자 노출 명칭을 `RP 대기자금`/`RP 비중`에서 `RP이자`/`RP이자 비중`으로 정리하고, 트리맵의 RP 항목은 0.00% 미실현 수익률 대신 현금성 RP이자 잔고로 설명합니다.

### 검증
- `pnpm --dir apps/web check:fix`
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web build` (정적 페이지 506개)
- `uv run python -m pytest tests/test_web_artifacts.py::test_accounting_reconciliation_explains_strategy_cash_vs_realized_pnl -q`
- static scan: portfolio build output has no `포지션 단위 매수`, `실제 운용 원장`, `RP 대기자금`, `RP 비중` strings

## v0.25.1-rp-cash-allocation.1 — 2026-05-19

### Changed
- Modeled idle portfolio cash as RP 대기자금 accruing 2.5% annual daily yield in the simulation ledger.
- Included RP cash in current allocation treemaps on portfolio overview, landing, and holdings views.
- Renamed portfolio cash-weight UI copy to RP 비중 / RP 대기자금 to make idle capital less confusing.

### Verification
- `uv run --with scipy python -m pytest tests/sim/test_brokerage.py tests/sim/test_personas.py tests/sim/test_runner.py tests/sim/test_all_weather.py -q`
- Regenerated `data/sim` and `data/web` artifacts through 2026-05-18 with existing promoted strategy configs.

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

## v0.25.0-portfolio-trade-narrative.1 — 2026-05-19

### 변경
- 포트폴리오/전략 화면의 버튼·탭·selector·pagination 계열 높이와 line-height를 키워 한글 라벨이 세로로 잘려 보이는 문제를 줄였습니다.
- `/portfolio` 선택 카드는 실제 전략만 고르는 화면이라는 역할을 더 명확히 하고, `/strategies`에는 비교 화면/실제 원장 역할 구분 카드를 추가했습니다.
- `/portfolio/[strategy]` overview에 `거래 이벤트 타임라인`을 추가해 PnL 차트 마커의 체결 사유와 리포트 근거를 hover 없이 읽을 수 있게 했습니다.
- `/portfolio/[strategy]/trades`를 원장 표 앞의 `거래 요약`, 큰 체결, `사유별 체결` 내러티브로 확장했습니다.
- `/portfolio/[strategy]/holdings` 상위 보유 섹션을 `리스크 집중`으로 바꾸고 비중, 미실현 수익률, 보유일, 목표가/리포트 근거를 함께 노출했습니다.
- `/portfolio/[strategy]/methodology`가 strategy catalog의 실제 `params`를 읽어 `실제 파라미터`로 표시합니다.

### 문서
- `DESIGN.md`, `docs/handoff-codex.md`, `docs/portfolio-restructure-plan.md`에 portfolio narrative phase 3와 `/strategies`/`/portfolio` 역할 분리를 반영했습니다.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web check`
- `pnpm --dir apps/web build`
- static/live scan: portfolio-only selector, timeline/trade narrative/risk/params copy, clipped-height class smoke

## v0.24.0-portfolio-dossier-phase2.1 — 2026-05-19

### 변경
- `/portfolio/[strategy]` 상세 헤더 KPI를 4개 핵심 지표(현재 평가액, 현금 비중, 미실현 손익, 누적 수익률)로 줄여 정보 위계를 정리했습니다.
- PnL/일별 평가 차트 tooltip의 매매 마커 설명에 종목, 매수/매도, 체결 금액, 수량, 체결 사유를 함께 표시하고, 차트 marker label에는 같은 날 같은 side의 합산 체결액을 압축 표기합니다.
- `/portfolio/[strategy]/holdings`에 treemap과 상위 보유 근거 카드 섹션을 추가해 큰 비중 종목에서 최신 리포트 근거로 바로 이동할 수 있게 했습니다.
- `/portfolio/[strategy]/methodology`를 Entry · 진입 → Rebalance · 편입/조정 → Exit / Risk · 청산 → Exceptions · 예외의 dossier형 운용 방법론으로 재구성했습니다.
- 상세 헤더의 `포트폴리오 원장` 라벨을 `운용 보고서`로 바꾸고, `/portfolio` landing에서 사용하지 않는 합산 평가/총 거래수 모델 필드를 제거했습니다. 실제 strategy ledger만 다루는 계약도 문서에 다시 고정했습니다.

### 문서
- `DESIGN.md`, `docs/handoff-codex.md`, `docs/portfolio-restructure-plan.md`에 portfolio detail phase 2의 KPI 축소, holdings 근거 연결, methodology 구조를 반영했습니다.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build`
- static/live scan: removed internal labels and excluded benchmark/follower/oracle labels/ids

## v0.23.2-portfolio-tab-contrast.1 — 2026-05-19

### 변경
- `/portfolio/[strategy]` 상세 탭의 active 상태에서 라벨과 count/meta 텍스트를 흰색으로 강제해 어두운 배경 위에서 보이도록 수정했습니다.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build`

## v0.23.1-hide-cash-check.1 — 2026-05-19

### 변경
- `/portfolio/[strategy]` overview에서 `cash check` / 확정 손익과 현금 검산 패널을 제거했습니다.
- `/portfolio` landing의 `합산 평가` 지표를 제거했습니다. 세 실제 전략을 단순 합산한 금액은 포트폴리오 선택 UX에 유의미하지 않아 노출하지 않습니다.
- 회계 검산은 `accounting-reconciliation.json`과 테스트/내부 데이터 계약으로만 유지하고, 사용자 화면은 보유·현금 비중·손익 경로·매매 시점·운용 로직에 집중합니다.

### 문서
- `docs/decisions/2026-05-14-plain-language-accounting.md`에 cash check는 내부 검산이라는 최신 UX 결정을 반영했습니다.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build`

## v0.23.0-portfolio-ledger-redesign.1 — 2026-05-19

### 변경
- `/portfolio`를 실제 투자 포트폴리오 3개만 고르는 랜딩으로 재구성했습니다. 현재 비중 treemap, 전략 전용 최적화 곡선, 포트폴리오 PnL 경로를 전면에 배치했습니다.
- `/portfolio/[strategy]`를 리포트 상세페이지형 dossier로 재구성하고 overview / holdings / equity / trades / methodology 하위 경로를 추가했습니다.
- KODEX200, All-Weather, GLD, QQQ, SPY, Follower SL, Follower v1, Weak Prophet은 portfolio 선택지·정적 경로·직렬화 모델·portfolio 링크에서 제거했습니다. 이들은 비교 기준/실험군이지 포트폴리오 원장이 아닙니다.
- 상세 포트폴리오 PnL 차트에 실제 매수/매도 마커를 얹어 손익 곡선과 거래 시점을 함께 보도록 했습니다.
- `/strategies` 위험표는 실제 선택 가능한 전략만 portfolio 링크로 보내고, benchmark/follower/oracle 행은 비교 표 안의 텍스트로만 남깁니다.
- `ReportsTable`을 `DataPanel` 기반으로 정리하고 컬럼별 sticky filter row, active filter chip, reset 흐름을 추가했습니다.
- `DataPanel` toolbar가 외부 검색 input ref를 받을 수 있게 해 dense table chrome 재사용성을 높였습니다.

### 문서
- `DESIGN.md`, `docs/handoff-codex.md`, `docs/portfolio-restructure-plan.md`에 portfolio는 실제 strategy ledger만 다룬다는 계약과 새 route/view-model 구조를 반영했습니다.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web check`
- `pnpm --dir apps/web build`
- `apps/web/out/portfolio`에서 제외 대상 persona 라벨/id exact-string scan

## v0.22.0-datapanel-unify.1 — 2026-05-19

ultragoal 7개 스토리 모두 완료. 모든 dense 표가 같은 chrome을 공유.

### 추가
- `components/ui/data-panel.tsx`: 공유 `DataPanel` + `CsvDownloadButton` + `EmptyTableState` + `downloadCsv`. header(title/subtitle/actions/search) + sticky table body + grid 1fr/auto/1fr footer(총 N행 · 페이지네이션 · 페이지당).
- 모든 dense 표에 CSV 다운로드 추가 (Holdings, Episodes, Trades, MonthlyHoldings, Reports, Strategies, Screener). UTF-8 BOM 통일로 Excel 한글 호환.

### 변경 (Phase B 마이그레이션 — 6개 표)
- **PortfolioTables**: 이중 box 제거, "포트폴리오 필터" 거짓 wrapper 제거, 검색 입력 추가, CSV 버튼 panel header로, 페이지네이션 footer 중앙.
- **TradesTable**: episodes + trades 두 표 모두 DataPanel. 공유 검색·side 필터 row 상단에. daisyui badge·select·input·btn 클래스 제거.
- **PortfolioHistory**: 3 sections → 2 (filter row 흡수). 월말 selector + CSV를 panel header로. daisyui form-control·btn 제거.
- **ReportsTable**: 기존 chrome 유지 + CSV 버튼 추가 (filtered rows, 19컬럼).
- **StrategyRiskTable**: 'use client' 변환, DataPanel 마이그레이션, 정렬 8 키 추가, title/csvFilename prop으로 벤치마크/고유 인스턴스 구분.
- **ScreenerTable**: 기존 chrome 유지 + CSV 버튼 (filtered rows, 30컬럼) 컬럼 모드 토글 옆.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.21.22-pagination-center.1 — 2026-05-19

### 변경 (페이지네이션 중앙 정렬)
- `.pagination-bar`를 flex+`justify-content: flex-end`에서 `grid-template-columns: 1fr auto 1fr`로 교체. 좌·중·우 3슬롯 grid로 페이지네이션을 항상 중앙에 고정.
- `PaginationControls` JSX 순서를 행수 표시 → BlockPagination → 페이지당 selector로 재정렬해 grid 중앙 슬롯이 페이지네이션과 일치하도록.
- 영향 받은 페이지: `/portfolio`의 PortfolioTables · TradesTable · PortfolioHistory.

### 문서
- `docs/portfolio-restructure-plan.md` 추가. portfolio를 페이지 내 탭에서 `/portfolio/[strategy]/{holdings,equity,trades,methodology}` 하위 라우트 객체로 재구성하는 제안 (실행 대기).

### 검증
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.21.21-screener-patterns-batch-2.1 — 2026-05-19

### 적용 (전역 테이블 sticky header)
- `globals.css`의 `.board-table-wrap` (StrategyRiskTable이 사용)과 `.table-wrap` (PortfolioTables, TradesTable이 사용)에 `max-height: 72vh` + `overflow: auto` 추가. 기존 가로 스크롤만 되던 컨테이너가 세로도 스크롤되며, 기존에 정의된 `th { position: sticky; top: 0 }` 규칙이 실제로 동작하기 시작.
- `.board-table thead th`에 Screener 헤더 톤(`bg-slate-100`, mono uppercase, tracking-wide, slate-600) 직접 적용해 시각 통일.
- 영향: `/strategies` 위험표, `/portfolio` 보유·매매 표가 모두 행 스크롤 시 컬럼명을 잡고 있음.

### 검증
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.21.20-screener-patterns-batch-1.1 — 2026-05-19

### 분석 (Screener 페이지 패턴 catalog)
- 사용자 평가: "/screener 진짜 잘 만든듯". 197개 종목을 dense table로 정렬·필터·페이징·기술적 지표·sparkline까지 보여주는 표준이 됨. 다른 페이지에 일괄 적용하기 위해 14가지 패턴을 정리.
- 핵심 affordance: 컬럼별 inline filter row (sticky `top-[31px]`), column visibility modes (core/price/all), preset 정렬+필터 조합 + presetCounts, useReducer for filters, useDeferredValue for global filter, sticky 2-row header, active filter count + clear-all, kind-driven column matching (`percent/number/boolean/text`), 빈 상태 UX, sparkline mini-chart.

### 적용 (ReportsTable batch 1)
- `useDeferredValue`로 global filter 적용. 타이핑 중 table re-render 부드러워짐.
- 헤더에 `sticky top-0 z-10` 추가. 행 스크롤 시 컬럼명 항상 보임.
- 표 컨테이너에 `max-h-[72vh] overflow-auto`로 수직 스크롤 활성화. 헤더 sticky가 동작.
- 헤더 background를 `bg-slate-100`으로 변경 (Screener와 동일 톤). 폰트도 mono uppercase로 통일.

### 후속 (대기)
- ReportsTable에 per-column filter row 적용 (sticky `top-[31px]`).
- ReportsTable column visibility modes (core/extended).
- `/strategies` leaderboard 표 동일 패턴 적용.
- `/portfolio` 다중 표 (StrategyRiskTable, PortfolioTables, TradesTable) 동일 패턴.
- 공유 `<UnifiedDataTable>` 컴포넌트 추출 (DESIGN.md §9 명시).

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.21.19-confirmation-signals.1 — 2026-05-19

### 변경 (분류 기준)
- Outcome 분류의 `upside` 임계값을 +20% → **+30%**로 상향. 약한 반등은 "상승 기회"로 보지 않음.
- 횡보·손실·치명적은 모두 **실패**로 그룹화 (기회비용 관점). `OUTCOME_CATEGORIES`에 `kind: 'success' | 'failure'` 필드 추가. `OutcomeBreakdownPanel` 헤더가 "성공 N건 · 실패 M건"으로 한 줄 요약.
- 새 분류 결과: 성공 (target+partial+upside) = 149건 / 실패 (flat+declining+devastating) = 48건. 치명적 손실은 +30% 상향 적용 시 18 → 24건.

### 추가 (고유 데이터: 만료 종가)
- `riskScatter` 타입에 `expiryCloseKrw` (KRW 절댓값), `expiryDate` (ISO 날짜) 필드 추가. `clipRowToWindow`가 윈도우 완료 시점에 채움.
- 리포트 상세 (`/reports/[symbol]/[id]`)에 "유효기간 종가 (500거래일)" fact row 추가. 종가 절댓값 + 날짜 + 수익률을 한 셀에. 윈도우 미경과 시 "진행 중" 표시.

### 변경 (회피 분석 — 손절 규칙 → 확인 신호 코호트)
- 사용자 피드백: "손절만하면 무책임. 더 다양한 걸 시도해라." 단순 stop-loss는 누구나 만들 수 있고, 또 진입 시점의 의사결정 정보는 아님.
- `EarlyExitRulesTable` 폐기. 대신 `ConfirmationSignalsTable` 신설.
- **위험 신호 코호트 3개** (해당하면 결과가 평균보다 나쁨):
  - 발간 후 60거래일 안에 +5% 한 번도 못 감 → n=46, 성공률 48% (baseline 76%), 치명적률 28%
  - 발간 후 20거래일 내 -15% 이상 drop → n=26, 성공률 38%, 치명적률 42%
  - 발간 후 5거래일 종가 음봉 → n=97, 성공률 66%, 치명적률 20%
- **확인 신호 코호트 3개** (해당하면 결과가 평균보다 좋음):
  - 발간 후 5거래일 안에 +5% 돌파 → n=65, 성공률 85%
  - 첫 +5%가 21–60거래일 사이 → n=25, **치명적률 0%**, target 72%
  - -5% 눌림 후 발간가 회복 → n=33, 치명적률 6%
- 각 셀에 baseline 대비 delta `(+/− X%)` 표기 — 신호 강도가 한눈에.
- `page.tsx`의 `buildConfirmationSignals`가 모든 리포트의 가격 시리즈에서 r5/r10/mae20/first_5pct_up/first_5pct_down server-side 계산.

### 변경 (페이지 카피)
- 사용자 피드백: "읽기 전용 같은 개발용 문구 다 빼라. SaaS라고 생각하고 만들어라."
- 다음 위치에서 "읽기 전용" 배지 / 카피 제거:
  - `app/layout.tsx` meta description (재작성)
  - `app/page.tsx` 홈 헤더 우측 emerald 배지
  - `components/ui/AppShell.tsx` 사이드바 상단 success 배지
  - `app/(app)/main/page.tsx` 메인 페이지 헤더 배지
  - `components/screener/screener-table.tsx` 푸터 라벨
  - `app/(app)/screener/page.tsx` 페이지 subtitle
- "정적 산출물 소스" 같은 개발자 카피도 GitHub nav link description에서 제거.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.21.18-early-exit-rules.1 — 2026-05-19

### 분석 (데이터에서 패턴 발견)
- 사용자 요청 "계속 하락하는 종목을 매수하지 않기 위한 통계는 없나?"에 응답해, 197개 표본 전체에서 발간 후 5/10/20거래일 수익률과 치명적 손실의 관계를 직접 분석.
- 핵심 발견:
  - **r5 (5거래일) ≤ -3%**: 치명적 손실 18건 중 11건이 이 신호 통과 (61% 회피). target 104건 중 18건도 잘못 손절 (17%).
  - **r10 (10거래일) ≤ -10%**: 치명적 18건 중 11건 (61%) 회피, target 손실 단 10/104 = 9.6%만.
  - **r20 (20거래일) ≤ -5%**: 치명적 18건 중 15건 (83%) 회피, 단점은 target 24/104 = 23% 잘못 손절.
- 사후 데이터로 보면 대부분의 치명적 손실은 발간 후 20거래일 이내에 이미 큰 폭으로 빠지기 시작. "발간 후 며칠 안에 -X% 이하" 형태의 조기 손절 규칙이 실제로 동작함.

### 추가 (조기 손절 규칙 테이블)
- `EarlyExitRulesTable` 신설. 6개 손절 규칙(5D/10D/20D × -3%/-5%/-10%)을 표로 비교.
- 각 행: 규칙 / 발동 표본 수 / 회피한 치명적률 / 놓친 목표률 / 차이.
- 가장 좋은 규칙(회피한 치명적률 − 놓친 목표률이 최대) 자동 강조 (emerald 배경).
- `page.tsx`에서 server-side로 모든 리포트의 r5/r10/r20을 가격 시리즈에서 직접 계산 → 각 규칙별 발동·결과 집계.

### 동기
- "어떤 패턴을 찾아내봐 직접." 직접 데이터를 봤더니 명확한 신호가 있음: 분석가 콜이 틀리는 케이스는 보통 발간 직후 즉시 빠짐. 들고 가다 운이 나빠진 게 아니라 처음부터 빠진 것.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.21.17-outcome-classification.1 — 2026-05-19

### 변경 (결과 분류)
- WholeSampleMap 점 색깔을 단순 도달 여부(hit10/08/06)에서 6단계 outcome 분류로 교체. 매수 후 "치명적 손실" 케이스를 명시적으로 분리해서 위험을 직접 보여줌.
  - **1.0x 목표 도달** (파랑) — hit10
  - **부분 도달 (0.6–0.8x)** (보라) — hit08 or hit06
  - **상승 기회 있었음** (청록) — 미도달이지만 발간 후 한 번이라도 +20% 이상
  - **횡보** (회색) — 큰 등락 없이 ±10% 안쪽
  - **손실 (-10% ~ -30%)** (호박) — 만료 종가가 -10% ~ -30%
  - **계속 하락 · 치명적 손실** (적색) — 발간 후 거의 못 오르고 만료 종가 -30% 이하
- 발간 후 거의 못 오르고 만료까지 깊게 하락한 케이스를 별도 카테고리로 빼는 것이 핵심. 매수해서 조금 오르거나 목표가 미도달은 큰 문제가 아니지만, 계속 하락만 한 케이스는 엄청난 손실이라는 사용자 피드백 반영.
- `DataPoint`에 'warning' (호박) tone 추가.

### 추가 (분류 패널)
- Q-Q plot 아래에 `OutcomeBreakdownPanel` 신설. 6개 카테고리별 표본 수, 가로 막대, 비율 일렬로 표시. 헤더에 "치명적+손실 N건 (X%)" 한 줄 요약.

### 변경 (Winners/Losers 균형)
- 하락 종목 명단을 5개 → 10개로 맞춤. Winners 10건 / Losers 10건 대칭.
- "발간 후 거의 못 오른 종목 5건의 가격 경로" → "...10건의 가격 경로"로 PricePathOverlay 캡션도 갱신.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.21.16-expiry-close.1 — 2026-05-19

### 추가 (만료 종가)
- 발간일 + 500거래일 시점의 종가 수익률을 별도 데이터 `expiryReturn`으로 산출. 고점(MFE)이 "윈도우 안에서 한 번이라도 도달한 최대 폭"이라면, 만료 종가는 "매도 신호 없이 끝까지 들고 갔을 때 끝 값". 두 지표가 같이 보이면 분석가 콜의 상한선과 baseline 보유 결과를 한 화면에서 비교할 수 있음.
- `ReportStatisticsLabSummary['riskScatter']` 타입에 옵셔널 `expiryReturn` 필드 추가. `clipRowToWindow`가 윈도우 길이가 500거래일을 채운 경우에만 값 채우고, 진행 중 리포트는 `null`.
- 노출 영역:
  - **WholeSampleMap DataPoint hover**: "만료 종가" 행 추가. 호버에서 고점·만료·최대 하락폭·목표 도달을 한 번에 비교.
  - **WinnersLosersBoard CaseList**: 각 종목 행 우측에 "고점 +X%" 메인 라벨과 "만료 +Y%" 보조 라벨 동시 표시. 헤더에 "고점 / 만료 종가 (500거래일)" 설명.
  - **DistributionSignature 하단**: "만료 종가 기준 (500거래일 경과 표본 N건): 중앙 X% · 평균 Y%" 한 줄. 고점과 만료의 의미 차이도 같이 명시.
  - **PricePathCandlestick**: 발간일 점선에 더해 마지막 바(만료 시점)의 종가 위치에도 가로 점선("만료") 추가. 차트 안에서 baseline·만료 두 reference price가 동시에 보임.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.21.15-500d-window.1 — 2026-05-19

### 변경 (500거래일 데드라인)
- `/statistics`의 모든 수익률·도달 지표를 발간일부터 500거래일(≈ 2년) 이내로 통일. 매도 타이밍을 모델이 알 수 없으니, 분석가 콜의 유효기간을 500거래일로 고정하고 그 구간 내의 고점이 도달했다면 도달한 것.
- `page.tsx`에서 server-side로 모든 리포트의 가격 시리즈를 500거래일 윈도우로 잘라 `maxFavorableExcursion`·`maxAdverseExcursion`·`hit10/08/06`을 재계산. `summary.riskScatter`를 통째로 교체해 downstream 모든 컴포넌트가 자동으로 500거래일 기준 데이터를 받음.
- 페이지 헤더에 "유효기간 500거래일 (≈ 2년)" 표기 추가.
- `FeatureBucketsTable`의 도달 중앙 일수도 500거래일 윈도우 내 첫 도달일로 재계산.

### 추가 (OHLCV 차트 + 종목 선택)
- `PricePathOverlay`에 종목 선택 모드 추가. 범례에서 종목을 누르면 멀티 라인 overlay에서 단일 OHLCV(캔들스틱) 차트로 전환.
- OHLCV 차트는 lightweight-charts v5의 `CandlestickSeries`로 렌더링. 발간일 종가 위치에 가로 점선(`createPriceLine`)으로 "발간" 표시.
- 헤더에 "← 전체 보기" 버튼과 "리포트 상세 ↗" 링크 추가. 전자는 멀티라인으로 복귀, 후자는 해당 리포트 상세로 이동.
- `PricePathSeries.points` (수익률 포인트) → `PricePathSeries.bars` (전체 OHLCV) 로 데이터 모델 교체. 500거래일 풀 해상도로 전송, 라인 뷰는 `closeKrw / baseKrw - 1`로 client-side 정규화.

### 검토 (코세스 089890.KQ)
- 데이터 파일은 정상(1903행, 2018-08 ~ 2026-05-18 완전 커버). 발간일 2023-10-19 기준 500거래일 윈도우 내 최고가는 2025-11-06의 32,400원 → MFE ≈ 251.79% (이전 화면 표시 162.76%는 expiry 캡 + close 기반이라 더 보수적). 500거래일 기준 적용 후 정상 수치로 표시.
- 별도 이슈: PDF 추출에서 `entry_price_native`가 9.6원으로 잘못 파싱됨(원본 "9,600원"의 콤마 처리 버그). 단 KRW 경로(`entry_price_krw = 9210`)는 가격 파일에서 직접 가져오므로 통계에는 영향 없음. Python 아티팩트 파이프라인 후속 작업 필요.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.21.14-peak-metric.1 — 2026-05-19

### 변경 (지표 기준)
- `/statistics`의 모든 수익률 통계 기준을 `currentReturn`(현재 수익률)에서 `maxFavorableExcursion`(발간 후 고점 수익률, MFE)으로 전환. 매도 타이밍은 모델이 알려줄 수 없으니, 분석가 콜이 만든 "고점 기회"를 측정 기준으로 삼는다는 사용자 의도 반영.
- 영향 받은 영역:
  - **DistributionSignature**: 평균/중앙/10% 절단 평균이 모두 MFE 기준. 마커 양극단 라벨 "손실/상승 꼬리" → "발간 시점/발간 후 고점"으로 교체. 카운트 "-20% 이하 / +20% 이상" → "1.0x 목표 도달 / 고점 +5% 미만"으로 교체.
  - **WholeSampleMap**: y축이 발간 후 고점. y축 음수 구간 제거(MFE ≥ 0). 점 색상은 hit10/hit08/hit06 도달 여부로 톤 결정. 헤딩 "전체 리포트 수익률 지도" → "전체 리포트 발간 후 고점 지도".
  - **WinnersLosersBoard**: MFE 기준으로 winners 정렬(고점이 가장 컸던 10건), losers 정렬(고점이 가장 작았던 5건 = 발간 후 거의 못 오른 종목).
  - **ConcentrationInsight**: (+) 수익 누적이 MFE 기준.
  - **VintageCohortTable**: 중앙 수익률이 MFE 기준.
  - **FeatureBucketsTable**: 중앙 수익률 + Mann-Whitney U 모두 MFE 기준.
- 발간일 갭 버킷 제거 (사용자 평가: "별로 의미 없는 거 같음").

### 추가 (Mann-Whitney U p-value)
- `FeatureBucketsTable`에 양측 Mann-Whitney U 검정 p-value 칼럼 추가. 각 버킷의 MFE 분포를 같은 차원의 나머지 표본과 비교.
- 표기: `0.034 **` 형태. 유의 수준 `*` p<0.1 / `**` p<0.05 / `***` p<0.01. 헤더에 미니 범례 1줄.
- 정규 근사 + tie-rank 보정 적용. 표본 크기 양측 5 미만이면 p-value 미산출(`—`).

### 추가 (네비게이션)
- `WholeSampleMap`의 모든 점, `WinnersLosersBoard`의 모든 행, `PricePathOverlay`의 모든 범례 항목이 클릭 시 해당 리포트 상세(`/reports/{symbol}/{reportId}`)로 이동.

### 변경 (가격 경로 차트)
- `PricePathOverlay`의 SVG 직접 렌더링을 `lightweight-charts` v5 기반 인터랙티브 차트로 교체. 줌·팬·crosshair·정확한 hover 값 제공.
- 거래일을 가짜 unix timestamp(2000-01-01 + 86400 × day)로 변환해 시간축에 매핑, `tickMarkFormatter`로 `{N}D`로 재라벨.
- 범례를 차트 아래로 분리 (회사명 색 swatch + 고점 수익률 + 클릭 가능 링크).

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.21.13-technical-features.1 — 2026-05-19

### 추가 (발간 시점 기술적 특성 → 결과)
- `/statistics`에 `FeatureBucketsTable` 컴포넌트 신설. 각 리포트의 발간 시점 기술적 특성에 따른 후행 결과(중앙 수익률·1.0x 도달률·도달 중앙 일수)를 한 테이블로.
- 분석 차원 3가지:
  - **추세 정배열**: 발간일 종가 > SMA20 > SMA50 > SMA200 여부. 정배열 / 비정배열.
  - **52주 고가 근접도**: 발간일 종가 / 직전 252거래일 최고가. 95%+, 80–95%, 80% 미만.
  - **발간일 갭**: 발간일 시가 / 직전 거래일 종가. +2% 이상, ±2% 이내, -2% 이하.
- `apps/web/app/(app)/statistics/page.tsx`에서 server-side로 모든 리포트의 풀 가격 시리즈를 가져와 발간 당일 기준 위 특성들을 계산하고, 표본을 버킷팅한 뒤 `getReportRows()`의 `daysToTarget`과 결합해 도달까지 일수까지 집계.

### 동기
- 사용자 피드백: "정배열인 주식이 얼마만에 잘 되더라 이런 특성들을 알고 싶은거야 — 스크리너에서 20/50/200SMA 쓰는거나 신고가 근접이나 gap 같은거 쓰는것처럼." 발간 시점 가격 동작이 후행 성과를 가르는 폭을 직접 노출.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.21.12-price-path-overlay.1 — 2026-05-19

### 제거 (집계만 보여주던 섹션)
- `/statistics`에서 200개 표본의 cross-section 평균에 가까운 집계 섹션을 모두 제거. holding effect에 압도되어 정보 가치가 낮다는 사용자 피드백 반영.
  - `RiskScatter` (전체 표본의 최대 상승폭·최대 하락폭) — y축 1.5x 클리핑이 있어 1800% 같은 outlier도 잘렸음.
  - `FractionalHitFigure` (목표가 도달률 + Wilson CI) 및 그 상위 컨트롤 섹션 전체.
  - `DelayHeatmap` (진입 시점별 결과) 및 그 컨트롤 섹션 전체.
  - `ControlStrip` 컴포넌트 (호출자 사라짐).
- `useState` import도 같이 제거 (남은 페이지가 전부 서버 상태로만 동작).

### 추가 (개별 종목 가격 경로)
- `PricePathOverlay` 컴포넌트 신설: 발간 당일을 0%로 두고 거래일 경과에 따라 누적 수익률을 SVG line으로 그림.
  - 상위 10건 (가장 크게 간 종목들) — 에메랄드 톤
  - 하위 5건 (가장 크게 빠진 종목들) — 로즈 톤
  - y축은 ±50% 안쪽 선형 + 바깥 log10 압축 signed-log (HD현대일렉트릭 +1800% 끝까지 보임)
  - x축은 거래일 단위, 0/30/60/120/250/500/1000D tick
  - 각 라인 끝에 회사명 + 최종 수익률 라벨
  - 라인 색 진하기는 순위에 따라 변화 (1등이 가장 진함)
- `apps/web/app/(app)/statistics/page.tsx`에서 server-side로 winners/losers 가격 경로 계산. `getPriceSeries(symbol, publicationDate)`로 발간일부터 종가 시리즈를 가져와 60 포인트로 리샘플 후 클라이언트로 전달.
- `ReportStatisticsStory`가 새 prop `pricePaths: { winners, losers }`를 받음.

### 동기
- 사용자 피드백: "전체 통계라서 왜곡 가능. 차라리 개별 누적수익률 또는 가격 경로 그래프를 두는 건 어때? 성공하는 주식/실패하는 주식의 가격 추이." 종목 단위 raw 경로가 200개 집계보다 retail 인사이트가 큼.

### 후속 (다음 이터레이션)
- "정배열인 주식이 얼마만에 잘 되더라" — 발간 시점 기술적 특성(SMA20/50/200 정배열, 52주 신고가 근접, 갭) → 결과 outcome 분석 테이블. 현재는 인프라(getPriceSeries 활용 패턴)까지 정리됨.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.21.11-formal-report-tone.1 — 2026-05-19

### 변경 (페이지 톤)
- `/statistics` 페이지에서 SaaS 랜딩 페이지 스타일 히어로(eyebrow + 큰 트래킹 타이트 헤드라인 + 본문 prose paragraph)를 완전히 제거. 대신 minimal 페이지 헤더(`<h1>리포트 통계</h1>` + 1줄 메타 "기준일 · 표본 · 티커")로 교체.
- 각 섹션의 `StorySection` 래퍼(kicker + 큰 h2 + body prose) 패턴을 제거. 각 figure는 자체 `<h3>` 캡션을 갖고 있어서 외부 wrapper title이 중복이었음. 그냥 `<section>`으로 감싸기만.
- 차트 아래 marketing 문장형 `InsightLine` (강조 prose with bold) 블록을 모두 제거. 도달률·진입 시점 같은 interactive 섹션에서는 figure 위 `<header>`에 한 줄 사실 캡션으로 핵심 숫자 노출 (bold 없음, plain text).
- `DataNoteFooter`의 두 줄 prose("거래비용 미반영, 학습 자료") → 한 줄 메타 라인으로.
- `DistributionSignature` 하단 instructional 캡션("평균이 중앙값보다 크고 절단 평균이 더 작다면...") 제거.

### 제거 (구조)
- `StorySection`·`InsightLine` 컴포넌트 삭제 (호출자 모두 사라짐).
- 미사용 import `ReactNode` 제거.

### 동기
- 사용자 피드백: "히어로 카피 제발 다 빼세요. 그냥 제목-내용-figure 이런식으로 노멀하고 포멀하게 갑시다." 이 페이지는 SaaS 제품이 아니라 학부 동아리의 데이터 산출물이고, 마케팅 hero·subhead·body prose는 false flair.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.21.10-statistics-deep-change.1 — 2026-05-19

### 동기
- 사용자 피드백: "200개 주식 전체 통계는 의미 없다. q-q plot 하나만 맘에 드는데 상단이 막혀 있어서 별로다. HD현대일렉트릭은 1800% 갔는데." 평균·도달률 같은 cross-section aggregate는 holding effect에 압도되어 retail 독자에게 인사이트를 못 준다는 것. 페이지의 구조와 콘텐츠를 종목 단위 인사이트 중심으로 다시 짬.

### 변경 (Q-Q plot)
- `WholeSampleMap` y축 클리핑(`Math.min(1.5, value)`) 제거. ±50% 안쪽은 선형, 바깥은 log10 압축한 signed-log 스케일로 교체. HD현대일렉트릭 +1800% 같은 outlier가 잘리지 않고 끝까지 보임.
- y축에 의미 있는 tick label 추가(-80%/-50%/-20%/0%/+20%/+50%/+100%/+200%/+500%/+1000%/+2000%, 관측 최댓값에 맞춰 동적). 0% 라인 강조.
- 상위 3개 종목의 회사명을 점 옆에 인라인 라벨로 표시. `DataPoint`에 `annotation` prop 추가.
- 차트 높이 320px → 448px로 키워서 dominant visual로 만들고, "꼬리 개수" 사이드 패널은 제거(분위수 테이블만 유지).

### 추가 (종목 단위 인사이트)
- `WinnersLosersBoard`: 가장 크게 간 종목 10건 + 가장 크게 빠진 종목 5건. 회사명·티커·발간일·목표 도달 여부·현재 수익률을 표 형태로. 평균 뒤에 숨어 있던 이름들을 직접 보여줌.
- `ConcentrationInsight`: 전체 (+) 수익률 합을 100%로 두고 상위 1/3/5/10/25건이 차지하는 비중을 가로 바로 표시. "수익은 몇 종목이 만들었나"라는 retail 핵심 질문에 직접 답.

### 제거 (aggregate-만-보여주는 섹션)
- `TriggerFrontier` (눌림목 vs 돌파 진입 규칙) 제거 — academic, retail 의사결정에 직결되지 않음.
- `PostTargetDrift` (목표가 도달 후 +5/+20/+60/+120D 분포) 제거 — 표본 전체 aggregate.
- `TargetMultipleCurve` (목표 배수별 보상/신뢰 점수) 제거 — 합성 점수가 retail 직관에 안 잡힘.
- `RangeBar` 헬퍼 동시에 제거 (호출자 사라짐).

### 변경 (히어로 카피)
- "발간된 리포트는 실제로 어디까지 갔을까요" → "큰 수익은 누가 만들었을까요". 본문도 "누가 크게 갔고, 누가 빠졌고, 전체 수익이 얼마나 소수에 집중됐는지"로 재정렬.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.21.9-statistics-saas-rewrite.1 — 2026-05-19

### 변경 (톤 · 카피)
- `/statistics` 페이지 톤을 학술 자기방어 disclosure 형식에서 SaaS 랜딩 페이지 톤으로 재작성. 일반 개인 투자자가 평소 궁금해할 질문("리포트가 실제로 어디까지 갔나", "당일 못 사면 결과가 달라지나", "목표가 닿은 뒤에는") 중심으로 헤딩과 본문 카피를 다듬음.
- 히어로: "리포트 통계 실험실" → "리포트 성과", "평균보다 먼저 볼 것은 분포입니다" → "발간된 리포트는 실제로 어디까지 갔을까요". 정규분포·꼬리·분위수 같은 quant 용어를 본문에서 제거하고, 보고자 하는 것(도달률·중간 손실·도달 후 흐름)을 한 줄로 요약.
- 각 섹션 kicker를 "01 · …" 번호 형식에서 짧은 카테고리 라벨("전체 분포", "경로 유형", "목표가 도달률", "진입 시점", "진입 규칙", "도달 후 흐름", "익절선", "경로의 굴곡")로 교체. 본문에서 "fat-tail", "검정 대기열", "가짜 돌파" 같은 용어 정리.
- `FractionalHitFigure`·`VintageCohortTable`의 "95% Wilson CI" 라벨을 일반 표현 "추정 범위"로 교체. 신뢰구간 시각화는 그대로 유지하되 academic 표기만 제거.

### 변경 (구조)
- 학술 disclosure 패널 `LimitationsPanel`(상장폐지/거래비용/생존편향/팩터 보정 부재 등 7가지 한계 나열)을 제거. 대신 페이지 하단에 가벼운 `DataNoteFooter`(기준일 + 표본 + "거래비용 미반영, 학습 자료" 한 줄)로 교체.
- 하단 다크 "해석 원칙" 패널 제거(disclaimer 톤 너무 무거움). 대신 `DataNoteFooter` 한 단락에서 같은 정보를 형식적으로 처리.

### 동기
- 사용자 피드백: "통계 잘하는 게 아니라, 일반인에 공감하고 일반 개인 투자자라면 어떤 정보가 궁금해할지를 생각하는거지." 페이지의 데이터·차트·계산은 그대로 두고 표현 방식만 retail-empathy 톤으로 재정렬.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.21.8-skew-kurt-trim.1 — 2026-05-19

### 변경
- `/statistics` DistributionSignature에서 표본 왜도(skewness)와 초과 첨도(excess kurtosis) 마커를 제거. 학부 SMIC 동아리 표본에서 4차 모멘트 raw 숫자는 일반 독자에게 직관이 잘 잡히지 않고, 데이터 자체가 거래정지·상장폐지·트랜잭션비용을 포함하지 않는 상황에서 academic 정밀도를 더하는 것이 false precision으로 이어진다는 판단. 대신 평균-중앙값-10% 절단 평균의 시각적 정렬과 -20%/+20% 꼬리 카운트로 fat-tail 직관을 유지.
- Wilson 95% CI 밴드, 트림 평균 마커, VintageCohortTable, LimitationsPanel은 유지(이쪽은 데이터 한계를 명시하는 방향이라 false precision 위험이 없음).
- `lib/report-statistics.ts`에서 더 이상 호출되지 않는 `sampleSkewness`·`excessKurtosis` export 삭제.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

---

## v0.21.7-statistics-rigor.1 — 2026-05-19

### 변경 (경로)
- `/reports/statistics` 경로를 `/statistics`로 이전. 사이드바·메인·`/reports`·`/guide`·홈에서 가리키던 모든 링크를 새 경로로 갱신.

### 추가 (통계 엄밀성)
- 스탠퍼드·MIT·시카고 부스 관점의 6인 quant 합의 리뷰에서 채택한 항목을 우선 반영. **KOSPI 알파/팩터 보정/거래비용은 의도적으로 추후 작업**으로 분리하고, 이번 릴리스에서는 다음과 같이 본 페이지에 한정된 통계적 엄밀성을 우선 보강한다.
- `lib/report-statistics.ts`에 4개의 순수 헬퍼 추가: `wilsonCI`(95% Wilson 점수 신뢰구간), `trimmedMean`(대칭 10% 트림 평균), `sampleSkewness`(Fisher-Pearson 표본 왜도), `excessKurtosis`(초과 첨도). n<100 에서 정규 근사가 무너지는 점, fat-tail 분포에서 산술 평균이 소수 관측치로 왜곡되는 점을 직접 시각화하는 데 사용.
- `FractionalHitFigure`(상승·하락 도달률 바)를 Wilson 95% CI 밴드 + 점추정 굵은 선 + `[lo, hi]` 라벨 형태로 재작성. 표본 수가 적은 멀티플(예: 10.0x 도달)에서 시각적으로 신뢰구간이 얼마나 넓은지 즉시 보이도록 했다.
- `DistributionSignature`에 트림 평균·왜도·초과 첨도·표본 크기·유효 티커 수 마커를 추가. 왜도/첨도가 0이 아닌 fat-tail 표본에서 평균과 중앙값의 괴리를 함께 읽도록 한다.
- `VintageCohortTable` 신설(발간연도별 표본·도달건수·도달률·95% Wilson CI·중앙 수익률). 시장 국면이 다른 해의 표본을 한 번에 평균내지 않도록 코호트 분해.
- `LimitationsPanel` 신설: 이 페이지가 측정하지 않는 것을 상단에 명시 — KOSPI/KOSDAQ 동시점 알파 미차감, 거래비용·슬리피지·시장 충격 미반영, 상장폐지/거래정지 종목의 종료 가격 누락(생존편향), 발간 시점 implementable lag, 섹터/시가총액/모멘텀 등 팩터 보정 부재. 절대 수익률을 알파로 오독하지 않도록 한 단락에 못박는다.

### 검증
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build` (정적 페이지 413개)

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
