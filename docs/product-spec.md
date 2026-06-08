# Product Spec

SNUSMIC Portfolio Lab은 point-in-time SMIC 리포트 데이터와 정적 계좌/리포트 artifact를 만듭니다. 현재 릴리스에는 완료된 PIT 전략 리서치 스프린트가 포함되어 있지만, 생성된 branch는 먼저 연구 기록입니다. product UI에는 선별 shortlist만 portfolio ledger로 노출합니다.

### 현재 제품

- SMIC 리포트 metadata, PDF, target, rating, caveat 추출 결과를 수집합니다.
- publication date, price window, target-hit evidence, report-level outcome factor를 포함하는 PIT warehouse로 정규화합니다.
- 웹 앱이 실제 account ledger를 비교할 수 있도록 benchmark, follower, curated PIT account path를 export합니다.
- promotion된 idea를 사람이 검토할 수 있도록 PIT research board와 strategy-research note를 export합니다.
- sorting, filtering, drilldown이 가능한 report verification board를 제공합니다.
- target-hit rate, peak return concentration, fine return bucket, outcome bucket, representative price path를 설명하는 report statistics를 제공합니다.
- selected account, benchmark curve, holdings, trades, realized/unrealized PnL, win rate, payoff ratio, cash/RP를 하나의 ledger로 보여주는 portfolio 화면을 제공합니다.

### 웹 제품 표면

- `/`: 데이터 상태, 대표 계좌, 리포트/계좌/통계/캘린더 진입점을 정리하는 운영 허브.
- `/reports`: sorting, filtering, 개별 report drilldown용 report table.
- `/reports/[symbol]/[reportId]`: report evidence detail.
- `/calendar`: 각 historical observation date에 어떤 report candidate가 보였고 이후 어떻게 audit됐는지 보는 research calendar.
- `/statistics`: outcome statistics와 price-path diagnostics.
- `/portfolio`: curated account catalogue와 account drilldown.

### 비목표

- live broker integration 또는 order entry를 제공하지 않습니다.
- PIT rule에 future-looking signal을 쓰지 않습니다.
- 생성된 모든 research account를 자동으로 product에 올리지 않습니다.
- UI account route는 선언된 account rule과 account taxonomy를 설명합니다.

### 목표

계좌 목표는 단순합니다. 정적 artifact 안에서 final equity, money-weighted return, maximum drawdown, trade quality를 선언된 benchmark account와 비교합니다. Report-level factor view는 사람의 연구를 돕는 diagnostic input이며, 그 자체가 deployable rule은 아닙니다. Product screen은 raw artifact row를 계층 없이 노출하기보다 사용자가 다음에 무엇을 검토해야 하는지 안내해야 합니다.

### 현재 선별 계좌

| account_id | 표시 이름 | 역할 |
| --- | --- | --- |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5` | Partial 75 | 현재 local-return candidate. trailing trim + 12.5% cash gate + 75% redeploy를 쓰는 실험 후보입니다. |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5` | CashGate 12.5 | Partial 75 직전의 robustness baseline입니다. |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5` | TrailTrim 20 | cash redeploy 이전의 단순 trailing-trim baseline입니다. |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5` | Candidate Profit60 | candidate-score entry ordering 비교 계좌입니다. |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5` | Profit60 | board-score / weekly-cap / profit-cushion baseline입니다. |
| `pit_trend_top5` | Trend Top5 | 단순 PIT trend-score baseline입니다. |
| `pit_score_top5` | Score Top5 | 단순 PIT score baseline입니다. |
| `smic_follower` | SMIC Follower | report-follower baseline입니다. |
| `pit_momentum_1m3m_top5`, `pit_momentum_3m6m_top5`, `pit_momentum_6m12m_top5`, `pit_mtt_rs70_top5`, `pit_mtt_rs80_top5`, `pit_mtt_rs90_top5`, `pit_mtt_low100_top5`, `pit_mtt_low300_top5` | Momentum/MTT variants | 현재 product에서 비교용으로 노출하는 momentum/MTT representative 계좌군입니다. 기본 생성 대상은 선별 shortlist로 제한하고, 대량 실험 후보는 연구 기록에만 남겨 웹 데이터 속도 비용을 만들지 않습니다. |

### 향후 rule 작업

새 rule을 구현하기 전에는 다음을 명시해야 합니다.

- 매수 가능 universe.
- 매수 trigger.
- 매도 trigger.
- stop-loss, take-profit, expiry 처리.
- position sizing과 cash policy.
- rebalance cadence.
- fee와 slippage.
- benchmark와 objective.
