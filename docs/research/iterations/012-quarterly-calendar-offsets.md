# Iteration 012 - Quarterly Calendar Offsets

Date: 2026-05-25

Status: rejected as replacement; accepted as defensive evidence

## Idea

Iteration 011 showed that the current best rule survives execution friction.
This iteration asks whether the result depends too much on the chosen quarterly rebalance calendar.

The accepted strategy rebalances on the first trading day of:

- January
- April
- July
- October

This iteration keeps the same rule but shifts the quarterly rebalance cycle:

1. January cycle: January, April, July, October
2. February cycle: February, May, August, November
3. March cycle: March, June, September, December

The goal is not to optimize the calendar after seeing the result.
The goal is to detect whether the accepted strategy is an accident of one rebalance month.

## Point-in-Time Contract

All variants preserve the same PIT-only inputs:

- Same-day PIT board score.
- Same-day PIT trend eligibility.
- Same-day rank within the PIT trend universe.
- Report publication date and report age as of the decision date.
- Same-day moving-average stack.
- Same-day distance from the 52-week high.
- Current holdings and first-buy dates.

The variants do not use future returns, target-hit outcomes, future MFE, expiry return, later report labels, future benchmark prices, or future report revisions.

The only changed input is the deterministic rebalance month schedule.

## Buy Rule

All variants use the accepted admission rule:

- Rank by `board_score`.
- Enter from PIT trend-eligible names.
- Require report age <= 540 days.
- Require same-day 20MA > 50MA > 200MA trend stack.
- Require distance from 52-week high >= -20%.
- Hold Top 5 by equal weight.

Cycle variants:

| account | rebalance months |
| --- | --- |
| `pit_trend_quarterly_fresh540_top5` | Jan / Apr / Jul / Oct |
| `pit_trend_quarterly_fresh540_feb_top5` | Feb / May / Aug / Nov |
| `pit_trend_quarterly_fresh540_mar_top5` | Mar / Jun / Sep / Dec |

## Sell/Rebalance Rule

All variants use the same persistence discipline:

1. Rebalance on the configured quarterly cycle.
2. Keep held names while they remain inside the Top 20 PIT trend rank band.
3. Keep at least 60 holding days before rank-band exits.
4. Sell names that no longer pass the admission filter at the next rebalance.
5. Do not sell because a target was hit.
6. Do not use future outcome labels.

## Result

Benchmark date: 2026-05-22.

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 66.76% | 629.94% | 37.19% | 29.74% | 1.04 | 1.50 | 558.5M KRW | 150 |
| `pit_trend_quarterly_fresh540_feb_top5` | 49.70% | 232.31% | 26.94% | 23.50% | 0.85 | 1.21 | 367.8M KRW | 159 |
| `pit_trend_quarterly_fresh540_mar_top5` | 62.94% | 584.17% | 34.86% | 21.41% | 1.04 | 1.50 | 509.4M KRW | 157 |
| `pit_trend_persist20_top5` | 63.84% | 563.78% | 35.41% | 27.56% | 1.02 | 1.50 | 520.6M KRW | 437 |
| `pit_trend_persist20_quarterly_top5` | 63.79% | 587.11% | 35.38% | 29.74% | 1.02 | 1.43 | 520.0M KRW | 150 |
| `pit_trend_quarterly_fresh540_slip50_top5` | 63.15% | 527.24% | 34.99% | 29.57% | 1.00 | 1.44 | 511.9M KRW | 150 |
| `pit_score_top5` | 54.46% | 431.31% | 29.76% | 35.80% | 0.87 | 1.34 | 413.9M KRW | 357 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.00 | 1.31 | 323.7M KRW | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.14 | 1.66 | 236.3M KRW | 186 |

Closed episode quality:

| account | closed episodes | win rate | profit factor | median holding days | average holding days |
| --- | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 60 | 53.33% | 3.49 | 92.0 | 124.7 |
| `pit_trend_quarterly_fresh540_feb_top5` | 62 | 48.39% | 3.82 | 92.0 | 128.0 |
| `pit_trend_quarterly_fresh540_mar_top5` | 62 | 48.39% | 4.60 | 91.0 | 134.1 |
| `pit_trend_persist20_top5` | 145 | 44.14% | 2.47 | 32.0 | 58.5 |
| `pit_trend_persist20_quarterly_top5` | 58 | 53.45% | 3.67 | 92.0 | 132.1 |
| `pit_trend_quarterly_fresh540_slip50_top5` | 60 | 51.67% | 3.17 | 92.0 | 124.7 |

First and last fills:

| account | first fill | last fill | buys | sells |
| --- | --- | --- | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 2021-01-04 | 2026-04-01 | 71 | 79 |
| `pit_trend_quarterly_fresh540_feb_top5` | 2021-02-01 | 2026-05-01 | 86 | 73 |
| `pit_trend_quarterly_fresh540_mar_top5` | 2021-03-01 | 2026-03-02 | 77 | 80 |

## Retrospective

The January cycle remains the best primary strategy by MWR and final equity.
The February cycle is clearly worse.
It misses too much of the early positioning window, trades slightly more, and loses almost 17 percentage points of MWR versus the accepted rule.

The March cycle is more interesting.
It does not beat the January cycle by MWR:

- 62.94% versus 66.76%
- 509.4M KRW versus 558.5M KRW final equity

But it cuts MDD sharply:

- 21.41% versus 29.74%

It also keeps a high profit factor:

- 4.60 versus 3.49

So the March cycle is not a replacement for the current best strategy.
It is a defensive variant worth keeping in the catalog because it preserves most of the return while lowering drawdown materially.

This iteration changes the interpretation of the edge:

> The January quarterly cycle is not a random no-edge artifact, because the March offset still beats KODEX200, All-Weather, and the original PIT Score Top5. But the exact rebalance month matters enough that calendar timing should be treated as a real strategy knob.

The current best remains:

> `pit_trend_quarterly_fresh540_top5`

The best defensive variant found so far is:

> `pit_trend_quarterly_fresh540_mar_top5`

## Next Mutation

The March cycle suggests that drawdown can be reduced without adding moving-average exits.
The next loop should test a small set of deterministic drawdown-aware variants that do not use future data:

1. Keep the January cycle as the return leader.
2. Keep the March cycle as the defensive baseline.
3. Test a cash sleeve on the January cycle:
   - 80% invested / 20% cash
   - 90% invested / 10% cash
4. Test a simple volatility cap using only trailing price history:
   - keep Top5 selection
   - scale the whole book down when selected basket trailing volatility is above a fixed threshold
5. Reject any variant that lowers MWR below the March cycle without improving MDD.
