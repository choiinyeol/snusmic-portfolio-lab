# 018 Let Winners Run Construction

Date: 2026-05-25
Status: accepted

## Idea

Iterations 015-017 rejected more signal admission microtuning. The edge did not improve by waiting longer, narrowing the entry-age window, or changing the rank-persistence band.

This iteration changes portfolio construction instead.

The Fresh540 Top5 signal shell already finds strong candidates. The problem may be that full equal-weight rebalancing trims winners every quarter. A trend-following portfolio should sell invalid or rank-decayed holdings, but it should not mechanically reduce a winning position only because it grew larger than 20% of equity.

Hypothesis:

- keep the same Fresh540 Top5 PIT signal shell
- keep rank-exit discipline
- do not sell down retained winners to equal weight at rebalance
- use new cash and sale proceeds to buy underweight current candidates

## Point-in-time contract

Only decision-date information is used.

- PIT rank, report age, moving-average stack, and 52-week-high distance are measured on the rebalance date.
- Existing holdings are kept only if they remain inside the Top20 rank band or are inside the 60-day minimum holding period.
- Holdings outside the selected set are sold on the rebalance date.
- Retained holdings are not sold merely because they exceed the target equal weight.
- New buys use only the selected basket and current rebalance-date prices.
- Volatility targeting uses trailing realized daily returns available before or on the rebalance date.
- Future returns, target outcomes, target-hit status, and later drawdowns are not used.

## Buy rule

Control shell:

- quarterly rebalance
- top 5 PIT trend candidates
- max report age 540 days for the ranked universe
- 20/50/200MA stack required
- within 20% of the 52-week high
- keep holdings while they remain inside the Top20 persistence band
- 60-day minimum holding period

Mutation:

| account | construction rule |
| --- | --- |
| `pit_trend_quarterly_fresh540_runwinners_top5` | sell only unselected holdings; buy underweight selected names with available cash; do not trim overweight winners |
| `pit_trend_quarterly_fresh540_runwinners_vol50_top5` | same construction plus the 50% trailing-volatility cap |

## Sell/rebalance rule

Sell rules:

- sell holdings absent from the selected rebalance basket
- sell explicit stop/technical exits if configured by the strategy shell
- do not sell a retained holding solely to restore equal weight

Buy rules:

- compute target values from selected weights and current equity
- buy selected symbols only when current value is below target value
- use available cash, including new contributions and sale proceeds

This isolates one behavior: suppressing sell-downs of winners that still pass the PIT rank/validity shell.

## Result

Simulation command:

```bash
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
```

Runtime:

- `run-sim`: 33.68 seconds
- `export-web`: 19.50 seconds

Summary:

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 66.76% | 629.94% | 37.19% | 29.74% | 1.0445 | 1.4963 | 558.5M | 150 |
| `pit_trend_quarterly_fresh540_vol50_top5` | 66.45% | 586.21% | 37.00% | 25.95% | 1.0744 | 1.5830 | 554.4M | 150 |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 73.81% | 794.29% | 41.53% | 29.74% | 1.1082 | 1.6008 | 660.2M | 128 |
| `pit_trend_quarterly_fresh540_runwinners_vol50_top5` | 73.44% | 740.57% | 41.30% | 26.82% | 1.1382 | 1.6899 | 654.6M | 128 |
| `pit_score_top5` | 54.46% | 431.31% | 29.76% | 35.80% | 0.8722 | 1.3412 | 413.9M | 357 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

Closed episodes:

| account | closed episodes | win rate | profit factor | median hold | average hold |
| --- | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 60 | 53.3% | 3.49 | 92 | 124.7 |
| `pit_trend_quarterly_fresh540_vol50_top5` | 60 | 53.3% | 3.48 | 92 | 124.7 |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 59 | 54.2% | 4.92 | 92 | 123.7 |
| `pit_trend_quarterly_fresh540_runwinners_vol50_top5` | 59 | 54.2% | 4.92 | 92 | 123.7 |

Average gross exposure:

| account | average | min | max |
| --- | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 92.2% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_vol50_top5` | 91.2% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 92.1% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_runwinners_vol50_top5` | 91.2% | 0.0% | 100.0% |

Trade reasons:

| account | buy count | sell count |
| --- | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 71 | 79 |
| `pit_trend_quarterly_fresh540_vol50_top5` | 71 | 79 |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 69 | 59 |
| `pit_trend_quarterly_fresh540_runwinners_vol50_top5` | 69 | 59 |

## Retrospective

Accept the construction change.

This is the first mutation after Fresh540 that improves the absolute strategy by a large margin without adding a new information source. `runwinners_top5` raises MWR from 66.76% to 73.81%, final equity from 558.5M to 660.2M, CAGR from 37.19% to 41.53%, Sharpe from 1.0445 to 1.1082, and Sortino from 1.4963 to 1.6008. MDD does not worsen.

The mechanism also matches the intended trend-following philosophy. The strategy is not better because it predicts more. It is better because it stops automatically selling the winners that are still valid by the PIT rank shell.

The Vol50 version remains useful as the implementation-grade risk-adjusted variant. It keeps MWR at 73.44% while cutting MDD from 29.74% to 26.82% and lifting Sharpe/Sortino to 1.1382/1.6899.

This is the clearest lesson since Fresh540:

- candidate admission should stay simple
- quarterly patience matters
- Top20 persistence matters
- winner sell-downs are expensive

Current best by absolute MWR becomes `pit_trend_quarterly_fresh540_runwinners_top5`.
Current best risk-adjusted implementation candidate becomes `pit_trend_quarterly_fresh540_runwinners_vol50_top5`.

## Next mutation

Do not return to age-window or rank-band microtuning.

The next loop should stress the accepted construction:

- run-winners Top3 versus Top5 versus Top7
- run-winners with quarterly calendar offsets
- run-winners with slippage/fee stress

The most important question is whether the edge is robust, not whether another signal filter can squeeze out a small gain.
