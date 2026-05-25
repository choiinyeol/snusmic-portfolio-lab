# 013 Exposure and Volatility Controls

Date: 2026-05-25
Status: accepted as risk-adjusted variant; rejected as current-best replacement

## Idea

Iteration 012 showed that the March quarterly rebalance cycle cut drawdown meaningfully, but it also gave up return versus the January cycle.

This iteration keeps the accepted January quarterly Fresh540 Top5 rule and tests whether exposure controls can capture a lower-drawdown profile without changing the stock selection rule:

- fixed cash sleeve: invest 90% or 80% gross exposure
- trailing volatility cap: scale the whole basket when trailing basket volatility exceeds 35% or 45% annualized

## Point-in-time contract

Only information available on the decision date is used.

- Candidate ranking still comes from the PIT research board on the rebalance date.
- The 540-day report freshness boundary is measured at the decision date.
- The volatility cap uses trailing daily returns ending on the decision date.
- No future returns, target-hit outcomes, or post-rebalance prices are used for selection or sizing.

## Buy rule

Use the accepted `pit_trend_quarterly_fresh540_top5` admission rule:

- quarterly rebalance
- top 5 PIT trend candidates
- keep existing holdings while they remain inside the top 20 persistence band
- ignore reports older than 540 days at the decision date
- equal weight before exposure scaling

## Sell/rebalance rule

Same rebalance and persistence logic as the accepted strategy.

The only mutation is exposure scaling:

| account | exposure control |
| --- | --- |
| `pit_trend_quarterly_fresh540_cash90_top5` | multiply target weights by 0.90 |
| `pit_trend_quarterly_fresh540_cash80_top5` | multiply target weights by 0.80 |
| `pit_trend_quarterly_fresh540_vol35_top5` | multiply target weights by `min(1, 35% / trailing basket volatility)` |
| `pit_trend_quarterly_fresh540_vol45_top5` | multiply target weights by `min(1, 45% / trailing basket volatility)` |

The trailing basket volatility uses the configured 180-trading-day lookback and the selected basket weights known on the rebalance date.

## Result

Simulation command:

```bash
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
```

Summary:

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 66.76% | 629.94% | 37.19% | 29.74% | 1.0445 | 1.4963 | 558.5M | 150 |
| `pit_trend_quarterly_fresh540_mar_top5` | 62.94% | 584.17% | 34.86% | 21.41% | 1.0359 | 1.4981 | 509.4M | 157 |
| `pit_trend_quarterly_fresh540_cash90_top5` | 60.99% | 538.81% | 33.68% | 27.32% | 1.0381 | 1.4824 | 485.8M | 150 |
| `pit_trend_quarterly_fresh540_cash80_top5` | 54.87% | 443.89% | 30.00% | 25.03% | 1.0283 | 1.4643 | 418.1M | 150 |
| `pit_trend_quarterly_fresh540_vol35_top5` | 64.16% | 530.28% | 35.61% | 25.97% | 1.0937 | 1.6355 | 524.7M | 150 |
| `pit_trend_quarterly_fresh540_vol45_top5` | 65.82% | 567.12% | 36.62% | 25.86% | 1.0799 | 1.6021 | 546.1M | 150 |
| `pit_score_top5` | 54.46% | 431.31% | 29.76% | 35.80% | 0.8722 | 1.3412 | 413.9M | 357 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

Closed episodes:

| account | closed episodes | win rate | profit factor | median hold | average hold |
| --- | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 60 | 53.3% | 3.49 | 92 | 124.7 |
| `pit_trend_quarterly_fresh540_mar_top5` | 62 | 48.4% | 4.60 | 91 | 134.1 |
| `pit_trend_quarterly_fresh540_cash90_top5` | 60 | 53.3% | 3.49 | 92 | 124.7 |
| `pit_trend_quarterly_fresh540_cash80_top5` | 60 | 53.3% | 3.48 | 92 | 124.7 |
| `pit_trend_quarterly_fresh540_vol35_top5` | 60 | 53.3% | 3.51 | 92 | 124.7 |
| `pit_trend_quarterly_fresh540_vol45_top5` | 60 | 53.3% | 3.49 | 92 | 124.7 |

Average gross exposure:

| account | average | min | max |
| --- | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 92.2% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_mar_top5` | 94.1% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_cash90_top5` | 83.1% | 0.0% | 92.9% |
| `pit_trend_quarterly_fresh540_cash80_top5` | 74.3% | 0.0% | 86.1% |
| `pit_trend_quarterly_fresh540_vol35_top5` | 87.7% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_vol45_top5` | 90.5% | 0.0% | 100.0% |

## Retrospective

The fixed cash sleeve is too blunt. It lowers drawdown, but it gives up too much MWR and final equity. The 80% sleeve almost reverts toward the original PIT-score Top5 return profile without solving enough of the product question.

The volatility cap is a better direction. `pit_trend_quarterly_fresh540_vol45_top5` keeps most of the accepted strategy's return:

- MWR falls only from 66.76% to 65.82%.
- MDD improves from 29.74% to 25.86%.
- Sharpe improves from 1.0445 to 1.0799.
- Sortino improves from 1.4963 to 1.6021.
- Final equity remains high at 546.1M.

The 35% volatility target has the best Sharpe and Sortino, but it gives up more MWR and final equity than needed. The 45% target is the better product compromise.

The current absolute-return winner remains `pit_trend_quarterly_fresh540_top5`.
The new risk-adjusted challenger is `pit_trend_quarterly_fresh540_vol45_top5`.

## Next mutation

Refine the volatility target before adding new filters:

- test target volatility thresholds around 40%, 45%, 50%, and 55%
- test whether the March quarterly cycle plus a 45% volatility cap produces a better low-drawdown variant
- keep selection unchanged so that the next iteration isolates sizing/risk control from signal quality
