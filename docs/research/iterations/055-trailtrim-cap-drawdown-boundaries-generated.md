# 055 TrailTrim Cap and Drawdown Boundaries

## Summary

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5` | 77.22% | 1001.09% | 43.64% | 27.47% | 1.1956 | 1.8570 | 715.1M | 136 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5` | 77.10% | 996.50% | 43.57% | 27.47% | 1.1925 | 1.8528 | 713.2M | 136 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap30_top5` | 76.74% | 984.83% | 43.35% | 27.47% | 1.1865 | 1.8432 | 707.2M | 135 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim20cap25_top5` | 76.01% | 967.68% | 42.89% | 27.47% | 1.1861 | 1.8358 | 695.2M | 145 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim30cap25_top5` | 76.69% | 983.23% | 43.31% | 27.47% | 1.1864 | 1.8439 | 706.3M | 136 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5` | 76.66% | 982.30% | 43.30% | 27.47% | 1.1847 | 1.8393 | 705.8M | 131 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

## Daily Delta vs `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5`

| account | final delta | positive days | min daily delta | max daily delta |
| --- | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5` | 1.9M | 50.14% | -0.5M | 2.0M |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap30_top5` | -5.9M | 1.50% | -6.1M | 0.5M |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim20cap25_top5` | -18.0M | 26.82% | -18.4M | 0.4M |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim30cap25_top5` | -6.9M | 1.50% | -7.0M | 0.5M |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5` | -7.4M | 1.64% | -7.6M | 0.5M |
| `benchmark_kodex200` | -389.5M | 17.33% | -400.9M | 4.6M |
| `all_weather` | -476.9M | 32.67% | -491.0M | 11.2M |

## Trade Reasons

| account | rebalance_buy | rebalance_sell | retained_cap_trim | trailing_profit_trim |
| --- | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5` | 69 | 59 | 3 | 5 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5` | 69 | 59 | 3 | 5 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap30_top5` | 69 | 59 | 3 | 4 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim20cap25_top5` | 69 | 59 | 3 | 14 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim30cap25_top5` | 69 | 59 | 3 | 5 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5` | 69 | 59 | 3 | 0 |
| `benchmark_kodex200` | 65 | 0 | 0 | 0 |
| `all_weather` | 160 | 26 | 0 | 0 |
