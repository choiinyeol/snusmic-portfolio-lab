# SNUSMIC Portfolio Lab 기술 아키텍처

Last updated: 2026-05-19

SNUSMIC Portfolio Lab은 아티팩트 기반의 리서치·포트폴리오·전략 검증 제품입니다. 웹 앱은 커밋된 캐노니컬 아티팩트를 읽는 정적 리더이고, 데이터 갱신·가격 매칭·시뮬레이션·내보내기는 Python 파이프라인이 소유합니다.

## 제품 계약

- **아티팩트 우선**: `data/web`이 프론트엔드의 진실의 원천입니다. 웹 런타임은 `public/downloads`나 외부 마켓 데이터를 직접 읽지 않습니다.
- **읽기 전용 스냅샷**: 페이지는 시점이 명시된 기준 데이터 뷰를 보여줍니다. 사용자 카피는 `기준 데이터`·`읽기 전용`·`가격 확인`·`전략 비교` 같은 사용자 언어를 우선하고, `Static Artifacts`·`canonical`·`data/web` 같은 구현 용어는 기술/데이터 품질 표면에만 등장합니다.
- **빠른 실패 스키마 경계**: 필수 아티팩트는 읽기·빌드 시점에 검증합니다. 필수 스키마가 어긋나면 실행 가능한 경로 메시지와 함께 빌드를 즉시 중단합니다. 비어 있는 분석으로 사용자를 오도하지 않습니다.
- **서버 우선 프론트엔드**: 서버 컴포넌트가 아티팩트를 읽고 정적 요약을 계산하며 카드·표를 렌더링합니다. 차트·트리맵·표 인터랙션 등 클라이언트 섬은 필요한 경우에만 분리합니다.
- **런타임 마켓 호출 없음**: 시장/환율 갱신은 빌드 이전의 Python 파이프라인이 담당합니다. Next.js 렌더에서 실시간 API를 호출하지 않습니다.
- **데이터 계보 가시화**: 모든 스냅샷은 가능한 한 스키마 버전·리포트 기간·가격 기간·시뮬레이션 기간·행 수와 주요 데이터 품질 카운트를 노출해야 합니다.

## 캐노니컬 아티팩트

프론트엔드가 직접 읽는 핵심 아티팩트는 `data/web`에 있습니다. 현재 Next.js 리더는 페이지가 소유하는 번들 경로를 캐노니컬로 다룹니다:

- `manifest.json` — 스냅샷 스키마 버전, 생성 타임스탬프, 행 수, 기간, 체크섬, 아티팩트 인벤토리.
- `overview/snapshot.json` — 스냅샷 윈도, 요약 행, 리포트 통계, 벤치마크 요약.
- `overview/research-pulse.json` — 메인 보드를 위한 컴팩트 인사이트/피드 행.
- `overview/data-quality.json` — 추출·리포트 제외·가격 매칭 품질 정보.
- `reports/table.json` — 리포트 단위 목표/가격 검증 행.
- `reports/rankings.json`, `reports/detail-metrics.json`, `reports/return-windows.json`, `reports/target-hit-distribution.json` — 리포트 페이지 프리셋과 상세 모듈.
- `portfolio/personas.json`, `portfolio/holdings.json`, `portfolio/monthly-holdings.json`, `portfolio/trades.json`, `portfolio/episodes.json`, `portfolio/equity-daily.json` — share-based 원장·보유·에피소드·equity 경로.
- `strategies/catalog.json`, `strategies/leaderboard.json`, `strategies/curves.json` — 벤치마크/전략/오라클 분류, 지표, 차트 곡선.
- `screener/candidates.json` — 리포트 기반 후보 행.
- `prices/*.json` — 차트/상세 페이지가 사용하는 종목별 가격 시계열.

`overview.json`·`reports.json`·`personas.json` 등 최상위 호환 export는 익스포터/테스트/다운로드 계약의 일부로 남아 있지만 프론트엔드의 기본 읽기 경로는 아닙니다.

필수 아티팩트는 동일 입력에서 결정적이어야 합니다. 생성된 행은 export 전에 결정적 정렬을 거쳐야 합니다.

## 벤치마크와 고유 전략 분류

비교 기준선과 선택 가능 고유 전략을 분리합니다.

### 벤치마크 세트

비교용 라인/카드로 표시할 뿐 고유 전략처럼 마케팅하지 않습니다:

1. `all_weather` — All-Weather 자산배분.
2. `smic_follower` — SMIC Follower v1.
3. `smic_follower_v2` — SMIC Follower v2 / 손절 기준.
4. `benchmark_kodex200` — KOSPI/KODEX 200 프록시.
5. `benchmark_qqq` — NASDAQ-100 / QQQ 프록시.
6. `benchmark_spy` — S&P 500 / SPY 프록시.
7. `benchmark_gld` — Gold / GLD 프록시.
8. `weak_oracle` — Weak Prophet 미래정보 기준선. 항상 미래정보 경고를 함께 표시합니다.

### 선택 가능 전략

벤치마크 세트 밖의 모든 페르소나는 선택 가능 broker-ledger 전략입니다. UI는 벤치마크와 별도 그룹으로 묶고 방법론을 명시해야 합니다. 프론트엔드는 이 분류를 `strategies/catalog.json`에서 읽어야 하며, 페르소나 ID에서 비즈니스 의미를 하드코딩하지 않습니다.

### 개인 목표 게이트

제품의 1차 게이트는 다음과 같습니다:

```text
MDD <= 15% and return > KOSPI/KODEX 200 benchmark
```

전략 표와 차트는 이 게이트를 직접 노출해야 합니다. 통과 후보가 없으면 명시적으로 그렇게 적습니다. 정렬된 수익률 표 뒤에 실패를 숨기지 않습니다.

## 정량 방법론 가드레일

- MDD는 양수 손실폭으로 표시합니다.
- 순위와 전략 비교에는 표본 크기를 함께 표시합니다.
- 벤치마크와 선택 가능 broker-ledger 전략을 시각적으로 구분합니다.
- 전략 생성 메타데이터를 노출할 때는 탐색/평가 윈도를 명시합니다.
- Weak Prophet은 미래정보 기준선임을 라벨링합니다.
- 가격 누락/하방/실행 불가 리포트 행은 리포트 검증 표에서 제외하고, 제외된 심볼 수를 데이터 품질 아티팩트로 노출합니다.
- 투자 자문, 실시간 체결, 보장 수익률을 시사하지 않습니다.

## CI / 검증 계약

머지/배포 이전 기본 검증:

```bash
pnpm --dir apps/web artifact:check
pnpm --dir apps/web typecheck
pnpm --dir apps/web exec biome check .
pnpm --dir apps/web build
uv run ruff check src scripts tests
uv run pytest tests/sim tests/test_web_artifacts.py -q
```

전체 파이프라인 재생성은 수동 또는 브랜치 게이트로 두지만, 아티팩트 스키마 검증과 웹 빌드는 일반 PR에서도 반드시 돌립니다.
