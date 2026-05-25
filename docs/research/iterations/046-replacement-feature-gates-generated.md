# 046 Replacement Feature Gates

## Summary

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_ret3m20_top5` | 65.69% | 607.59% | 36.54% | 28.56% | 0.9738 | 1.5114 | 544.4M | 135 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_high10_top5` | 64.36% | 859.33% | 35.73% | 23.83% | 1.0428 | 1.5800 | 527.2M | 123 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5` | 76.66% | 982.30% | 43.30% | 27.47% | 1.1847 | 1.8393 | 705.8M | 131 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_delay1_top5` | 51.73% | 529.53% | 28.14% | 17.87% | 1.0056 | 1.5289 | 386.9M | 89 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_confirm10_top5` | 55.24% | 559.95% | 30.23% | 33.55% | 0.9148 | 1.1495 | 422.0M | 50 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

## Daily Delta vs `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5`

| account | final delta | positive days | min daily delta | max daily delta |
| --- | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_ret3m20_top5` | -161.4M | 21.54% | -164.2M | 2.9M |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_high10_top5` | -178.6M | 70.54% | -178.6M | 61.6M |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_delay1_top5` | -318.9M | 44.08% | -324.7M | 17.1M |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_confirm10_top5` | -283.8M | 71.75% | -283.8M | 79.9M |
| `benchmark_kodex200` | -382.1M | 17.33% | -393.3M | 4.6M |
| `all_weather` | -469.5M | 33.02% | -483.5M | 11.2M |

## Trade Reasons

| account | rebalance_buy | rebalance_sell | retained_cap_trim |
| --- | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_ret3m20_top5` | 69 | 62 | 4 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_high10_top5` | 64 | 55 | 4 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5` | 69 | 59 | 3 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_delay1_top5` | 47 | 39 | 3 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_confirm10_top5` | 26 | 20 | 4 |
| `benchmark_kodex200` | 65 | 0 | 0 |
| `all_weather` | 160 | 26 | 0 |
