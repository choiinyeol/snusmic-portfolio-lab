# SNUSMIC Portfolio Lab

SNUSMIC Portfolio Lab은 서울대 SMIC 리서치 PDF에서 추출한 목표가·티커·발간일 데이터와 KRW 환산 일봉 가격을 결합해, **리서치 추천 → share-based 원장 → 포트폴리오 성과 → 전략 검증**을 추적하는 정적 스냅샷 기반 투자 리서치 대시보드입니다.

- Python: PDF/가격 웨어하우스, share-based 증권 원장, 페르소나 시뮬레이션, 웹용 JSON/CSV 생성
- Next.js: `data/web` canonical artifacts를 읽는 정적 Reports/Portfolio/Strategies 대시보드
- 원칙: 필수 아티팩트가 없거나 schema가 맞지 않으면 빠르게 실패합니다. `public/downloads`는 내려받기용 복사본일 뿐 source of truth가 아닙니다.

이 프로젝트는 실시간 주문·체결 제품이 아니며, 모든 화면은 커밋된 정적 아티팩트에서 계산됩니다.

## 제품 방향

- 서비스명: **SNUSMIC Portfolio Lab**
- GitHub 저장소명: `snusmic-portfolio-lab`
- Vercel 프로젝트/도메인: `smic-portfolio-lab` / `https://smic-portfolio-lab.vercel.app`
- 핵심 화면: Overview, Portfolio, Reports, Strategies, Screener, Guide
- 핵심 UI 원칙: 표는 기본적으로 정렬·필터·페이지네이션을 제공하고, 같은 행 데이터를 다루는 관심별 뷰는 하나의 공유 컬럼 테이블에서 정렬/필터 프리셋만 바꿉니다.

## 벤치마크와 고유 전략

벤치마크는 성과 비교 기준선이고, 고유 전략은 사용자가 선택해 검토할 수 있는 원장형 전략입니다.

### 벤치마크 세트

1. All-Weather
2. SMIC Follower v1
3. SMIC Follower v2 / SL
4. KODEX 200 (`069500.KS`)
5. QQQ
6. SPY
7. GLD
8. Weak Prophet — 미래정보 상한선 성격의 비교 기준

### 고유 전략

벤치마크 세트 밖의 persona는 고유 broker-ledger 전략입니다. 전략 화면의 개인 목표 게이트는 다음입니다.

```text
MDD <= 15% and return > KOSPI/KODEX 200 benchmark
```

수익률이 높아도 MDD가 15%를 넘으면 목표 통과로 표시하지 않습니다. MDD는 음수가 아니라 **양수 손실폭**입니다.

## 저장소 구조

```text
.
├── apps/web/                         # Next.js 정적 대시보드
│   ├── app/reports/                  # 리포트 목록/상세
│   ├── app/portfolio/                # 원장형 포트폴리오
│   ├── app/strategies/               # 벤치마크와 고유 전략 비교
│   ├── app/guide/                    # 사용 가이드/용어 설명
│   ├── components/                   # 차트/테이블 UI
│   └── lib/artifacts.ts              # data/web canonical artifact reader
├── data/
│   ├── warehouse/                    # 정규화된 리포트/가격/환율 웨어하우스
│   ├── sim/                          # share-based 페르소나 시뮬레이션 산출물
│   └── web/                          # Next.js가 읽는 canonical JSON/CSV/price artifacts
├── scripts/
│   ├── run_persona_sim.py            # 페르소나 시뮬레이션
│   ├── refresh_web_artifacts.sh      # sim/web artifacts 일괄 갱신
│   └── capture_yasun_reference.py    # 공개 HTML UI 레퍼런스 캡처(쿠키 미저장)
├── src/snusmic_pipeline/
│   ├── cli.py
│   ├── web_artifacts.py
│   └── sim/                          # share-based 시뮬레이션 엔진
└── tests/
```

## 빠른 시작

```bash
uv sync --group dev
pnpm --dir apps/web install
bash scripts/refresh_web_artifacts.sh
pnpm --dir apps/web dev
```

`scripts/refresh_web_artifacts.sh`는 최신 가격 기준일을 읽어 `run-sim`을 실행한 뒤 `data/web` artifacts와 다운로드 CSV를 갱신합니다.

## 주요 명령

```bash
# 웨어하우스/가격
uv run python -m snusmic_pipeline build-warehouse
uv run python -m snusmic_pipeline refresh-prices
uv run python -m snusmic_pipeline refresh-market

# 원장형 페르소나 시뮬레이션
uv run python scripts/run_persona_sim.py \
  --start 2021-01-04 \
  --end 2026-05-11 \
  --warehouse data/warehouse \
  --out data/sim \
  --broker-strategy-trials 400 \
  --broker-strategy-top 5

# 웹 아티팩트만 재생성
uv run python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
```

## 산출물

### `data/sim`

- `summary.csv`: 페르소나별 최종 성과, 현금, 보유 평가액
- `broker_strategy_trials.csv`: 원장형 MTT 후보의 평가 결과와 승격/제외 사유
- `equity_daily.csv`: 일별 mark-to-market 곡선
- `trades.csv`: 매수/매도 체결 원장
- `current_holdings.csv`: 마지막 영업일 보유 포지션
- `position_episodes.csv`: 포지션 단위 진입/청산 episode

### `data/web`

- `manifest.json`: schema version, generated timestamp, date ranges, row counts, checksums
- `overview.json`, `personas.json`: 대시보드/전략 요약
- `reports.json`, `report-rankings.json`, `report-detail-metrics.json`: Reports 화면 데이터
- `current-holdings.json`, `monthly-holdings.json`: Portfolio 화면 데이터
- `trades.json`, `position-episodes.json`, `equity-daily.json`: 원장/차트 데이터
- `prices/*.json`: 심볼별 가격 차트 데이터

## 검증

```bash
uv run ruff check src scripts tests
uv run pytest tests/sim tests/test_web_artifacts.py -q
pnpm --dir apps/web artifact:check
pnpm --dir apps/web typecheck
pnpm --dir apps/web exec biome check .
pnpm --dir apps/web build
```

## 설계 원칙

자세한 기술 구조와 UI/UX 원칙은 아래 문서를 따릅니다.

- [`docs/technical-architecture.md`](docs/technical-architecture.md)
- [`docs/ui-ux-principles.md`](docs/ui-ux-principles.md)

핵심 원칙:

1. **Share-based accounting**: 정수 주식, 현금, 가중평균원가, 수수료/세금/슬리피지를 원장에 반영합니다.
2. **Canonical artifacts**: 웹은 `data/web`만 source of truth로 읽습니다.
3. **Fast-fail**: 필수 아티팩트와 schema drift는 즉시 오류로 드러냅니다.
4. **Benchmark separation**: 벤치마크와 고유 전략을 UI/차트/테이블에서 분리합니다.
5. **Cash included**: 현금은 평가액과 포트폴리오 구성에 포함합니다.
6. **No live trading**: 실시간 주문, 체결 가능성, 수익 보장 문구를 금지합니다.

## 면책

- 이 저장소는 투자 추천이 아닙니다.
- Weak Prophet은 미래 정보를 쓰는 약화된 상한선 벤치마크입니다.
- SMIC Follower 계열은 리포트 발간 후 매수한다는 가상의 규칙을 평가합니다.
- 가격/환율 데이터 품질에 따라 결과가 달라질 수 있습니다.
- 배당 재투자는 별도로 모델링하지 않습니다.
