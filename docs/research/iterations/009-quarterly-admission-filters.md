# Iteration 009 - Quarterly Admission Filters

Date: 2026-05-25

Status: accepted

## Idea

Iteration 008 showed that quarterly persistence should not be improved by mechanical exits.
The 50MA risk review lowered drawdown, but it cut the large winners and destroyed money-weighted return.

This iteration moves the search to admission filters:

1. Keep the quarterly Top 5 structure.
2. Test whether simple same-day 3M/6M momentum gates are enough.
3. Test whether report freshness improves the edge by removing stale reports without using future outcomes.

## Point-in-Time Contract

The strategy may use only information observable on the decision date:

- Same-day PIT board score.
- Same-day PIT trend eligibility.
- Same-day rank within the PIT trend universe.
- Same-day 3M and 6M return fields.
- Same-day distance from the 52-week high.
- Report publication date and report age as of the decision date.
- Same-day moving-average stack for the freshness variants.
- Current holdings and first-buy dates.

It must not use future returns, target-hit outcomes, future MFE, expiry return, later report labels, future benchmark prices, or future report revisions.

## Buy Rule

All variants preserve the quarterly Top 5 equal-weight PIT trend persistence structure:

- Rank by `board_score`.
- Enter from current PIT-eligible names only.
- Rebalance only quarterly.
- Target Top 5 equal weight.

Mutations:

| account | mutation |
| --- | --- |
| `pit_trend_quarterly_ret3_top5` | require same-day 3M return >= 0; do not require full MA-stack |
| `pit_trend_quarterly_ret6_top5` | require same-day 6M return >= 0; do not require full MA-stack |
| `pit_trend_quarterly_ret36_top5` | require same-day 3M and 6M return >= 0; do not require full MA-stack |
| `pit_trend_quarterly_fresh365_top5` | require report age <= 365 days; keep the existing MA-stack trend gate |
| `pit_trend_quarterly_fresh540_top5` | require report age <= 540 days; keep the existing MA-stack trend gate |

## Sell/Rebalance Rule

All variants use the same sell discipline:

1. Rebalance on quarterly anchors.
2. Keep held names while they remain inside the Top 20 PIT trend rank band.
3. Keep at least 60 holding days before rank-band exits.
4. Sell names that no longer pass the selected admission filter at the next quarterly rebalance.
5. Do not sell because a target was hit.
6. Do not use future outcome labels.

## Result

Benchmark date: 2026-05-22.

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_persist20_top5` | 63.84% | 563.78% | 35.41% | 27.56% | 1.02 | 1.50 | 520.6M KRW | 437 |
| `pit_trend_persist20_quarterly_top5` | 63.79% | 587.11% | 35.38% | 29.74% | 1.02 | 1.43 | 520.0M KRW | 150 |
| `pit_trend_quarterly_ret3_top5` | 36.88% | 216.16% | 19.50% | 22.74% | 0.68 | 0.94 | 265.9M KRW | 162 |
| `pit_trend_quarterly_ret6_top5` | 23.59% | 90.64% | 12.11% | 29.72% | 0.50 | 0.69 | 188.6M KRW | 153 |
| `pit_trend_quarterly_ret36_top5` | 34.10% | 156.93% | 17.92% | 25.49% | 0.64 | 0.89 | 247.5M KRW | 163 |
| `pit_trend_quarterly_fresh365_top5` | 54.60% | 387.45% | 29.84% | 31.46% | 0.88 | 1.23 | 415.4M KRW | 144 |
| `pit_trend_quarterly_fresh540_top5` | 66.76% | 629.94% | 37.19% | 29.74% | 1.04 | 1.50 | 558.5M KRW | 150 |
| `pit_trend_top5` | 56.59% | 429.34% | 31.03% | 27.58% | 0.89 | 1.30 | 436.3M KRW | 462 |
| `pit_score_top5` | 54.46% | 431.31% | 29.76% | 35.80% | 0.87 | 1.34 | 413.9M KRW | 357 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.00 | 1.31 | 323.7M KRW | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.14 | 1.66 | 236.3M KRW | 186 |

Closed episode quality:

| account | closed episodes | win rate | profit factor | median holding days | average holding days |
| --- | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_persist20_top5` | 145 | 44.14% | 2.47 | 32.0 | 58.5 |
| `pit_trend_persist20_quarterly_top5` | 58 | 53.45% | 3.67 | 92.0 | 132.1 |
| `pit_trend_quarterly_ret3_top5` | 56 | 37.50% | 2.02 | 94.0 | 158.0 |
| `pit_trend_quarterly_ret6_top5` | 49 | 38.78% | 1.76 | 94.0 | 176.7 |
| `pit_trend_quarterly_ret36_top5` | 59 | 33.90% | 1.84 | 93.0 | 148.4 |
| `pit_trend_quarterly_fresh365_top5` | 59 | 44.07% | 2.19 | 92.0 | 122.1 |
| `pit_trend_quarterly_fresh540_top5` | 60 | 53.33% | 3.49 | 92.0 | 124.7 |
| `pit_trend_top5` | 175 | 48.57% | 2.02 | 31.0 | 47.8 |
| `pit_score_top5` | 48 | 50.00% | 3.49 | 91.0 | 161.3 |

## Retrospective

This iteration finds a new best PIT-only candidate by money-weighted return:

> `pit_trend_quarterly_fresh540_top5`

The pure 3M/6M momentum gates do not work.
Relaxing the full trend gate and replacing it with simple positive 3M or 6M returns admits too many weaker names.
The result is lower MWR, lower Sharpe, lower profit factor, and no useful improvement in strategy quality.

The freshness filter is different.
The 365-day cap is too strict and cuts off too many delayed winners.
The 540-day cap is a better boundary: it removes stale report drag while preserving enough long-duration winners.

Against the previous monthly MWR leader, `pit_trend_quarterly_fresh540_top5` improves:

- MWR: 66.76% vs 63.84%.
- TWR: 629.94% vs 563.78%.
- CAGR: 37.19% vs 35.41%.
- Final equity: 558.5M KRW vs 520.6M KRW.
- Trades: 150 vs 437.

The caveat is drawdown.
Its MDD is 29.74%, worse than the monthly persistence rule's 27.56% and much worse than KODEX200's 19.90%.
This is still a high-volatility active equity rule.

## Next Mutation

The next loop should preserve the 540-day freshness insight and avoid mechanical exits:

1. Apply the 540-day report-age cap to the monthly persistence rule.
2. Test 540-day freshness with Top 3 and Top 7 concentration.
3. Test 540-day freshness with quarterly versus monthly rebalance under the same Top 20 keep band.
4. Add tax/friction sensitivity after the gross edge is stable.
5. Keep equal weighting unless a new sizing rule beats the current best after costs.
