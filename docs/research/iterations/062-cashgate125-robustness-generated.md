# 062 CashGate 12.5 Robustness

## Summary

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5` | 77.22% | 1001.09% | 43.64% | 27.47% | 1.1956 | 1.8570 | 715.1M | 136 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5` | 78.27% | 1031.39% | 44.30% | 27.47% | 1.2061 | 1.8713 | 732.8M | 138 |
| `research062_cashgate125_slip25_top5` | 76.72% | 975.12% | 43.33% | 27.75% | 1.1882 | 1.8410 | 706.9M | 140 |
| `research062_cashgate125_slip50_top5` | 74.79% | 898.14% | 42.14% | 27.97% | 1.1664 | 1.8056 | 675.7M | 138 |
| `research062_cashgate125_midcontrib_top5` | 78.20% | 1039.55% | 43.83% | 28.44% | 1.1964 | 1.8743 | 720.0M | 137 |
| `research062_cashgate125_lastcontrib_top5` | 79.06% | 1061.30% | 43.95% | 27.32% | 1.1903 | 1.8758 | 723.4M | 140 |
| `research062_cashgate125_top3` | 65.60% | 626.20% | 36.48% | 29.10% | 0.9833 | 1.5219 | 543.2M | 101 |
| `research062_cashgate125_top7` | 62.11% | 611.75% | 34.36% | 27.33% | 1.0370 | 1.5751 | 499.2M | 179 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| `benchmark_qqq` | 28.15% | 219.27% | 14.61% | 18.56% | 0.6643 | 0.9455 | 212.3M | 65 |

## Daily Delta vs `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5`

| account | final delta | positive days | min daily delta | max daily delta |
| --- | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5` | -17.8M | 0.14% | -18.1M | 0.5M |
| `research062_cashgate125_slip25_top5` | -26.0M | 5.21% | -26.5M | 0.1M |
| `research062_cashgate125_slip50_top5` | -57.1M | 0.00% | -58.3M | -0.0M |
| `research062_cashgate125_midcontrib_top5` | -12.9M | 24.68% | -14.6M | 0.6M |
| `research062_cashgate125_lastcontrib_top5` | -9.4M | 2.35% | -11.6M | 0.6M |
| `research062_cashgate125_top3` | -189.7M | 4.78% | -211.2M | 0.7M |
| `research062_cashgate125_top7` | -233.6M | 0.29% | -233.6M | 0.1M |
| `all_weather` | -496.5M | 32.24% | -511.1M | 11.2M |
| `benchmark_kodex200` | -409.2M | 17.33% | -421.0M | 4.6M |
| `benchmark_qqq` | -520.5M | 48.22% | -537.6M | 12.8M |

## Trade Reasons

| account | rebalance_buy | rebalance_sell | trailing_profit_trim | retained_cap_trim |
| --- | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5` | 69 | 59 | 5 | 3 |
| `research062_cashgate125_slip25_top5` | 73 | 61 | 3 | 3 |
| `research062_cashgate125_slip50_top5` | 72 | 60 | 3 | 3 |
| `research062_cashgate125_midcontrib_top5` | 72 | 60 | 2 | 3 |
| `research062_cashgate125_lastcontrib_top5` | 73 | 61 | 3 | 3 |
| `research062_cashgate125_top3` | 49 | 41 | 1 | 10 |
| `research062_cashgate125_top7` | 93 | 78 | 5 | 3 |
| `all_weather` | 160 | 26 | 0 | 0 |
| `benchmark_kodex200` | 65 | 0 | 0 | 0 |
| `benchmark_qqq` | 65 | 0 | 0 | 0 |
