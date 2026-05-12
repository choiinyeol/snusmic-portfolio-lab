# SNUSMIC Portfolio Lab

SNUSMIC Portfolio Lab은 서울대 SMIC 리서치 PDF에서 추출한 목표가·티커·발간일 데이터와 KRW 환산 일봉 가격을 결합해, **리서치 추천 → share-based 원장 → 포트폴리오 성과 → 전략 검증**을 한 화면에서 추적하는 정적 스냅샷 기반 투자 리서치 대시보드입니다.

현재 구조는 Python 데이터/시뮬레이션 파이프라인과 Next.js 정적 대시보드가 함께 동작합니다. 웹 제품명은 Portfolio Lab이며, 저장소/배포 이름도 `snusmic-portfolio-lab` / `smic-portfolio-lab`로 맞췄습니다.

- Python: PDF/가격 웨어하우스, share-based 증권 원장, 페르소나 시뮬레이션, 전략 후보 탐색, 웹용 JSON/CSV 생성
- Next.js: `data/web` canonical 아티팩트를 읽는 정적 리포트/포트폴리오/전략 대시보드와 YASUN.GG 레퍼런스 기반의 light fintech SaaS UI
- 원칙: 필수 아티팩트가 없으면 빠르게 실패합니다. 웹은 `data/web`의 canonical 아티팩트를 요구하고, public 복사본을 전략 데이터의 출처로 쓰지 않습니다.

> 전략 페이지는 “브로커 원장 전체 백테스트”가 아니라 **보고서 성과 기반 후보 실험/재구성**입니다. 실제 계좌형 페르소나 성과는 `data/sim`의 share-based 시뮬레이션이 기준입니다.

---

## 제품 방향

- 서비스명: **SNUSMIC Portfolio Lab**
- GitHub 저장소명: `snusmic-portfolio-lab`
- Vercel 프로젝트/도메인: `smic-portfolio-lab` / `https://smic-portfolio-lab.vercel.app`
- 성격: 실시간 주문 터미널이 아니라, 커밋된 정적 아티팩트로 리포트 추천·포트폴리오 원장·전략 성과를 검증하는 대시보드
- 핵심 화면: KPI 카드, 포트폴리오 treemap, 리스크 요약, 최근 리포트 피드, lightweight-charts 누적 수익률, 전략 성과표, “무엇을 어떻게 샀나” 포지션 테이프

---

## 현재 스냅샷

- 리포트 범위: 2020-10-31 → 2026-05-06
- 가격 범위: 2018-08-03 → 2026-05-11
- 웹 리포트 행: 221개
- 가격 매칭 리포트: 215개
- 목표가 도달률: 42.79% (92건)
- 시뮬레이션 적립금: 초기 1,000만원 + 월 적립, 누적 1.02억원

### 페르소나/벤치마크 성과 (`data/sim/summary.csv`)

| 페르소나 | 최종 평가금 | 순이익 | 현금흐름 가중 수익률 | CAGR | MDD | 거래 수 | 열린 포지션 |
|---|---:|---:|---:|---:|---:|---:|---:|
| All-Weather (25/25/25/25) | 228.19M | +126.19M | 31.26% | 16.25% | 9.46% | 186 | 4 |
| QQQ (NASDAQ-100) | 201.62M | +99.62M | 26.43% | 13.59% | 18.57% | 65 | 1 |
| SPY (S&P 500) | 176.58M | +74.58M | 21.28% | 10.81% | 14.86% | 65 | 1 |
| KODEX 200 (069500.KS) | 303.32M | +201.32M | 42.47% | 22.61% | 19.90% | 65 | 1 |
| GLD (Gold ETF) | 233.96M | +131.96M | 32.24% | 16.80% | 14.83% | 65 | 1 |
| SMIC Follower (1/N) | 165.91M | +63.91M | 18.87% | 9.53% | 19.17% | 2,005 | 37 |
| SMIC Follower (SL) | 171.17M | +69.17M | 20.08% | 10.17% | 18.85% | 1,513 | 10 |
| Weak Prophet (1M, capped) | 193.83M | +91.83M | 24.90% | 12.76% | 24.27% | 1,586 | 0 |
| SMIC MTT Optuna #1 | 358.51M | +256.51M | 49.16% | 26.50% | 46.90% | 120 | 3 |
| SMIC MTT Optuna #2 | 374.97M | +272.97M | 50.98% | 27.57% | 30.42% | 114 | 4 |
| SMIC MTT Optuna #3 | 325.17M | +223.17M | 45.25% | 24.21% | 44.44% | 64 | 2 |
| SMIC MTT Optuna #4 | 332.76M | +230.76M | 46.17% | 24.75% | 46.70% | 113 | 3 |
| SMIC MTT Optuna #5 | 322.43M | +220.43M | 44.91% | 24.02% | 46.63% | 116 | 4 |

