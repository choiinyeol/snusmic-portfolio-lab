# Iteration 011 - Cost and Slippage Sensitivity

Date: 2026-05-25

Status: accepted as robustness evidence

## Idea

Iteration 009 found the current best PIT-only rule:

> `pit_trend_quarterly_fresh540_top5`

Iteration 010 showed that the edge does not improve by changing cadence or concentration.
This iteration tests whether the accepted rule is still real after execution friction.

The simulator already charges the default strategy with:

- commission: 1.5 bps
- sell tax: 18 bps
- slippage: 5 bps

So this iteration adds explicit per-account execution-cost variants:

1. zero-cost gross anchor
2. current default-fee baseline
3. 25 bps slippage stress
4. 50 bps slippage stress

This is not a new strategy search.
It is a robustness audit for the current best rule.

## Point-in-Time Contract

All variants preserve the same point-in-time inputs as the accepted baseline:

- Same-day PIT board score.
- Same-day PIT trend eligibility.
- Same-day rank within the PIT trend universe.
- Report publication date and report age as of the decision date.
- Same-day moving-average stack.
- Same-day distance from the 52-week high.
- Current holdings and first-buy dates.

The cost variants do not read future returns, target-hit outcomes, future MFE, expiry return, later report labels, future benchmark prices, or future report revisions.

## Buy Rule

Every tested account uses the same accepted admission rule:

- Rank by `board_score`.
- Enter from PIT trend-eligible names.
- Require report age <= 540 days.
- Require same-day 20MA > 50MA > 200MA trend stack.
- Require distance from 52-week high >= -20%.
- Hold Top 5 by equal weight.

Cost variants:

| account | commission | sell tax | slippage |
| --- | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_gross_top5` | 0 bps | 0 bps | 0 bps |
| `pit_trend_quarterly_fresh540_top5` | 1.5 bps | 18 bps | 5 bps |
| `pit_trend_quarterly_fresh540_slip25_top5` | 5 bps | 18 bps | 25 bps |
| `pit_trend_quarterly_fresh540_slip50_top5` | 5 bps | 18 bps | 50 bps |

## Sell/Rebalance Rule

All variants use the accepted quarterly persistence rule:

1. Rebalance quarterly.
2. Keep held names while they remain inside the Top 20 PIT trend rank band.
3. Keep at least 60 holding days before rank-band exits.
4. Sell names that no longer pass the admission filter at the next rebalance.
5. Do not sell because a target was hit.
6. Do not use future outcome labels.

## Result

Benchmark date: 2026-05-22.

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_gross_top5` | 67.88% | 664.63% | 37.88% | 29.73% | 1.06 | 1.52 | 573.7M KRW | 150 |
| `pit_trend_quarterly_fresh540_top5` | 66.76% | 629.94% | 37.19% | 29.74% | 1.04 | 1.50 | 558.5M KRW | 150 |
| `pit_trend_quarterly_fresh540_slip25_top5` | 65.03% | 580.99% | 36.13% | 29.78% | 1.02 | 1.47 | 535.8M KRW | 150 |
| `pit_trend_quarterly_fresh540_slip50_top5` | 63.15% | 527.24% | 34.99% | 29.57% | 1.00 | 1.44 | 511.9M KRW | 150 |
| `pit_trend_persist20_top5` | 63.84% | 563.78% | 35.41% | 27.56% | 1.02 | 1.50 | 520.6M KRW | 437 |
| `pit_trend_persist20_quarterly_top5` | 63.79% | 587.11% | 35.38% | 29.74% | 1.02 | 1.43 | 520.0M KRW | 150 |
| `pit_score_top5` | 54.46% | 431.31% | 29.76% | 35.80% | 0.87 | 1.34 | 413.9M KRW | 357 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.00 | 1.31 | 323.7M KRW | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.14 | 1.66 | 236.3M KRW | 186 |

Closed episode quality:

| account | closed episodes | win rate | profit factor | median holding days | average holding days |
| --- | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_gross_top5` | 60 | 53.33% | 3.60 | 92.0 | 124.7 |
| `pit_trend_quarterly_fresh540_top5` | 60 | 53.33% | 3.49 | 92.0 | 124.7 |
| `pit_trend_quarterly_fresh540_slip25_top5` | 59 | 50.85% | 3.43 | 92.0 | 128.4 |
| `pit_trend_quarterly_fresh540_slip50_top5` | 60 | 51.67% | 3.17 | 92.0 | 124.7 |
| `pit_trend_persist20_top5` | 145 | 44.14% | 2.47 | 32.0 | 58.5 |
| `pit_trend_persist20_quarterly_top5` | 58 | 53.45% | 3.67 | 92.0 | 132.1 |

Execution-cost totals:

| account | gross trade value | commission | tax |
| --- | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_gross_top5` | 2787.1M KRW | 0.00M KRW | 0.00M KRW |
| `pit_trend_quarterly_fresh540_top5` | 2733.2M KRW | 0.41M KRW | 2.37M KRW |
| `pit_trend_quarterly_fresh540_slip25_top5` | 2649.0M KRW | 1.32M KRW | 2.30M KRW |
| `pit_trend_quarterly_fresh540_slip50_top5` | 2558.8M KRW | 1.28M KRW | 2.22M KRW |

## Retrospective

The accepted rule survives execution-cost stress.

Default fees reduce MWR from the gross anchor's 67.88% to 66.76%, a 1.12 percentage-point drag.
Final equity drops by about 15.2M KRW versus zero cost, but the rule still keeps the same 150 trades and a 3.49 profit factor.

The 25 bps slippage stress remains strong:

- MWR 65.03%
- final equity 535.8M KRW
- profit factor 3.43
- still above KODEX200 and All-Weather by a wide margin

The 50 bps slippage stress is intentionally harsh.
It still beats KODEX200 and All-Weather:

- 63.15% MWR versus KODEX200 44.62%
- 511.9M KRW final equity versus KODEX200 323.7M KRW

However, the 50 bps stress slips slightly below the monthly persistence baseline's 63.84% MWR.
That does not replace the accepted rule, because the stress case is not the default account assumption and the quarterly rule uses only 150 trades versus 437 trades.

The key evidence is turnover.
The rule is not depending on rapid trading precision.
It holds winners long enough that even severe execution friction does not erase the excess return.

The current best remains:

> `pit_trend_quarterly_fresh540_top5`

The zero-cost account is not accepted as a real strategy.
It is only a gross-performance anchor.

## Next Mutation

Do not change concentration yet.
The cost test says the accepted Top5 quarterly shape is robust enough to keep exploring nearby structural questions.

The next loop should test whether the result is an artifact of the chosen quarter-start schedule:

1. Keep the same fresh540 Top5 Top20-persistence rule.
2. Compare quarterly rebalance offsets:
   - January/April/July/October
   - February/May/August/November
   - March/June/September/December
3. Keep transaction-cost defaults.
4. Accept only if an offset improves MWR without increasing MDD or trade count materially.
5. Reject the mutation if all offsets cluster near the current result, because that would strengthen confidence in the current rule rather than create a new strategy.
