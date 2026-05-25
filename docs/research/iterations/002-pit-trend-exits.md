# 002 PIT Trend Exit Rules

Date: 2026-05-25

## Idea

Iteration 001 found `pit_trend_top5`: a strong PIT-only account with high excess return but still-large drawdown. The next mutation tests whether drawdown can be reduced without sacrificing the return engine.

Three variants were added:

- `pit_trend_top7`: same trend admission rule, but seven names instead of five.
- `pit_trend_stop_top5`: same Top 5 trend rule, but sell a holding when it is below 50MA or down at least 12% from average cost.
- `pit_trend_stop_top7`: the same stop rule with seven names.

## Point-in-time contract

All entry and exit decisions are based only on data observable on the decision date:

- PIT research-board rank and score as of the rebalance date
- trailing moving averages as of the exit date
- current close versus the account's own moving-average cost basis

No future target hit, future return, future drawdown, or future report outcome is used.

## Buy rule

On each monthly rebalance date:

1. Build the PIT research board as of that date.
2. Keep rows with moving-average stack confirmation and distance from 52-week high >= -20%.
3. Rank by `board_score`.
4. Buy the top N at equal weight.

## Sell/rebalance rule

For stop variants:

1. Check held positions each trading day.
2. Sell the full position if the close is below 50MA.
3. Sell the full position if the close is at least 12% below average cost.
4. Exclude a just-exited symbol from same-day rebalance re-entry.

For all variants:

1. On monthly rebalance, sell names no longer selected.
2. Trim overweight positions.
3. Buy underweight selected positions.

## Result

| account_id | MWR | TWR | CAGR | MDD | Sharpe | Sortino | Final equity | Closed trades | Sell win rate | Profit factor |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_top5` | 56.59% | 429.34% | 31.03% | 27.58% | 0.89 | 1.30 | KRW 436.3M | 175 | 48.57% | 2.02 |
| `pit_trend_top7` | 44.57% | 233.19% | 23.93% | 27.74% | 0.78 | 1.14 | KRW 323.3M | 225 | 44.00% | 1.89 |
| `pit_trend_stop_top5` | 32.69% | 111.35% | 17.13% | 22.88% | 0.64 | 0.89 | KRW 238.7M | 201 | 36.82% | 1.22 |
| `pit_trend_stop_top7` | 23.93% | 43.70% | 12.29% | 20.37% | 0.54 | 0.73 | KRW 190.3M | 262 | 33.21% | 1.18 |
| `pit_score_top5` | 54.46% | 431.31% | 29.76% | 35.80% | 0.87 | 1.34 | KRW 413.9M | 48 | 50.00% | 3.49 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.00 | 1.31 | KRW 323.7M | - | - | - |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.14 | 1.66 | KRW 236.3M | - | - | - |

## Retrospective

This mutation should be rejected.

Top7 diversification did not reduce drawdown and diluted the return engine. `pit_trend_top7` landed near KODEX200 on return with higher drawdown and worse risk-adjusted metrics.

The stop variants lowered drawdown, but the cost was too high. Daily 50MA and 12% average-cost exits produced many extra closed trades, worse win rate, weaker profit factor, and too much cash drag. This confirms that the current edge is not just "avoid every dip"; it needs enough patience to let trend winners compound.

The important lesson: keep the monthly full-investment structure unless the next exit rule has a replacement rule that immediately rotates into another qualified PIT candidate.

## Next mutation

Test rotation instead of cash exits:

- keep `pit_trend_top5` as the base;
- when a holding fails the trend rule, replace it with the next eligible candidate instead of sitting in cash;
- compare Top5 monthly rotation versus Top5 twice-monthly rotation;
- avoid average-cost stop loss unless it rotates immediately into another PIT-qualified name.