해석상 주의:

- 기본 벤치마크는 All-Weather, QQQ, SPY, KODEX 200, GLD, SMIC Follower, SMIC Follower (SL), Weak Prophet입니다. Prophet은 기본 비교군에서 제외했습니다.
- KODEX 200이 이번 스냅샷의 최강 벤치마크입니다. Optuna로 선별된 `SMIC MTT Optuna #1~#5`는 모두 이 42.47% 현금흐름 가중 수익률을 초과해야만 `data/sim`과 `data/web`에 승격됩니다.
- SMIC MTT는 벤치마크가 아니라 실제 매매 후보 전략군입니다. 정수 주식·현금·수수료·세금·슬리피지를 원장에 남기며, train 2021-01-01~2023-12-31에서 Optuna로 파라미터를 찾은 뒤 2021-01-04~현재 전체 구간으로 재평가합니다.
- Optuna 후보는 전 구간에서 최강 벤치마크를 이기지 못하거나 이미 승격된 후보와 동일한 전 구간 매매결과를 내면 제외됩니다. 5개를 못 채우면 실행이 실패합니다.
- SMIC Follower v1/v2는 목표가 미도달 종목을 리밸런싱 때문에 매도하지 않습니다. v2도 매일 손절/목표가 신호를 판단할 뿐, 일별 동일가중 매도 리밸런싱은 하지 않습니다.
- Weak Prophet은 1개월 미래정보, 종목당 5% cap, 최소 22거래일 표본으로 약화한 상한선 성격의 벤치마크입니다.
- MDD는 음수가 아니라 **양수 손실폭**으로 해석합니다.

### 전략 후보 탐색 (`data/web/strategy-runs.json`)

- study: `smic-follower-v1`
- sampler: `train-selected-grid`
- train 후보군: 5,184개 grid 조합
- 대시보드 후보: train 2021-01-01~2023-12-31 상위 5개를 full 2021-01-01~현재 + holdout 2024-01-01~현재로 재평가
- best run: `smic-follower-v1-trial-2975`
- 전략 아티팩트: `data/web/strategy-runs.json`, `data/web/optuna-trials.json`, `data/web/parameter-importance.json`

전략 후보는 리포트별 사후 성과 테이블에서 파라미터 조합을 재구성한 실험입니다. 기본 탐색은 목표가 업사이드와 MTT 가격 추세 조건을 포함해 train 구간에서 후보를 선발한 뒤 full/holdout 구간에서 순위를 다시 매깁니다. 후보 그래프는 선택 종목의 실제 가격 경로를 이용해 일별 수익률을 재구성하지만, 실제 share-based 브로커 원장과 동일한 의미로 읽으면 안 됩니다.

---

## 저장소 구조

