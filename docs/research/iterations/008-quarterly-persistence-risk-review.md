# Iteration 008 - Quarterly Persistence Risk Review

Date: 2026-05-25

Status: rejected

## Idea

Iteration 007 found a practical challenger:

> `pit_trend_persist20_quarterly_top5`

It nearly matched monthly persistence by MWR while cutting trades from 437 to 150.
The weakness was slightly higher drawdown and lower Sortino.

This iteration asks whether the quarterly variant can keep its low turnover while reducing drawdown:

1. Use a wider Top 30 keep band.
2. Keep quarterly rebalance but sell holdings that fall below their same-day 50-day moving average.
3. Combine Top 30 keep band with the 50MA risk review.
4. Require at least 120 holding days before rank-band exits.

## Point-in-time Contract

The strategy may use only information observable on the decision date:

- Same-day PIT board score.
- Same-day PIT trend eligibility.
- Same-day rank within the PIT trend universe.
- Current holdings and first-buy dates.
- Same-day stock close.
- Same-day stock 50-day moving average ending on the decision date.

It must not use future returns, target-hit outcomes, future MFE, expiry return, later report labels, or later benchmark prices.

## Buy Rule

All variants preserve the quarterly Top 5 PIT trend persistence structure:

- Rank by `board_score`.
- Enter from current PIT trend-eligible names.
- Rebalance only quarterly.
- Target Top 5 equal weight.

Mutations:

| account | mutation |
| --- | --- |
| `pit_trend_persist30_quarterly_top5` | keep held names while they remain inside the Top 30 band |
| `pit_trend_persist20_quarterly_risk_top5` | sell held names when they fall below their same-day 50MA; vacancies wait until the next quarterly rebalance |
| `pit_trend_persist30_quarterly_risk_top5` | Top 30 keep band plus same-day 50MA risk review |
| `pit_trend_persist20_quarterly_hold120_top5` | require 120 holding days before rank-band exits |

## Sell/Rebalance Rule

Quarterly variants sell and rebalance only on quarterly anchors unless a risk-review exit is enabled.

Risk-review variants check every trading day:

1. If a held stock closes below its own same-day 50MA, sell it.
2. Do not immediately replace it.
3. Fill vacancies only at the next quarterly rebalance.

No target-hit exit, no future result label, no future benchmark gate.

## Result

Benchmark date: 2026-05-22.

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_persist20_top5` | 63.84% | 563.78% | 35.41% | 27.56% | 1.02 | 1.50 | 520.6M KRW | 437 |
| `pit_trend_persist20_quarterly_top5` | 63.79% | 587.11% | 35.38% | 29.74% | 1.02 | 1.43 | 520.0M KRW | 150 |
| `pit_trend_persist30_quarterly_top5` | 63.79% | 587.11% | 35.38% | 29.74% | 1.02 | 1.43 | 520.0M KRW | 150 |
| `pit_trend_persist20_quarterly_risk_top5` | 36.68% | 208.41% | 19.39% | 18.11% | 0.75 | 0.93 | 264.5M KRW | 170 |
| `pit_trend_persist30_quarterly_risk_top5` | 36.68% | 208.41% | 19.39% | 18.11% | 0.75 | 0.93 | 264.5M KRW | 170 |
| `pit_trend_persist20_quarterly_hold120_top5` | 63.79% | 587.11% | 35.38% | 29.74% | 1.02 | 1.43 | 520.0M KRW | 150 |
| `pit_trend_top5` | 56.59% | 429.34% | 31.03% | 27.58% | 0.89 | 1.30 | 436.3M KRW | 462 |
| `pit_score_top5` | 54.46% | 431.31% | 29.76% | 35.80% | 0.87 | 1.34 | 413.9M KRW | 357 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.00 | 1.31 | 323.7M KRW | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.14 | 1.66 | 236.3M KRW | 186 |

Closed episode quality:

| account | closed episodes | win rate | profit factor | median holding days | average holding days |
| --- | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_persist20_top5` | 145 | 44.14% | 2.47 | 32.0 | 58.5 |
| `pit_trend_persist20_quarterly_top5` | 58 | 53.45% | 3.67 | 92.0 | 132.1 |
| `pit_trend_persist30_quarterly_top5` | 58 | 53.45% | 3.67 | 92.0 | 132.1 |
| `pit_trend_persist20_quarterly_risk_top5` | 79 | 34.18% | 1.85 | 35.0 | 44.8 |
| `pit_trend_persist30_quarterly_risk_top5` | 79 | 34.18% | 1.85 | 35.0 | 44.8 |
| `pit_trend_persist20_quarterly_hold120_top5` | 58 | 53.45% | 3.67 | 92.0 | 132.1 |
| `pit_trend_top5` | 175 | 48.57% | 2.02 | 31.0 | 47.8 |
| `pit_score_top5` | 48 | 50.00% | 3.49 | 91.0 | 161.3 |

## Retrospective

The attempt failed.

Top 30 and 120-day holding variants are identical to the original quarterly rule over this sample.
That is useful evidence: the quarterly cadence already delays most rank exits enough that these knobs do not bind.
They add no explanatory power.

The 50MA risk review is too blunt.
It lowers MDD from 29.74% to 18.11%, but it also cuts MWR from 63.79% to 36.68% and final equity from 520.0M KRW to 264.5M KRW.
The win rate falls to 34.18%.
This confirms the earlier trend-following lesson: this strategy needs to tolerate intermediate trend breaks to hold the large winners.

The current practical rule remains:

> `pit_trend_persist20_quarterly_top5`

The current best by pure MWR remains:

> `pit_trend_persist20_top5`

## Next Mutation

Stop trying to improve quarterly persistence with mechanical exits.
The next loop should test the admission side instead:

1. Quarterly Top5 selected by PIT score, but require 3M return > 0 and 6M return > 0 separately instead of full MA-stack.
2. Quarterly Top5 with fresher reports only: max report age 365 days.
3. Quarterly Top5 with stale reports only excluded after 540 days.
4. Compare whether report freshness improves forward edge without killing the long-run winners.
