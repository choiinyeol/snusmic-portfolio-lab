# Simplification Candidates

Last updated: 2026-05-22
Status: deletion and consolidation plan, not yet executed

## Principle

지금은 삭제 실행보다 분류가 먼저다. 이 문서의 `delete candidate`, `archive candidate`, `merge candidate`는 바로 지우라는 뜻이 아니다. 각 항목은 참조 검색, 테스트, artifact 영향 확인 후 별도 cleanup PR에서 처리한다.

Core path는 다음 네 가지다.

```text
SMIC reports -> point-in-time pool -> account-level active trading strategy -> All Weather comparison
```

이 경로를 직접 돕지 않거나, 같은 의미를 여러 문서와 스크립트가 중복 설명하는 항목이 정리 대상이다.

## Docs

| 파일 | 현재 역할 | 추천 | 이유 | 제거 전 확인 |
| --- | --- | --- | --- | --- |
| `docs/handoff-codex.md` | 2026-05-19 기준 에이전트 인수인계 | keep historical, superseded | 에이전트 재진입 기록으로는 유용하지만 제품 목적 문서가 아니다 | 최신 운영 규칙은 `docs/agent-playbook.md`를 우선 |
| `docs/frontend-product-direction.md` | 프론트 제품 방향 메모 | merge candidate | UI 방향이 `DESIGN.md`, `docs/product-spec.md`와 겹친다 | 고유 UX 결정만 `DESIGN.md`나 `docs/ui-ux-principles.md`로 이동 |
| `docs/ui-ux-principles.md` | UI/UX 원칙 | keep | 테이블, 접근성, 비추천/비신호 톤을 지키는 active reference다 | `DESIGN.md`와 중복 문구만 정리 |
| `docs/navigation-architecture.md` | route map과 IA 규칙 | keep and update | route lifecycle과 중복 화면 방지에 유용하다 | 실제 Next.js route와 대조 |
| `docs/portfolio-restructure-plan.md` | 과거 포트폴리오 개편 계획 | archive candidate | 구현 완료 또는 방향 전환된 phase 문서일 가능성이 크다 | 미구현 체크리스트가 남았는지 `rg`로 확인 |
| `docs/v4-design-council.md` | 디자인 토론 산출물 | archive candidate | 최종 제품 계약이 아니라 의사결정 과정 기록이다 | 살아 있는 디자인 원칙만 `DESIGN.md`에 반영 |
| `docs/v4-minimal-insight-redesign.md` | 과거 redesign 계획 | archive candidate | 현 제품 목적은 active account backtest로 이동했다 | 실제 컴포넌트 참조가 있는지 확인 |
| `docs/data-surface-architecture.md` | artifact/page bundle 설계 | merge candidate | `docs/technical-architecture.md`, `docs/page-data-flow.md`와 중복된다 | 세 문서를 하나의 architecture doc으로 합치기 |
| `docs/page-data-flow.md` | route와 artifact map | merge candidate | technical architecture의 하위 섹션으로 충분하다 | 최신 route map인지 앱 라우트와 대조 |
| `docs/technical-architecture.md` | 기술 아키텍처 | keep and update | artifact-first 계약은 여전히 중요하다 | product spec 기준 objective gate 문구 갱신 |
| `docs/decisions/*.md` | 과거 결정 기록 | keep as archive | 의사결정 기록은 삭제보다 보존 가치가 있다 | canonical 문서가 아님을 상단에 표시 |

## Scripts

| 파일 | 현재 역할 | 추천 | 이유 | 제거 전 확인 |
| --- | --- | --- | --- | --- |
| `scripts/capture_yasun_reference.py` | 외부 UI 참고 HTML 캡처 | delete candidate | 핵심 백테스트 파이프라인과 무관한 일회성 UI 리서치 도구다 | `.omx/reference`나 docs에서 실행 지시가 남았는지 확인 |
| `scripts/run_strategy_generation_pipeline.py` | strategy generation wrapper | merge candidate | `python -m snusmic_pipeline generate-strategies`와 중복된다 | CI, README, shell script가 어느 entrypoint를 쓰는지 확인 |
| `scripts/export_web_artifacts.py` | export-web wrapper | merge candidate | `python -m snusmic_pipeline export-web`와 중복된다 | 외부 automation이 script path를 호출하는지 확인 |
| `scripts/run_stock_rule_search.py` | stock-rule search/admission CLI | archive or experimental | 현재 목적은 계좌 운용 규칙이며 stock-rule 탐색은 보조 실험이다 | strategy generation이 직접 의존하는 산출물 여부 확인 |
| `scripts/run_persona_sim.py` | share-based simulation runner | keep core for now | 계좌 원장 산출의 중심이지만 CLI와 역할이 겹친다 | 장기적으로 `snusmic_pipeline run-sim`으로 통합 가능 |
| `scripts/check_schema_compat.py` | schema compatibility gate | keep | artifact 안정성에 직접 기여한다 | 없음 |
| `scripts/export_schemas.py` | JSON schema export | keep | schema gate와 짝이다 | 없음 |
| `scripts/refresh_web_artifacts.sh` | 전체 artifact refresh | keep but simplify | 핵심 운영 명령이지만 uv 의존과 전략 생성 파라미터가 커졌다 | generate-strategies 기본값 정리 후 옵션 축소 |
| `scripts/prepare_vercel_prebuilt.sh` | Vercel prebuilt packaging | keep if CI uses it | 배포 파이프라인 전용이다 | GitHub Actions나 Vercel 설정 참조 확인 |
| `scripts/vercel_build.sh` | Vercel build wrapper | keep if Vercel uses it | 배포 진입점일 수 있다 | Vercel project build command 확인 |

