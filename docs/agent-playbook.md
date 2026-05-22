# Agent Playbook

Last updated: 2026-05-22
Status: canonical agent guidance

## North star

이 저장소는 SMIC 커버 종목으로 적립식 계좌를 운용했을 때 올웨더보다 더 벌 수 있는지 검증하는 백테스트 랩이다. 앞으로의 코딩 에이전트는 리포트 분류표, UI 숨김 처리, 전략 이름 정리에 빠지기 전에 이 질문으로 돌아와야 한다.

## Canonical docs

| 문서 | 역할 |
| --- | --- |
| `docs/product-spec.md` | 무엇을 만들고 왜 만드는지 |
| `docs/backtest-contract.md` | 전략 시뮬레이션이 지켜야 하는 회계, 시간, lookahead 계약 |
| `docs/incremental-forward-contract.md` | 매일 가격 업데이트 후 forward replay와 daily decision artifact 계약 |
| `docs/agent-playbook.md` | 에이전트가 작업할 때의 판단 규칙 |
| `DESIGN.md` | UI와 제품 톤. 단, 제품 목적은 product spec을 우선한다 |

## Before editing

작업을 시작할 때 먼저 분류한다.

| 작업 유형 | 먼저 확인할 것 |
| --- | --- |
| 전략/시뮬레이션 | `docs/backtest-contract.md`, `src/snusmic_pipeline/sim/runner.py`, 계좌 원장 테스트 |
| 데이터 export | `src/snusmic_pipeline/web_artifacts.py`, `data/web/manifest.json`, artifact check |
| 웹 UI | `DESIGN.md`, `apps/web/lib/artifacts.ts`, 실제 artifact schema |
| 문서 정리 | `docs/product-spec.md`와 충돌하는 오래된 문구 |

## Strategy experiment checklist

새 전략을 만들 때는 코드보다 먼저 아래를 남긴다.

| 항목 | 필요한 답 |
| --- | --- |
| Hypothesis | 어떤 매매법이 왜 더 벌 것 같은가 |
| Lever | 매수, 매도, 비중, 현금 중 무엇을 바꾸는가 |
| Universe | SMIC pool을 어떻게 정의하는가 |
| Timing | 어떤 데이터로 신호를 만들고 언제 체결하는가 |
| Baseline | 올웨더와 어떤 단순 SMIC 전략을 같이 비교하는가 |
| Verification | 어떤 pytest, artifact check, web check로 검증하는가 |

## What not to optimize first

- 리포트 outcome label을 더 예쁘게 나누는 일
- 실패 전략을 숨겨서 화면을 깨끗하게 만드는 일
- 목표가 도달률만 높이는 규칙
- MDD 15% 같은 임계값을 절대 목표로 만드는 일
- factor zoo를 늘리면서 계좌 원장 검증을 생략하는 일
- generated artifact를 재생성하고 코드 변경처럼 섞어 커밋하는 일

## Preferred implementation shape

| 원칙 | 이유 |
| --- | --- |
| 계좌 원장 우선 | 이 제품은 실제 적립식 계좌 시나리오를 검증한다 |
| 단순 전략 우선 | 표본이 작으므로 복잡한 팩터 조합보다 명확한 손익절/추세 규칙이 해석 가능하다 |
| no-lookahead 우선 | 수익률이 좋아도 미래 정보가 섞이면 제품 목적을 망친다 |
| 빠른 기본 경로 우선 | 일일 운영은 `daily-forward`가 기본이고, `generate-strategies`는 연구/전략 재생성용 명시 경로다 |
| 계측 유지 | `strategy-generation-summary.json`과 `export-web` 출력의 `stage_seconds`를 먼저 보고 병목을 추측한다 |
| generated output 분리 | `data/sim`, `data/web`, `apps/web/public/downloads` 변경은 코드 변경과 따로 검토해야 한다 |
| 실패도 보존 | 실패한 실험은 다음 실험의 음성 증거다 |

## Verification levels

| 변경 | 최소 검증 |
| --- | --- |
| 문서만 | 링크와 파일명 sanity check |
| Python 전략 | 관련 pytest + ruff |
| artifact export | `artifact:check` + 대표 JSON diff 확인 |
| 웹 UI | typecheck + build + 브라우저 smoke |
| 전체 파이프라인 | refresh artifacts, pytest, artifact check, typecheck, build |

## Stop condition

작업 완료 보고는 아래를 포함한다.

- 무엇이 제품 목적과 연결되는지
- 어떤 파일이 바뀌었는지
- 어떤 검증을 통과했는지
- generated artifact를 건드렸는지
- 남은 리스크가 무엇인지
