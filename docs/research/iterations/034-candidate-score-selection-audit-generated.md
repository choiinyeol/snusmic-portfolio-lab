# Selection Audit: `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5`

## Score Formula

`candidate_score = 1.4 * target_upside_at_publication + max(current_return, 0) - max(target_gap_to_target * 0.25, 0)`

All fields are measured on the rebalance date from committed warehouse prices and reports. No future return, future target hit, or future price path is used.

## Summary

- Rebalance cadence: `quarterly`
- Score field: `candidate_score`
- Top-N: `5`
- Rebalance dates audited: 21
- Distinct selected symbols: 56
- Mean overlap with board-score Top5: 92.06%

## Most Frequent Top-N Selections

| symbol | company | selected rebalances |
| --- | --- | ---: |
| `ANET` | Arista Networks | 5 |
| `PLTR` | Palantir Technologies Inc. | 4 |
| `SBLK` | Star Bulk Carriers | 3 |
| `006260.KS` | LS | 3 |
| `007660.KS` | 이수페타시스 | 3 |
| `267260.KS` | HD현대일렉트릭 | 3 |
| `1211.HK` | BYD | 3 |
| `218410.KQ` | RFHIC | 3 |
| `166090.KQ` | 하나머티리얼즈 | 2 |
| `005850.KS` | 에스엘 | 2 |
| `194480.KQ` | 데브시스터즈 | 2 |
| `WFG` | West Fraser Timber. Co. Ltd | 2 |

## Recent 8 Rebalance Boards

