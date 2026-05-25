# Rebalance State Audit

## Scope

This report reconstructs account state immediately before selected rebalance dates and compares holdings, same-day PIT ranks, target weights, and actual generated trades. Rank and target-weight fields use only data visible on the audit date; generated trade ledgers are used only to explain what the already-simulated account did.

## Parameters

- Accounts: `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5`, `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5`
- Dates: 2024-07-01, 2024-10-01
- Rank rows shown per account/date: candidate Top10 + board Top10 + held/traded/target symbols

## 2024-07-01

| account | equity before | cash before | open positions before | target symbols | buy/sell symbols |
| --- | ---: | ---: | ---: | --- | --- |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5` | 91,672,181 | 3,012,451 | 5 | 1211.HK, 267260.KS, 089890.KQ, PLTR, 000660.KS | buy:1211.HK, buy:267260.KS, buy:089890.KQ, buy:PLTR, sell:005290.KS, sell:068270.KS, sell:100840.KQ, sell:ANET |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5` | 91,672,181 | 3,012,451 | 5 | 267260.KS, 1211.HK, 196170.KQ, 089890.KQ, 000660.KS | buy:267260.KS, buy:1211.HK, buy:196170.KQ, buy:089890.KQ, sell:005290.KS, sell:068270.KS, sell:100840.KQ, sell:ANET |

### `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5`

| symbol | company | cand rank | board rank | held before | held weight | target weight | trade | gross | current return | target gap |
| --- | --- | ---: | ---: | --- | ---: | ---: | --- | ---: | ---: | ---: |
| `1211.HK` | BYD | 1 | 2 | - | - | 20.00% | buy 1353 | 18,593,014 | 3.34% | -75.08% |
| `267260.KS` | HD현대일렉트릭 | 2 | 1 | - | - | 20.00% | buy 62 | 18,392,192 | 317.61% | 111.63% |
| `089890.KQ` | 코세스 | 3 | 4 | - | - | 20.00% | buy 1039 | 18,586,609 | 94.14% | -3.87% |
| `196170.KQ` | 알테오젠 | 7 | 3 | - | - | - | - | - | 63.33% | 14.57% |
| `PLTR` | Palantir Technologies Inc. | 4 | 5 | - | - | 20.00% | buy 447 | 15,975,675 | 24.32% | -36.12% |
| `194480.KQ` | 데브시스터즈 | 5 | 7 | - | - | - | - | - | 22.05% | -29.30% |
| `000660.KS` | SK하이닉스 | 6 | 6 | Y | 23.38% | 20.00% | - | - | 87.35% | 43.07% |
| `LLY` | Eli Lilly & Co. | 8 | 8 | - | - | - | - | - | 63.75% | 30.76% |
| `192820.KS` | 코스맥스 | 11 | 9 | - | - | - | - | - | 56.28% | 33.17% |
| `214450.KQ` | 파마리서치 | 9 | 10 | - | - | - | - | - | 64.46% | 33.51% |
| `BESI.AS` | BE Semiconductor Industries N.V. | 10 | 13 | - | - | - | - | - | 36.10% | 6.34% |
| `005290.KS` | 005290.KS | - | - | Y | 14.16% | - | sell 323 | 12,978,108 | - | - |
| `068270.KS` | 068270.KS | - | - | Y | 17.10% | - | sell 93 | 15,671,007 | - | - |
| `100840.KQ` | 100840.KQ | - | - | Y | 14.68% | - | sell 1162 | 13,449,232 | - | - |
| `ANET` | ANET | - | - | Y | 27.39% | - | sell 204 | 25,097,268 | - | - |

### `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5`

| symbol | company | cand rank | board rank | held before | held weight | target weight | trade | gross | current return | target gap |
| --- | --- | ---: | ---: | --- | ---: | ---: | --- | ---: | ---: | ---: |
| `267260.KS` | HD현대일렉트릭 | 1 | 1 | - | - | 20.00% | buy 54 | 16,019,006 | 317.61% | 111.63% |
| `1211.HK` | BYD | 2 | 2 | - | - | 20.00% | buy 1353 | 18,593,014 | 3.34% | -75.08% |
| `196170.KQ` | 알테오젠 | 3 | 3 | - | - | 20.00% | buy 66 | 18,324,158 | 63.33% | 14.57% |
| `089890.KQ` | 코세스 | 4 | 4 | - | - | 20.00% | buy 1039 | 18,586,609 | 94.14% | -3.87% |
| `PLTR` | Palantir Technologies Inc. | 5 | 5 | - | - | - | - | - | 24.32% | -36.12% |
| `000660.KS` | SK하이닉스 | 6 | 6 | Y | 23.38% | 20.00% | - | - | 87.35% | 43.07% |
| `194480.KQ` | 데브시스터즈 | 7 | 7 | - | - | - | - | - | 22.05% | -29.30% |
| `LLY` | Eli Lilly & Co. | 8 | 8 | - | - | - | - | - | 63.75% | 30.76% |
| `192820.KS` | 코스맥스 | 9 | 9 | - | - | - | - | - | 56.28% | 33.17% |
| `214450.KQ` | 파마리서치 | 10 | 10 | - | - | - | - | - | 64.46% | 33.51% |
| `005290.KS` | 005290.KS | - | - | Y | 14.16% | - | sell 323 | 12,978,108 | - | - |
| `068270.KS` | 068270.KS | - | - | Y | 17.10% | - | sell 93 | 15,671,007 | - | - |
| `100840.KQ` | 100840.KQ | - | - | Y | 14.68% | - | sell 1162 | 13,449,232 | - | - |
| `ANET` | ANET | - | - | Y | 27.39% | - | sell 204 | 25,097,268 | - | - |

