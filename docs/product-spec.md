# Product Spec

SNUSMIC Portfolio Lab은 point-in-time SMIC 리포트 데이터를 **검증 케이스 중심 연구 검증 시스템**으로 재정의하려는 제품입니다. 생성된 branch나 전략 후보를 바로 product truth로 노출하는 대신, 리포트 주장 검증 → 반복 규칙 승격 → 포트폴리오 증명 순서로 evidence를 누적합니다.

### 현재 제품 목표

- SMIC 리포트 metadata, PDF, markdown, structured extraction 결과를 수집합니다.
- publication date, price window, target-hit evidence, drawdown, failure-tail을 포함하는 **VerificationCase**를 만듭니다.
- 여러 검증 케이스에서 반복적으로 살아남는 selection rule을 **AlphaHypothesis**로 승격합니다.
- alpha를 하나 이상의 **PortfolioStrategy**로 연결해 all weather 또는 index 대비 우위를 증명합니다.
- 사용자가 첫 화면에서 검증 케이스를 보고, 그다음 알파와 포트폴리오 proof를 따라가도록 제품 surface를 설계합니다.
- portfolio proof는 과거 daily 기준의 매수/매도 이유·수량·가격·손익 trace를 포함해야 합니다.

### 웹 제품 표면

- `/`: VerificationCase board. 어떤 리포트 주장이 좋은/나쁜 증거였는지 먼저 봅니다.
- `/alpha`: AlphaHypothesis board. 어떤 반복 규칙이 승격/탈락했는지 먼저 봅니다.
- `/reports`: source report / evidence drilldown.
- `/reports/[symbol]/[reportId]`: report evidence detail.
- `/calendar`: 특정 관측일에 어떤 검증 케이스 후보가 있었는지 보는 PIT calendar.
- `/statistics`: 검증 케이스 분포와 실패 꼬리 진단.
- `/portfolio`: promoted strategy proof catalogue.
- `/portfolio/[account]`: 특정 `PortfolioStrategy` proof overview.
- `/portfolio/[account]/holdings`: proof를 구성하는 현재 포지션.
- `/portfolio/[account]/trades`: historical execution trace.

### 비목표

- live broker integration 또는 order entry를 제공하지 않습니다.
- PIT rule에 future-looking signal을 쓰지 않습니다.
- 생성된 모든 research branch를 자동으로 product에 올리지 않습니다.
- account ledger나 체결 로그를 core object로 취급하지 않습니다.
- 실계좌 연동 없이도 설명 가능한 historical execution trace를 제공하는 것이 현재 목표이며, broker execution 자체는 다음 단계 문제입니다.

### 목표

제품 목표는 2층입니다.

1. **검증 엔진 성공**: VerificationCase가 downside-aware quality로 평가되고, drawdown / failure-tail hard veto를 포함해 “좋은 증거”와 “버려야 할 증거”를 구분한다.
2. **제품 완성**: 최소 한 전략 family가 all weather 또는 index를 일관되게 이기는 `PortfolioStrategy` proof를 만든다.

이때 alpha는 단일 종목 추천이 아니라 반복 규칙이어야 하며, 승격 조건에는 최소 support, quality 분포 안정성, 기간/시장 구간 분산이 함께 필요합니다.

### 현재 선별 전략 proof

| account_id | 표시 이름 | 역할 |
| --- | --- | --- |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5` | Partial 75 | 현재 local-return candidate proof |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5` | CashGate 12.5 | robustness baseline proof |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5` | TrailTrim 20 | simpler baseline proof |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5` | Candidate Profit60 | candidate-ordering comparison proof |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5` | Profit60 | board-score / weekly-cap / profit-cushion baseline proof |
| `pit_trend_top5`, `pit_score_top5`, `smic_follower` | Trend / Score / Follower baselines | 비교 기준 proof |
| momentum / MTT variants | representative 전략군 | 비교용 proof set |

### 향후 rule 작업

새 rule을 구현하기 전에는 다음을 명시해야 합니다.

- 어떤 VerificationCase 집합이 근거가 되는가
- 어떤 drawdown / failure-tail 조건이 hard veto인가
- 어떤 반복 규칙이 AlphaHypothesis로 승격되는가
- 최소 support와 품질 안정성을 어떤 단위로 셀 것인가
- PortfolioStrategy의 allocation / rebalance / risk rule은 무엇인가
- 어떤 benchmark와 어떤 성공 기준으로 proof할 것인가
- historical execution trace에서 무엇을 보여줄 것인가