| date | rank | board rank | symbol | company | score | upside part | winner part | over-target penalty | target upside | current return | target gap | age | 52w gap | MA stack | action note |
| --- | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 2024-07-01 | 1 | 2 | `1211.HK` | BYD | 4.44 | 4.40 | 0.03 | 0.00 | 314.62% | 3.34% | -75.08% | 222 | -8.58% | Y | trades=8 buy=4 sell=4 reasons=rebalance_buy\|rebalance_sell |
| 2024-07-01 | 2 | 1 | `267260.KS` | HD현대일렉트릭 | 4.26 | 1.36 | 3.18 | 0.28 | 97.32% | 317.61% | 111.63% | 256 | -7.05% | Y | trades=8 buy=4 sell=4 reasons=rebalance_buy\|rebalance_sell |
| 2024-07-01 | 3 | 4 | `089890.KQ` | 코세스 | 2.37 | 1.43 | 0.94 | 0.00 | 101.95% | 94.14% | -3.87% | 256 | -12.14% | Y | trades=8 buy=4 sell=4 reasons=rebalance_buy\|rebalance_sell |
| 2024-07-01 | 4 | 5 | `PLTR` | Palantir Technologies Inc. | 1.57 | 1.32 | 0.24 | 0.00 | 94.62% | 24.32% | -36.12% | 38 | 0.00% | Y | trades=8 buy=4 sell=4 reasons=rebalance_buy\|rebalance_sell |
| 2024-07-01 | 5 | 7 | `194480.KQ` | 데브시스터즈 | 1.24 | 1.02 | 0.22 | 0.00 | 72.64% | 22.05% | -29.30% | 53 | -18.10% | Y | trades=8 buy=4 sell=4 reasons=rebalance_buy\|rebalance_sell |
| 2024-10-01 | 1 | 1 | `1211.HK` | BYD | 4.60 | 4.40 | 0.20 | 0.00 | 314.62% | 19.88% | -71.09% | 314 | 0.00% | Y | trades=6 buy=3 sell=3 reasons=rebalance_buy\|rebalance_sell |
| 2024-10-01 | 2 | 3 | `PLTR` | Palantir Technologies Inc. | 1.99 | 1.32 | 0.67 | 0.00 | 94.62% | 66.90% | -14.24% | 130 | -5.09% | Y | trades=6 buy=3 sell=3 reasons=rebalance_buy\|rebalance_sell |
| 2024-10-01 | 3 | 4 | `VRT` | Vertiv Holdings Co. | 1.72 | 0.59 | 1.28 | 0.15 | 42.39% | 127.80% | 59.98% | 314 | -11.57% | Y | trades=6 buy=3 sell=3 reasons=rebalance_buy\|rebalance_sell |
| 2024-10-01 | 4 | 5 | `001530.KS` | DI동일 | 1.62 | 0.88 | 0.76 | 0.02 | 62.88% | 76.13% | 8.13% | 480 | -5.06% | Y | trades=6 buy=3 sell=3 reasons=rebalance_buy\|rebalance_sell |
| 2024-10-01 | 5 | 2 | `196170.KQ` | 알테오젠 | 1.43 | 0.60 | 0.92 | 0.09 | 42.55% | 92.47% | 35.01% | 145 | -9.92% | Y | trades=6 buy=3 sell=3 reasons=rebalance_buy\|rebalance_sell |
| 2025-01-02 | 1 | 1 | `267260.KS` | HD현대일렉트릭 | 5.62 | 1.36 | 4.73 | 0.48 | 97.32% | 473.24% | 190.51% | 441 | 0.00% | Y | trades=8 buy=4 sell=4 reasons=rebalance_buy\|rebalance_sell |
| 2025-01-02 | 2 | 2 | `PLTR` | Palantir Technologies Inc. | 3.94 | 1.32 | 2.86 | 0.25 | 94.62% | 285.59% | 98.12% | 223 | -7.46% | Y | trades=8 buy=4 sell=4 reasons=rebalance_buy\|rebalance_sell |
| 2025-01-02 | 3 | 3 | `006060.KS` | 화승인더 | 1.59 | 1.31 | 0.28 | 0.00 | 93.36% | 28.43% | -33.58% | 393 | -3.16% | Y | trades=8 buy=4 sell=4 reasons=rebalance_buy\|rebalance_sell |
| 2025-01-02 | 4 | 5 | `042660.KS` | 한화오션 | 1.32 | 1.02 | 0.30 | 0.00 | 72.76% | 30.34% | -24.55% | 260 | -3.57% | Y | trades=8 buy=4 sell=4 reasons=rebalance_buy\|rebalance_sell |
| 2025-01-02 | 5 | 7 | `018290.KS` | 브이티 | 1.20 | 0.96 | 0.23 | 0.00 | 68.79% | 23.33% | -26.93% | 56 | -6.00% | Y | trades=8 buy=4 sell=4 reasons=rebalance_buy\|rebalance_sell |
| 2025-04-01 | 1 | 1 | `1211.HK` | BYD | 5.24 | 4.40 | 0.83 | 0.00 | 314.62% | 83.14% | -55.83% | 496 | -8.17% | Y | trades=9 buy=4 sell=5 reasons=rebalance_buy\|rebalance_sell |
| 2025-04-01 | 2 | 2 | `211050.KQ` | 인카금융서비스 | 1.12 | 0.78 | 0.34 | 0.00 | 55.47% | 34.17% | -13.70% | 166 | -1.13% | Y | trades=9 buy=4 sell=5 reasons=rebalance_buy\|rebalance_sell |
| 2025-04-01 | 3 | 4 | `278470.KS` | 에이피알 | 0.66 | 0.55 | 0.10 | 0.00 | 39.39% | 10.47% | -20.75% | 327 | -12.17% | Y | trades=9 buy=4 sell=5 reasons=rebalance_buy\|rebalance_sell |
| 2025-04-01 | 4 | 3 | `271560.KS` | 오리온 | 0.63 | 0.36 | 0.28 | 0.00 | 25.76% | 27.81% | 1.64% | 298 | -3.12% | Y | trades=9 buy=4 sell=5 reasons=rebalance_buy\|rebalance_sell |
| 2025-07-01 | 1 | 1 | `472850.KQ` | 폰드그룹 | 3.97 | 3.49 | 0.48 | 0.00 | 249.01% | 48.23% | -57.53% | 21 | 0.00% | Y | trades=5 buy=3 sell=2 reasons=rebalance_buy\|rebalance_sell |
| 2025-07-01 | 2 | 2 | `119850.KQ` | 지엔씨에너지 | 2.35 | 1.48 | 0.86 | 0.00 | 105.77% | 86.49% | -9.37% | 73 | -0.28% | Y | trades=5 buy=3 sell=2 reasons=rebalance_buy\|rebalance_sell |
| 2025-07-01 | 3 | 3 | `211050.KQ` | 인카금융서비스 | 2.32 | 0.78 | 1.74 | 0.19 | 55.47% | 173.51% | 75.93% | 257 | -3.00% | Y | trades=5 buy=3 sell=2 reasons=rebalance_buy\|rebalance_sell |
| 2025-07-01 | 4 | 5 | `032350.KS` | 롯데관광개발 | 2.10 | 1.34 | 0.76 | 0.00 | 95.52% | 76.20% | -9.89% | 418 | -2.37% | Y | trades=5 buy=3 sell=2 reasons=rebalance_buy\|rebalance_sell |
| 2025-07-01 | 5 | 6 | `218410.KQ` | RFHIC | 1.88 | 0.68 | 1.35 | 0.15 | 48.32% | 135.29% | 58.64% | 208 | 0.00% | Y | trades=5 buy=3 sell=2 reasons=rebalance_buy\|rebalance_sell |
| 2025-10-01 | 1 | 1 | `PLTR` | Palantir Technologies Inc. | 8.45 | 1.32 | 8.03 | 0.91 | 94.62% | 803.16% | 364.06% | 495 | -0.13% | Y | trades=6 buy=3 sell=3 reasons=rebalance_buy\|rebalance_sell |
| 2025-10-01 | 2 | 3 | `475960.KQ` | 토모큐브 | 4.40 | 2.90 | 1.50 | 0.00 | 207.38% | 150.00% | -18.67% | 143 | 0.00% | Y | trades=6 buy=3 sell=3 reasons=rebalance_buy\|rebalance_sell |
| 2025-10-01 | 3 | 2 | `356860.KQ` | 티엘비 | 4.15 | 1.23 | 3.24 | 0.31 | 87.73% | 323.83% | 125.77% | 328 | 0.00% | Y | trades=6 buy=3 sell=3 reasons=rebalance_buy\|rebalance_sell |
| 2025-10-01 | 4 | 5 | `TEM` | Tempus AI Inc | 3.87 | 3.50 | 0.37 | 0.00 | 250.25% | 37.00% | -60.88% | 129 | -4.05% | Y | trades=6 buy=3 sell=3 reasons=rebalance_buy\|rebalance_sell |
| 2025-10-01 | 5 | 4 | `278470.KS` | 에이피알 | 3.15 | 0.55 | 3.08 | 0.48 | 39.39% | 307.81% | 192.56% | 510 | 0.00% | Y | trades=6 buy=3 sell=3 reasons=rebalance_buy\|rebalance_sell |
| 2026-01-02 | 1 | 1 | `218410.KQ` | RFHIC | 2.38 | 0.68 | 1.95 | 0.25 | 48.32% | 194.54% | 98.58% | 393 | -4.63% | Y | trades=9 buy=5 sell=4 reasons=rebalance_buy\|rebalance_sell |
| 2026-01-02 | 2 | 3 | `122640.KQ` | 예스티 | 1.79 | 1.76 | 0.03 | 0.00 | 125.38% | 3.23% | -54.20% | 18 | -12.09% | Y | trades=9 buy=5 sell=4 reasons=rebalance_buy\|rebalance_sell |
| 2026-01-02 | 3 | 4 | `012330.KS` | 현대모비스 | 1.35 | 0.83 | 0.52 | 0.00 | 59.22% | 52.16% | -4.43% | 421 | -2.25% | Y | trades=9 buy=5 sell=4 reasons=rebalance_buy\|rebalance_sell |
| 2026-01-02 | 4 | 5 | `GLW` | Corning | 1.01 | 0.95 | 0.07 | 0.00 | 67.75% | 6.60% | -36.45% | 71 | -7.16% | Y | trades=9 buy=5 sell=4 reasons=rebalance_buy\|rebalance_sell |
| 2026-01-02 | 5 | 2 | `LITE` | Lumentum Holdings Inc | 0.82 | 0.69 | 0.13 | 0.00 | 48.98% | 13.07% | -24.10% | 18 | -4.79% | Y | trades=9 buy=5 sell=4 reasons=rebalance_buy\|rebalance_sell |
| 2026-04-01 | 1 | 1 | `218410.KQ` | RFHIC | 6.51 | 0.68 | 6.92 | 1.08 | 48.32% | 691.60% | 433.71% | 482 | 0.00% | Y | trades=4 buy=2 sell=2 reasons=rebalance_buy\|rebalance_sell |
| 2026-04-01 | 2 | 2 | `356860.KQ` | 티엘비 | 4.99 | 1.23 | 4.21 | 0.44 | 87.73% | 420.58% | 177.31% | 510 | -9.65% | Y | trades=4 buy=2 sell=2 reasons=rebalance_buy\|rebalance_sell |
| 2026-04-01 | 3 | 3 | `475960.KQ` | 토모큐브 | 4.65 | 2.90 | 1.75 | 0.00 | 207.38% | 174.76% | -10.61% | 325 | -12.97% | Y | trades=4 buy=2 sell=2 reasons=rebalance_buy\|rebalance_sell |
| 2026-04-01 | 4 | 5 | `950160.KQ` | 코오롱티슈진 | 3.44 | 2.16 | 1.28 | 0.00 | 154.20% | 127.94% | -10.33% | 141 | -14.57% | Y | trades=4 buy=2 sell=2 reasons=rebalance_buy\|rebalance_sell |
| 2026-04-01 | 5 | 4 | `LITE` | Lumentum Holdings Inc | 1.88 | 0.69 | 1.33 | 0.14 | 48.98% | 133.18% | 56.52% | 107 | -3.50% | Y | trades=4 buy=2 sell=2 reasons=rebalance_buy\|rebalance_sell |
