# 063 Partial Redeploy Current Artifact Check

## Summary

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5` | 77.22% | 1001.09% | 43.64% | 27.47% | 1.1956 | 1.8570 | 715.1M | 136 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5` | 78.27% | 1031.39% | 44.30% | 27.47% | 1.2061 | 1.8713 | 732.8M | 138 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5` | 78.43% | 1035.90% | 44.40% | 27.47% | 1.2091 | 1.8760 | 735.5M | 140 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| `benchmark_qqq` | 28.15% | 219.27% | 14.61% | 18.56% | 0.6643 | 0.9455 | 212.3M | 65 |

## Daily Delta vs `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5`

| account | final delta | positive days | min daily delta | max daily delta |
| --- | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5` | -17.8M | 0.14% | -18.1M | 0.5M |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5` | 2.7M | 22.75% | -0.8M | 2.7M |
| `all_weather` | -496.5M | 32.24% | -511.1M | 11.2M |
| `benchmark_kodex200` | -409.2M | 17.33% | -421.0M | 4.6M |
| `benchmark_qqq` | -520.5M | 48.22% | -537.6M | 12.8M |

## Trade Reasons

| account | rebalance_buy | rebalance_sell | retained_cap_trim | trailing_profit_trim |
| --- | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5` | 69 | 59 | 3 | 5 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5` | 72 | 60 | 3 | 3 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5` | 73 | 61 | 3 | 3 |
| `all_weather` | 160 | 26 | 0 | 0 |
| `benchmark_kodex200` | 65 | 0 | 0 | 0 |
| `benchmark_qqq` | 65 | 0 | 0 | 0 |
