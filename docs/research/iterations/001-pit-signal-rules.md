# 001 PIT Signal Rule Portfolios

Date: 2026-05-25

## Idea

The original `pit_score_topN` result suggests that the PIT board already contains useful signal. The next question is whether the score can be improved by admitting only names with observable trend confirmation on the decision date.

Three variants were added:

- `pit_momentum_top5`: rank by `ta_momentum_score`, require positive 3M and 6M return, above 200MA, and within 25% of the 52-week high.
- `pit_trend_top5`: rank by `board_score`, require moving-average stack, and within 20% of the 52-week high.
- `pit_fresh_top5`: rank by `board_score`, require report age <= 365 days, positive 3M return, and above 200MA.

## Point-in-time contract

The strategies use only `PitResearchBoardRow` fields built as of each rebalance date:

- report age
- PIT board score fields
- 3M/6M/YTD/1Y trailing returns
- distance from 52-week high
- moving average state
- MACD state when explicitly enabled

No post-rebalance return, future target hit, future expiry, or future report outcome is used for selection.

## Buy rule

On the first trading day of each month:

1. Build the PIT research board as of that day.
2. Filter rows using the strategy's admission rules.
3. Sort by the configured score field.
4. Buy the top 5 names at equal weight.

## Sell/rebalance rule

On the first trading day of each month:

1. Sell names no longer in the selected top 5.
2. Trim overweight positions.
3. Buy underweight selected positions.
4. Hold cash only when fewer than 5 eligible names exist.

## Result

| account_id | MWR | TWR | CAGR | MDD | Sharpe | Sortino | Final equity | Sell win rate | Profit factor |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_top5` | 56.59% | 429.34% | 31.03% | 27.58% | 0.89 | 1.30 | KRW 436.3M | 48.57% | 2.02 |
| `pit_score_top5` | 54.46% | 431.31% | 29.76% | 35.80% | 0.87 | 1.34 | KRW 413.9M | 50.00% | 3.49 |
| `pit_momentum_top5` | 44.99% | 348.74% | 24.17% | 32.27% | 0.76 | 1.12 | KRW 326.7M | 63.14% | 2.11 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.00 | 1.31 | KRW 323.7M | - | - |
| `pit_fresh_top5` | 38.69% | 267.86% | 20.53% | 25.08% | 0.69 | 1.02 | KRW 278.4M | 62.61% | 2.80 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.14 | 1.66 | KRW 236.3M | - | - |

## Retrospective

`pit_trend_top5` is the only first-pass mutation that improves on both KODEX200 and the original PIT Top5 by money-weighted return. The moving-average stack filter appears to remove some weak candidates without over-constraining the opportunity set.

The weakness is drawdown. `pit_trend_top5` lowers MDD versus `pit_score_top5` by 8.22 percentage points, but still draws down 27.58%. This is not yet a clean risk-adjusted winner versus All Weather or KODEX200.

`pit_momentum_top5` roughly matches KODEX200 return but takes more drawdown, so pure compressed momentum score is not enough. `pit_fresh_top5` reduces stale report exposure but gives up too much return.

## Next mutation

Test a drawdown-aware trend strategy:

- keep the `pit_trend_top5` admission rule;
- add a sell rule for holdings that close below 50MA or lose more than 12% from average cost;
- compare Top 5 vs Top 7 to reduce concentration risk;
- keep the same PIT-only constraint.