```text
.
├── apps/web/                         # Next.js 정적 대시보드
│   ├── app/reports/                  # 리포트 목록/상세
│   ├── app/portfolio/                # 현재 포트폴리오
│   ├── app/strategies/               # 보고서 성과 기반 전략 후보 실험
│   ├── components/                   # 차트/테이블 UI
│   └── lib/artifacts.ts              # data/web canonical artifact reader
├── data/
│   ├── warehouse/                    # 정규화된 리포트/가격/환율 웨어하우스
│   ├── sim/                          # share-based 페르소나 시뮬레이션 산출물
│   ├── optuna/                       # 전략 탐색 raw/export 산출물
│   └── web/                          # Next.js가 읽는 canonical JSON/CSV/price artifacts
├── scripts/
│   ├── run_persona_sim.py            # 페르소나 시뮬레이션
│   ├── run_optuna_search.py          # robust-grid 기본, 명시적 grid/random/optuna 전략 탐색
│   ├── export_optuna_artifacts.py    # 전략 탐색 결과 → data/web
│   └── refresh_web_artifacts.sh      # sim/search/web artifacts 일괄 갱신
├── src/snusmic_pipeline/
│   ├── cli.py                        # build-warehouse, refresh-prices, run-sim 등
│   ├── web_artifacts.py              # data/sim + warehouse → data/web
│   ├── strategy_search/              # 전략 후보 평가/탐색
│   └── sim/                          # share-based 시뮬레이션 엔진
│       ├── brokerage.py              # 정수 주식, 수수료, 세금, 슬리피지 원장
│       ├── market.py                 # PriceBoard / as-of 가격 조회
│       ├── runner.py                 # SimulationConfig dispatch
│       └── personas/                 # Prophet, Weak Prophet, SMIC Follower, SMIC MTT, All-Weather
└── tests/                            # Python 회귀 테스트
```

---

## 빠른 시작

### 1. Python 환경

```bash
uv sync --group dev
```

### 2. 웹 앱 의존성

```bash
pnpm --dir apps/web install
```

### 3. 데이터/웹 아티팩트 갱신

```bash
bash scripts/refresh_web_artifacts.sh
```

이 스크립트는 다음을 순서대로 실행합니다.

1. `uv run python -m snusmic_pipeline run-sim`
2. `uv run python scripts/run_optuna_search.py --sampler ${STRATEGY_SAMPLER:-robust-grid}`
3. `uv run python -m snusmic_pipeline export-web`
4. `uv run python scripts/export_optuna_artifacts.py`

`run-sim` 단계에서 실제 원장형 SMIC MTT 전략을 Optuna 400회로 탐색하고, 최강 벤치마크를 이긴 서로 다른 전 구간 결과 5개만 승격합니다. 별도의 `run_optuna_search.py` 단계는 `/strategies` 페이지용 리포트 성과 재구성 실험이며, 기본은 deterministic `robust-grid`입니다.

```bash
SMIC_BROKER_STRATEGY_TRIALS=800 bash scripts/refresh_web_artifacts.sh
STRATEGY_SAMPLER=optuna STRATEGY_TRIALS=100 bash scripts/refresh_web_artifacts.sh
```

`SMIC_BROKER_STRATEGY_TRIALS`는 실제 원장형 MTT 승격 탐색, `STRATEGY_SAMPLER=optuna`는 `/strategies` 페이지용 리포트 성과 실험을 조정합니다. 필요한 패키지나 아티팩트가 없으면 즉시 실패합니다.

### 4. 로컬 웹 실행

```bash
pnpm --dir apps/web dev
```

### 5. 정적 빌드

```bash
pnpm --dir apps/web build
```

---

## 주요 명령

### 웨어하우스/가격

```bash
uv run python -m snusmic_pipeline build-warehouse
uv run python -m snusmic_pipeline refresh-prices
uv run python -m snusmic_pipeline refresh-market
```

### 페르소나 시뮬레이션

```bash
uv run python scripts/run_persona_sim.py \
  --start 2021-01-04 \
  --end 2026-05-11 \
  --warehouse data/warehouse \
  --out data/sim \
  --broker-strategy-trials 400 \
  --broker-strategy-top 5
```

### 전략 후보 탐색

```bash
uv run python scripts/run_optuna_search.py --sampler robust-grid --train-start 2021-01-01 --train-end 2023-12-31 --full-start 2021-01-01 --top-candidates 5
uv run python scripts/export_optuna_artifacts.py
```

### 웹 아티팩트만 재생성

```bash
uv run python -m snusmic_pipeline export-web
```

---

## 산출물

### `data/sim`

- `summary.csv`: 페르소나별 최종 성과
- `broker_strategy_trials.csv`: Optuna 원장형 MTT 후보의 train rank, 전 구간 성과, 승격/제외 사유
- `equity_daily.csv`: 일별 mark-to-market 곡선
- `trades.csv`: 전체 매수/매도 체결 원장
- `current_holdings.csv`: 마지막 영업일 보유 포지션
- `position_episodes.csv`: 포지션 단위 진입/청산 episode
- `symbol_stats.csv`: 종목별 집계
- `equity_curves.png`, `drawdowns.png`, `net_profit_bar.png`, `portfolio_composition.png`: 시각화

