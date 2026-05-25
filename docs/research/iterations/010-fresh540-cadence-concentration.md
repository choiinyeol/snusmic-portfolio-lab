# Iteration 010 - Fresh 540 Cadence and Concentration

Date: 2026-05-25

Status: rejected

## Idea

Iteration 009 accepted `pit_trend_quarterly_fresh540_top5` as the best PIT-only strategy by money-weighted return.
The accepted edge had two parts:

1. Ignore reports older than 540 days on the decision date.
2. Use quarterly Top 5 persistence instead of monthly churn.

This iteration asks whether the same 540-day freshness boundary gets better when cadence or concentration changes:

- Move the 540-day cap back to monthly persistence.
- Concentrate to Top 3.
- Dilute to Top 7.
- Keep the quarterly cadence while testing Top 3 and Top 7.

## Point-in-Time Contract

The strategy may use only information observable on the decision date:

- Same-day PIT board score.
- Same-day PIT trend eligibility.
- Same-day rank within the PIT trend universe.
- Report publication date and report age as of the decision date.
- Same-day moving-average stack.
- Same-day distance from the 52-week high.
- Current holdings and first-buy dates.

It must not use future returns, target-hit outcomes, future MFE, expiry return, later report labels, future benchmark prices, or future report revisions.

## Buy Rule

All variants preserve the same admission filter:

- Rank by `board_score`.
- Enter from PIT trend-eligible names.
- Require report age <= 540 days.
- Require same-day 20MA > 50MA > 200MA trend stack.
- Require distance from 52-week high >= -20%.
- Equal weight selected holdings.

Mutations:

| account | mutation |
| --- | --- |
| `pit_trend_persist20_fresh540_top5` | monthly rebalance, Top 5, Top 20 keep band |
| `pit_trend_persist20_fresh540_top3` | monthly rebalance, Top 3, Top 20 keep band |
| `pit_trend_persist20_fresh540_top7` | monthly rebalance, Top 7, Top 20 keep band |
| `pit_trend_quarterly_fresh540_top3` | quarterly rebalance, Top 3, Top 20 keep band |
| `pit_trend_quarterly_fresh540_top7` | quarterly rebalance, Top 7, Top 20 keep band |

## Sell/Rebalance Rule

All variants use the same persistence discipline:

1. Rebalance on the configured cadence.
2. Keep held names while they remain inside the Top 20 PIT trend rank band.
3. Keep at least 60 holding days before rank-band exits.
4. Sell names that no longer pass the selected admission filter at the next rebalance.
5. Do not sell because a target was hit.
6. Do not use future outcome labels.

## Result

Benchmark date: 2026-05-22.

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 66.76% | 629.94% | 37.19% | 29.74% | 1.04 | 1.50 | 558.5M KRW | 150 |
| `pit_trend_persist20_fresh540_top5` | 59.62% | 472.61% | 32.86% | 25.61% | 0.97 | 1.47 | 469.9M KRW | 433 |
| `pit_trend_persist20_fresh540_top3` | 56.43% | 319.90% | 30.93% | 32.29% | 0.85 | 1.33 | 434.5M KRW | 292 |
| `pit_trend_persist20_fresh540_top7` | 42.11% | 214.86% | 22.50% | 25.62% | 0.77 | 1.11 | 303.7M KRW | 557 |
| `pit_trend_quarterly_fresh540_top3` | 54.75% | 365.71% | 29.93% | 29.74% | 0.84 | 1.28 | 416.9M KRW | 99 |
| `pit_trend_quarterly_fresh540_top7` | 59.85% | 459.33% | 32.99% | 29.74% | 0.99 | 1.38 | 472.5M KRW | 191 |
| `pit_trend_persist20_top5` | 63.84% | 563.78% | 35.41% | 27.56% | 1.02 | 1.50 | 520.6M KRW | 437 |
| `pit_trend_persist20_quarterly_top5` | 63.79% | 587.11% | 35.38% | 29.74% | 1.02 | 1.43 | 520.0M KRW | 150 |
| `pit_score_top5` | 54.46% | 431.31% | 29.76% | 35.80% | 0.87 | 1.34 | 413.9M KRW | 357 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.00 | 1.31 | 323.7M KRW | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.14 | 1.66 | 236.3M KRW | 186 |

Closed episode quality:

| account | closed episodes | win rate | profit factor | median holding days | average holding days |
| --- | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 60 | 53.33% | 3.49 | 92.0 | 124.7 |
| `pit_trend_persist20_fresh540_top5` | 150 | 40.67% | 2.36 | 32.0 | 56.1 |
| `pit_trend_persist20_fresh540_top3` | 101 | 41.58% | 1.83 | 32.0 | 54.5 |
| `pit_trend_persist20_fresh540_top7` | 200 | 40.00% | 1.54 | 32.0 | 52.6 |
| `pit_trend_quarterly_fresh540_top3` | 40 | 47.50% | 1.95 | 92.0 | 123.3 |
| `pit_trend_quarterly_fresh540_top7` | 78 | 48.72% | 2.71 | 92.0 | 121.6 |
| `pit_trend_persist20_top5` | 145 | 44.14% | 2.47 | 32.0 | 58.5 |
| `pit_trend_persist20_quarterly_top5` | 58 | 53.45% | 3.67 | 92.0 | 132.1 |

## Retrospective

This iteration rejects every mutation.

The 540-day freshness boundary is useful only in the specific quarterly Top 5 shape found in Iteration 009.
Moving it back to monthly rebalance lowers MWR from 66.76% to 59.62% and increases trade count from 150 to 433.
It does reduce MDD from 29.74% to 25.61%, but the return sacrifice is too large for the current objective.

Top 3 concentration is worse in both monthly and quarterly forms.
It does not concentrate into the right winners often enough, and it carries worse episode profit factor than Top 5.

Top 7 dilution is also worse.
It adds more holdings and trades, but mostly dilutes the signal.
The quarterly Top 7 variant is closer than the monthly Top 7, yet still trails the accepted Top 5 rule by MWR, CAGR, Sharpe, Sortino, final equity, and profit factor.

The current best remains:

> `pit_trend_quarterly_fresh540_top5`

The important pattern is now sharper:

> The edge is not just "fresh reports" and not just "quarterly rebalance". It is the combination of fresh-enough reports, Top 5 concentration, quarterly patience, and Top 20 persistence.

## Next Mutation

Stop mutating concentration.
Top 5 remains the center.

The next loop should test whether the accepted rule survives cost realism:

1. Add explicit transaction-cost and slippage sensitivity to the research comparison.
2. Compare gross versus cost-adjusted MWR, CAGR, MDD, Sharpe, Sortino, profit factor, and trade count.
3. Keep `pit_trend_quarterly_fresh540_top5` unchanged as the baseline.
4. Test whether the accepted edge still beats KODEX200 and All-Weather after friction.