## Python modules

| 경로 | 현재 역할 | 추천 | 이유 | 제거 전 확인 |
| --- | --- | --- | --- | --- |
| `src/snusmic_pipeline/sim/personas/all_weather.py` | 올웨더 benchmark | keep core | 핵심 비교 대상이다 | 없음 |
| `src/snusmic_pipeline/sim/personas/smic_follower.py` | 단순 SMIC 추종 baseline | keep core | “SMIC만 믿고 다 산다” 기준선이다 | 없음 |
| `src/snusmic_pipeline/sim/personas/smic_follower_v2.py` | 손절 포함 baseline | keep core | sell rule의 최소 비교군이다 | 없음 |
| `src/snusmic_pipeline/sim/personas/smic_mtt_strategy.py` | 실제 계좌형 추세 전략 | keep core | 사용자 목적과 가장 가깝다 | 테스트와 문서 강화 |
| `src/snusmic_pipeline/sim/personas/smic_rsi_reversal.py` | RSI 반전 전략 | experimental | 역추세 아이디어는 보조 실험이다 | 성과/사용 여부 확인 |
| `src/snusmic_pipeline/sim/personas/stock_rule.py` | stock-rule replay persona | experimental | 룰 탐색 산출물을 계좌로 재생하지만 현재는 복잡도 대비 목적이 흐리다 | strategy generation 의존성 확인 |
| `src/snusmic_pipeline/sim/stock_rule_search.py` | 벡터화된 stock-rule 탐색 | archive or rewrite candidate | factor zoo 성격이 강하고 현재 혼란의 중심이다 | 유의미한 룰만 새 strategy interface로 이식 |
| `src/snusmic_pipeline/sim/pit_research_board.py` | point-in-time board와 TA 지표 | keep but split | pool/candidate 생성에는 유용하지만 portfolio persona와 snapshot export가 섞여 있다 | board builder와 persona를 분리 |
| `src/snusmic_pipeline/sim/broker_strategy_search.py` | Optuna MTT 탐색 | keep experimental | 계좌형 매매 규칙 탐색이라 방향은 맞다 | objective와 train/test 계약을 backtest contract에 맞춤 |
| `src/snusmic_pipeline/sim/personas/prophet.py` | target-hit oracle | keep as benchmark only | 상한선 비교용이다. selectable strategy가 아니다 | UI에서 oracle 표기 유지 |
| `src/snusmic_pipeline/sim/personas/weak_prophet.py` | 미래정보 oracle | keep as benchmark only | 미래정보 상한선이다 | selectable 노출 금지 |
| `src/snusmic_pipeline/sim/personas/sharpe.py` | oracle weight solver | keep while oracle remains | prophet 계열 의존 | prophet 제거 시 함께 재검토 |
| `src/snusmic_pipeline/sim/strategy_generation.py` | 구조적 전략 생성 | keep but narrow | pipeline 중심이지만 stock-rule, PIT, broker 탐색이 한 파일에 모여 있다 | search families를 별도 modules로 분리 |

## Generated artifacts

| 경로 | 추천 | 이유 |
| --- | --- | --- |
| `data/sim/*` | never hand-edit | 시뮬레이션 산출물이다. 코드 변경과 같은 커밋에 섞이면 리뷰가 어려워진다 |
| `data/web/*` | never hand-edit | 웹 canonical artifact다. 재생성 커밋은 별도 제목으로 분리한다 |
| `apps/web/public/downloads/*.csv` | generated | `data/web`에서 복사되는 다운로드 파일이다 |

## Recommended cleanup order

1. README, product spec, backtest contract, agent playbook을 canonical로 확정한다.
2. stale handoff/design docs 상단에 superseded 표시를 붙인다.
3. CLI entrypoint 중복을 조사해서 script wrapper를 하나씩 제거한다.
4. stock-rule search를 experimental로 격리하고, 계좌형 MTT 전략 경로를 core로 남긴다.
5. generated artifact 변경과 source code 변경을 커밋 단위에서 분리한다.