### `data/web`

- `overview.json`: 대시보드 요약
- `reports.json`, `report-rankings.json`, `report-detail-metrics.json`: 리포트 화면 데이터
- `current-holdings.json`, `monthly-holdings.json`: 포트폴리오 화면 데이터
- `strategy-runs.json`, `optuna-trials.json`, `parameter-importance.json`: 전략 후보 화면 데이터
- `prices/*.json`: 심볼별 가격 차트 데이터. 가격이 없는 심볼은 `missing_price: true`로 명시합니다.

### `apps/web/public/downloads`

- 사용자가 내려받을 수 있는 CSV export만 위치합니다.
- 전략 화면의 source of truth는 public 디렉터리가 아니라 `data/web`입니다.

---

## 검증

이번 구조에서 최소 검증은 Python 회귀 + 웹 타입/빌드입니다.

```bash
uv run pytest tests/sim tests/strategy_search tests/test_web_artifacts.py -q
uv run ruff check src scripts tests
pnpm --dir apps/web typecheck
pnpm --dir apps/web exec biome check app/strategies app/reports lib/artifacts.ts components/strategies
pnpm --dir apps/web build
```

최근 변경 검증 기록:

- 2026-05-12 전략/아티팩트 갱신: `uv run pytest tests/sim tests/strategy_search tests/test_web_artifacts.py -q` → 76 passed
- 2026-05-12 전략/아티팩트 갱신: `uv run mypy src/snusmic_pipeline/sim` → passed
- 2026-05-12 전략/아티팩트 갱신: `bash scripts/refresh_web_artifacts.sh` → passed, `SMIC MTT Optuna #1~#5` 포함 artifact 갱신
- 2026-05-12 UI 리브랜딩: `uv run ruff check src scripts tests` → passed
- 2026-05-12 UI 리브랜딩: `uv run pytest tests/test_report_rows.py tests/test_web_artifacts.py -q` → 13 passed
- 2026-05-12 UI 리브랜딩: `pnpm --dir apps/web typecheck` → passed
- 2026-05-12 UI 리브랜딩: `pnpm --dir apps/web exec biome check ...` → passed
- 2026-05-12 UI 리브랜딩: `pnpm --dir apps/web build` → passed
- 2026-05-12 UI 리브랜딩: `python3 -m http.server 4311 --directory apps/web/out` + homepage text smoke → passed

---

## 설계 원칙

1. **Share-based accounting**: 모든 페르소나는 정수 주식, 현금, 가중평균원가, 수수료/세금/슬리피지를 원장에 반영합니다.
2. **Canonical artifacts**: 웹 전략 데이터는 `data/web`에서만 읽습니다.
3. **Fast-fail**: 필수 아티팩트가 없거나 schema가 맞지 않으면 조용히 빈 화면을 만들지 않고 즉시 오류로 드러냅니다.
4. **Real-account strategy first**: 실제 매매 전략은 `data/sim`의 원장 기반 페르소나로 평가하고, `data/web/personas.json`과 `trades.json`에 그대로 노출합니다.
5. **Report-performance experiment 분리**: 전략 후보 페이지는 리포트 성과 기반 재구성 실험이며, 계좌형 페르소나 시뮬레이션과 구분합니다.
6. **Positive MDD**: 최대낙폭은 양수 손실폭입니다.
7. **Generated data is reviewable**: `data/sim`, `data/web`, 다운로드 CSV를 같이 갱신해 대시보드와 저장소 상태를 맞춥니다.

---

## 면책

- 이 저장소는 투자 추천이 아닙니다.
- Weak Prophet은 미래 정보를 쓰는 약화된 상한선 벤치마크입니다. Prophet은 기본 비교군에서 제외되어 있습니다.
- SMIC Follower 계열은 리포트 발간 후 즉시 매수한다는 가상의 규칙을 평가합니다.
- yfinance 가격과 환율 데이터 품질에 따라 결과가 달라질 수 있습니다.
- 배당 재투자는 별도로 모델링하지 않습니다.
