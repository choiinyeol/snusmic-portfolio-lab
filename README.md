# SNUSMIC Quant Terminal

SNUSMIC Quant Terminal은 서울대 SMIC 리서치 PDF에서 추출한 목표가·티커·발간일 데이터와 KRW 환산 일봉 가격을 결합해, 리포트 기반 투자 페르소나와 전략 후보를 **재현 가능한 데이터 아티팩트**로 만드는 저장소입니다.

현재 구조는 Python 데이터/시뮬레이션 파이프라인과 Next.js 정적 대시보드가 함께 동작합니다.

- Python: PDF/가격 웨어하우스, share-based 증권 원장, 페르소나 시뮬레이션, 전략 후보 탐색, 웹용 JSON/CSV 생성
- Next.js: `data/web` canonical 아티팩트를 읽는 정적 리포트/포트폴리오/전략 대시보드
- 원칙: 숨은 대체 경로 없이 빠르게 실패합니다. 웹은 `data/web`의 canonical 아티팩트를 요구하고, public 복사본을 전략 데이터의 출처로 쓰지 않습니다.

> 전략 페이지는 “브로커 원장 전체 백테스트”가 아니라 **보고서 성과 기반 후보 실험/재구성**입니다. 실제 계좌형 페르소나 성과는 `data/sim`의 share-based 시뮬레이션이 기준입니다.

---

## 현재 스냅샷

- 리포트 범위: 2020-10-31 → 2026-05-06
- 가격 범위: 2018-08-03 → 2026-05-11
- 웹 리포트 행: 221개
- 가격 매칭 리포트: 215개
- 목표가 도달률: 42.79% (92건)
- 시뮬레이션 적립금: 초기 1,000만원 + 월 적립, 누적 1.02억원

### 페르소나 성과 (`data/sim/summary.csv`)

| 페르소나 | 최종 평가금 | 순이익 | 현금흐름 가중 수익률 | CAGR | MDD | 거래 수 | 열린 포지션 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Prophet | 11,739.21M | 11,637.21M | 228.96% | 142.92% | 20.41% | 542 | 2 |
| Weak Prophet (6M look-ahead) | 2,661.38M | 2,559.38M | 140.49% | 84.04% | 22.09% | 1,185 | 0 |
| SMIC Follower (1/N) | 165.91M | 63.91M | 18.87% | 9.53% | 19.17% | 2,005 | 37 |
| SMIC Follower v2 (with stop-loss) | 171.17M | 69.17M | 20.08% | 10.17% | 18.85% | 1,513 | 10 |
| All-Weather (25/25/25/25) | 228.19M | 126.19M | 31.26% | 16.25% | 9.46% | 186 | 4 |

해석상 주의:

- Prophet/Weak Prophet은 룩어헤드가 들어간 상한선입니다.
- SMIC Follower v1/v2는 목표가 미도달 종목을 리밸런싱 때문에 매도하지 않습니다. v2도 매일 손절/목표가 신호를 판단할 뿐, 일별 동일가중 매도 리밸런싱은 하지 않습니다.
- Weak Prophet은 빈 target basket이 나오면 보유분을 명시적으로 현금화합니다.
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
│       └── personas/                 # Prophet, Weak Prophet, SMIC Follower, All-Weather
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

기본 전략 탐색은 deterministic `robust-grid`입니다. Train 구간 상위 후보만 full/holdout 구간으로 재평가하며, plain Grid/Random/Optuna는 명시적으로 요청해야 합니다.

```bash
STRATEGY_SAMPLER=optuna STRATEGY_TRIALS=100 bash scripts/refresh_web_artifacts.sh
```

`--sampler optuna`는 optuna 패키지가 없으면 즉시 실패합니다.

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
  --out data/sim
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

- `uv run pytest tests/test_web_artifacts.py tests/sim tests/strategy_search -q` → 70 passed
- `uv run pytest tests/sim/test_personas.py -q` → 7 passed
- `uv run ruff check ...` → passed
- `pnpm --dir apps/web typecheck` → passed
- `pnpm --dir apps/web exec biome check ...` → passed
- `pnpm --dir apps/web build` → passed

---

## 설계 원칙

1. **Share-based accounting**: 모든 페르소나는 정수 주식, 현금, 가중평균원가, 수수료/세금/슬리피지를 원장에 반영합니다.
2. **Canonical artifacts**: 웹 전략 데이터는 `data/web`에서만 읽습니다.
3. **Fast-fail**: 필수 아티팩트가 없거나 schema가 맞지 않으면 조용히 빈 화면을 만들지 않습니다.
4. **Report-performance experiment 분리**: 전략 후보 페이지는 리포트 성과 기반 재구성 실험이며, 계좌형 페르소나 시뮬레이션과 구분합니다.
5. **Positive MDD**: 최대낙폭은 양수 손실폭입니다.
6. **Generated data is reviewable**: `data/sim`, `data/web`, 다운로드 CSV를 같이 갱신해 대시보드와 저장소 상태를 맞춥니다.

---

## 면책

- 이 저장소는 투자 추천이 아닙니다.
- Prophet/Weak Prophet은 미래 정보를 쓰는 상한선입니다.
- SMIC Follower 계열은 리포트 발간 후 즉시 매수한다는 가상의 규칙을 평가합니다.
- yfinance 가격과 환율 데이터 품질에 따라 결과가 달라질 수 있습니다.
- 배당 재투자는 별도로 모델링하지 않습니다.
