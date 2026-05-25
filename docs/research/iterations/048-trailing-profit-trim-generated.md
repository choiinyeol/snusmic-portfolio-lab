# 048 Trailing Profit Trim

## Summary

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25_top5` | 76.74% | 984.83% | 43.35% | 27.47% | 1.1865 | 1.8432 | 707.2M | 135 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim35_top5` | 76.63% | 981.65% | 43.28% | 27.47% | 1.1845 | 1.8388 | 705.4M | 132 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trail35_top5` | 75.30% | 941.30% | 42.45% | 27.47% | 1.1701 | 1.8162 | 683.7M | 129 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5` | 76.66% | 982.30% | 43.30% | 27.47% | 1.1847 | 1.8393 | 705.8M | 131 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

## Daily Delta vs `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5`

| account | final delta | positive days | min daily delta | max daily delta |
| --- | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25_top5` | 1.4M | 49.64% | -0.6M | 1.5M |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim35_top5` | -0.4M | 0.00% | -0.4M | 0.0M |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trail35_top5` | -22.1M | 0.14% | -22.5M | 0.5M |
| `benchmark_kodex200` | -382.1M | 17.33% | -393.3M | 4.6M |
| `all_weather` | -469.5M | 33.02% | -483.5M | 11.2M |

## Trade Reasons

| account | rebalance_buy | rebalance_sell | retained_cap_trim | trailing_profit_stop | trailing_profit_trim |
| --- | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25_top5` | 69 | 59 | 3 | 0 | 4 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim35_top5` | 69 | 59 | 3 | 0 | 1 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trail35_top5` | 68 | 56 | 3 | 2 | 0 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5` | 69 | 59 | 3 | 0 | 0 |
| `benchmark_kodex200` | 65 | 0 | 0 | 0 | 0 |
| `all_weather` | 160 | 26 | 0 | 0 | 0 |