## 2024-10-01

| account | equity before | cash before | open positions before | target symbols | buy/sell symbols |
| --- | ---: | ---: | ---: | --- | --- |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5` | 93,012,324 | 3,028,603 | 5 | 1211.HK, 196170.KQ, PLTR, VRT, 001530.KS | buy:196170.KQ, buy:VRT, buy:001530.KS, sell:000660.KS, sell:089890.KQ, sell:267260.KS |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5` | 87,553,803 | 3,053,465 | 5 | 1211.HK, 196170.KQ, PLTR, VRT, 001530.KS | buy:PLTR, buy:VRT, buy:001530.KS, sell:000660.KS, sell:089890.KQ, sell:267260.KS |

### `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5`

| symbol | company | cand rank | board rank | held before | held weight | target weight | trade | gross | current return | target gap |
| --- | --- | ---: | ---: | --- | ---: | ---: | --- | ---: | ---: | ---: |
| `1211.HK` | BYD | 1 | 1 | Y | 23.18% | 20.00% | - | - | 19.88% | -71.09% |
| `196170.KQ` | 알테오젠 | 5 | 2 | - | - | 20.00% | buy 57 | 18,648,320 | 92.47% | 35.01% |
| `PLTR` | Palantir Technologies Inc. | 2 | 3 | Y | 23.05% | 20.00% | - | - | 66.90% | -14.24% |
| `VRT` | Vertiv Holdings Co. | 3 | 4 | - | - | 20.00% | buy 103 | 13,232,072 | 127.80% | 59.98% |
| `001530.KS` | DI동일 | 4 | 5 | - | - | 20.00% | buy 563 | 18,699,412 | 76.13% | 8.13% |
| `214450.KQ` | 파마리서치 | 6 | 6 | - | - | - | - | - | 112.69% | 72.67% |
| `000660.KS` | 000660.KS | - | - | Y | 17.08% | - | sell 91 | 15,880,656 | - | - |
| `089890.KQ` | 089890.KQ | - | - | Y | 10.62% | - | sell 1039 | 9,875,950 | - | - |
| `267260.KS` | 267260.KS | - | - | Y | 21.96% | - | sell 62 | 20,418,786 | - | - |

### `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5`

| symbol | company | cand rank | board rank | held before | held weight | target weight | trade | gross | current return | target gap |
| --- | --- | ---: | ---: | --- | ---: | ---: | --- | ---: | ---: | ---: |
| `1211.HK` | BYD | 1 | 1 | Y | 24.62% | 20.00% | - | - | 19.88% | -71.09% |
| `196170.KQ` | 알테오젠 | 2 | 2 | Y | 24.65% | 20.00% | - | - | 92.47% | 35.01% |
| `PLTR` | Palantir Technologies Inc. | 3 | 3 | - | - | 20.00% | buy 379 | 18,184,764 | 66.90% | -14.24% |
| `VRT` | Vertiv Holdings Co. | 4 | 4 | - | - | 20.00% | buy 90 | 11,562,004 | 127.80% | 59.98% |
| `001530.KS` | DI동일 | 5 | 5 | - | - | 20.00% | buy 548 | 18,201,204 | 76.13% | 8.13% |
| `214450.KQ` | 파마리서치 | 6 | 6 | - | - | - | - | - | 112.69% | 72.67% |
| `000660.KS` | 000660.KS | - | - | Y | 18.15% | - | sell 91 | 15,880,656 | - | - |
| `089890.KQ` | 089890.KQ | - | - | Y | 11.29% | - | sell 1039 | 9,875,950 | - | - |
| `267260.KS` | 267260.KS | - | - | Y | 20.32% | - | sell 54 | 17,784,104 | - | - |
