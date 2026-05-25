# 050 TrailTrim25Cap25 Robustness

## Summary

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5` | 77.10% | 996.50% | 43.57% | 27.47% | 1.1925 | 1.8528 | 713.2M | 136 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_slip25_top5` | 75.62% | 943.67% | 42.65% | 27.75% | 1.1756 | 1.8249 | 689.0M | 134 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_slip50_top5` | 73.83% | 872.13% | 41.54% | 27.97% | 1.1554 | 1.7921 | 660.6M | 136 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_midcontrib_top5` | 77.12% | 1006.92% | 43.16% | 28.44% | 1.1833 | 1.8593 | 702.2M | 135 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_lastcontrib_top5` | 77.73% | 1020.59% | 43.14% | 27.32% | 1.1755 | 1.8584 | 701.6M | 134 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top3` | 64.50% | 604.72% | 35.81% | 29.10% | 0.9718 | 1.5049 | 529.0M | 100 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top7` | 61.29% | 595.10% | 33.86% | 27.33% | 1.0241 | 1.5542 | 489.4M | 169 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5` | 76.66% | 982.30% | 43.30% | 27.47% | 1.1847 | 1.8393 | 705.8M | 131 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

## Daily Delta vs `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5`

| account | final delta | positive days | min daily delta | max daily delta |
| --- | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_slip25_top5` | -24.2M | 5.21% | -24.7M | 0.1M |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_slip50_top5` | -52.6M | 0.00% | -53.7M | -0.0M |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_midcontrib_top5` | -11.0M | 24.89% | -12.8M | 0.6M |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_lastcontrib_top5` | -11.6M | 2.43% | -13.9M | 0.6M |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top3` | -184.2M | 4.78% | -205.2M | 0.7M |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top7` | -223.8M | 0.29% | -223.8M | 0.1M |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5` | -7.4M | 1.64% | -7.6M | 0.5M |
| `benchmark_kodex200` | -389.5M | 17.33% | -400.9M | 4.6M |
| `all_weather` | -476.9M | 32.67% | -491.0M | 11.2M |

## Trade Reasons

| account | rebalance_buy | rebalance_sell | retained_cap_trim | trailing_profit_trim |
| --- | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5` | 69 | 59 | 3 | 5 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_slip25_top5` | 68 | 58 | 3 | 5 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_slip50_top5` | 69 | 59 | 3 | 5 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_midcontrib_top5` | 69 | 59 | 3 | 4 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_lastcontrib_top5` | 68 | 58 | 3 | 5 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top3` | 47 | 40 | 10 | 3 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top7` | 87 | 75 | 3 | 4 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5` | 69 | 59 | 3 | 0 |
| `benchmark_kodex200` | 65 | 0 | 0 | 0 |
| `all_weather` | 160 | 26 | 0 | 0 |
