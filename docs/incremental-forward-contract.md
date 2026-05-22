# Incremental Forward Contract

Last updated: 2026-05-22
Status: implementation target

## Why this exists

과거 시뮬레이션 경로는 가격과 리포트가 확정된 뒤에는 바뀌지 않는다. 매일 새로 들어오는 것은 보통 마지막 거래일 이후의 가격 행과 새 리포트뿐이다. 따라서 장기적으로는 전체 백테스트를 매번 재생하지 않고, 마지막 checkpoint 이후의 거래일만 forward replay 해야 한다.

## Product rule

매일 장 마감 가격 기준으로 하나의 의사결정 행을 만든다.

```text
previous checkpoint -> today's prices/reports -> strategy step -> trades -> end-of-day account snapshot
```

이 행은 `data/sim/daily_decisions.csv`와 `data/web/portfolio/daily-decisions.json`에 남는다. `decision=hold`도 명시적으로 기록한다. 매매가 없던 날도 사용자는 “오늘은 보유”라는 결정을 받아야 하기 때문이다.

## Checkpoint state

진짜 incremental runner는 최소한 아래 상태를 저장해야 한다.

| 상태 | 이유 |
| --- | --- |
| `Account` | 현금, 보유수량, 평균단가, 실현손익, 거래원장 |
| persona state | `FollowerState`, `MttStrategyState`, RSI/PIT 상태처럼 전략별 cursor와 stop-out 기록 |
| `previous_day` | 현금 RP 수익과 보유기간 계산 |
| report cursor | 이미 흡수한 리포트를 다시 매수하지 않기 위해 필요 |
| equity tail | MDD, 수익률, 웹 차트 append에 필요 |
| source fingerprint | 과거 가격/리포트가 수정되었는지 감지하기 위해 필요 |

## Invalidation

아래 경우에는 forward replay가 아니라 full replay로 돌아간다.

| 조건 | 이유 |
| --- | --- |
| 과거 `daily_prices.csv` 행이 수정됨 | 과거 체결/손절/목표가 판정이 바뀔 수 있음 |
| 과거 리포트 row가 수정됨 | pool/candidate 시점 정보가 바뀜 |
| persona config나 fee/savings plan 변경 | 계좌 경로 전체가 달라짐 |
| benchmark price 과거 수정 | All Weather 비교 경로가 달라짐 |
| code version 변경 후 checkpoint schema 불일치 | 상태 복원 의미가 달라질 수 있음 |

## Current implementation

현재 기본 운영 경로는 `daily-forward`다. checkpoint가 없거나 과거 데이터/config/schema가 바뀌거나 요청 종료일이 checkpoint보다 과거이면 core persona만 full replay fallback으로 checkpoint를 재생성하고, 이후 append-only 가격/리포트 업데이트는 checkpoint 이후 거래일만 전진 처리한다.

| Artifact | 의미 |
| --- | --- |
| `data/sim/checkpoints/daily-forward-latest.json` | core persona별 `Account`, 전략 state, cursor, equity tail checkpoint |
| `data/sim/daily-forward-metadata.json` | `run_mode`, checkpoint 날짜, source fingerprint, fallback 사유 |
| `data/sim/daily_decisions.csv` | 날짜 × persona 기준 buy/sell/rebalance/hold와 장마감 계좌 상태 |
| `data/web/daily-decisions.json` | metadata + raw daily decision rows |
| `data/web/portfolio/daily-decisions.json` | metadata + compact portfolio route bundle |
| `stage_seconds` | export 중 어디가 느린지 비교하는 계측 |

## Operating commands

```bash
python -m snusmic_pipeline daily-forward --warehouse data/warehouse --out data/sim --start 2021-01-04 --end <latest-price-date>
python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
```

`scripts/refresh_web_artifacts.sh`는 위 daily path를 호출한다. 연구용 전략 재생성은 `scripts/full_rebuild_web_artifacts.sh`를 명시적으로 실행한다.

## Deferred timing ADR

Phase 1-4는 기존 full replay와 동일한 체결 타이밍을 보존한다. `close[t]`로 계산한 신호를 `close[t+1]`에 체결하도록 바꾸는 작업은 별도 ADR과 equivalence-breaking test plan으로 다룬다.
