# Iteration 007 - PIT Persistence Timing and Regime

Date: 2026-05-25

Status: accepted as low-churn variant

## Idea

Iteration 006 rejected score and volatility sizing.
The winning shape still looked simple:

> Top 5 equal weight, PIT trend eligibility, keep holdings while they remain inside a Top 20 rank band.

This iteration keeps that stock-selection rule intact and tests only execution timing and a same-day market-regime gate:

1. Rebalance twice monthly.
2. Rebalance quarterly.
3. Rebalance monthly only when KODEX200 is above its same-day 50-day moving average.
4. Rebalance monthly only when KODEX200 is above its same-day 200-day moving average.

The question is whether the persistence edge is sensitive to calendar timing or broad Korean market trend.

## Point-in-time Contract

The strategy may use only information observable on the decision date:

- Same-day PIT board score.
- Same-day PIT trend eligibility.
- Same-day rank within the PIT trend universe.
- Current holdings and first-buy dates.
- Same-day KODEX200 close.
- Same-day trailing KODEX200 moving average ending on the decision date.

It must not use future returns, target-hit outcomes, future MFE, expiry return, later report labels, or later benchmark prices.

The KODEX gate reads benchmark prices from the simulation benchmark price board because `069500.KS` is a benchmark artifact, not a member of the PIT stock price universe.

## Buy Rule

All variants preserve the accepted rank-persistence structure:

- Rank by `board_score`.
- Enter from current PIT trend-eligible names.
- Keep held names while they remain trend-eligible and inside the Top 20 rank band.
- Target Top 5 equal weight.

Timing and regime mutations:

| account | mutation |
| --- | --- |
| `pit_trend_persist20_semimonthly_top5` | rebalance on the 1st and 15th trading-day anchors |
| `pit_trend_persist20_quarterly_top5` | rebalance quarterly |
| `pit_trend_persist20_kodex50_top5` | rebalance monthly only when KODEX200 close is above its 50-day moving average |
| `pit_trend_persist20_kodex200_top5` | rebalance monthly only when KODEX200 close is above its 200-day moving average |

## Sell/Rebalance Rule

The sell/rebalance rule is unchanged except for the timing or market gate:

1. On allowed rebalance dates, keep held symbols inside the Top 20 PIT trend band.
2. Sell names outside the band or no longer trend-eligible.
3. Fill vacancies from the current PIT trend ranking.
4. Equal-weight the resulting basket.

When the market gate is closed, the portfolio moves to cash instead of selecting new names.
No target-hit exit, no future result label, no daily stop.

## Result

Benchmark date: 2026-05-22.

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_persist20_top5` | 63.84% | 563.78% | 35.41% | 27.56% | 1.02 | 1.50 | 520.6M KRW | 437 |
| `pit_trend_persist20_semimonthly_top5` | 45.10% | 307.50% | 24.24% | 34.46% | 0.78 | 1.13 | 327.6M KRW | 811 |
| `pit_trend_persist20_quarterly_top5` | 63.79% | 587.11% | 35.38% | 29.74% | 1.02 | 1.43 | 520.0M KRW | 150 |
| `pit_trend_persist20_kodex50_top5` | 40.38% | 259.46% | 21.50% | 21.78% | 0.88 | 0.96 | 290.7M KRW | 242 |
| `pit_trend_persist20_kodex200_top5` | 52.03% | 468.41% | 28.31% | 28.69% | 1.08 | 1.14 | 389.7M KRW | 228 |
| `pit_trend_top5` | 56.59% | 429.34% | 31.03% | 27.58% | 0.89 | 1.30 | 436.3M KRW | 462 |
| `pit_score_top5` | 54.46% | 431.31% | 29.76% | 35.80% | 0.87 | 1.34 | 413.9M KRW | 357 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.00 | 1.31 | 323.7M KRW | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.14 | 1.66 | 236.3M KRW | 186 |

Closed episode quality:

| account | closed episodes | win rate | profit factor | median holding days | average holding days |
| --- | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_persist20_top5` | 145 | 44.14% | 2.47 | 32.0 | 58.5 |
| `pit_trend_persist20_semimonthly_top5` | 237 | 39.66% | 1.98 | 30.0 | 37.8 |
| `pit_trend_persist20_quarterly_top5` | 58 | 53.45% | 3.67 | 92.0 | 132.1 |
| `pit_trend_persist20_kodex50_top5` | 92 | 41.30% | 1.50 | 32.0 | 43.4 |
| `pit_trend_persist20_kodex200_top5` | 75 | 44.00% | 2.32 | 32.0 | 56.8 |
| `pit_trend_top5` | 175 | 48.57% | 2.02 | 31.0 | 47.8 |
| `pit_score_top5` | 48 | 50.00% | 3.49 | 91.0 | 161.3 |

## Retrospective

Twice-monthly rebalancing is rejected.
It adds churn, lowers win rate, raises drawdown, and destroys the persistence edge.
More frequent checking is not more intelligence here; it just interrupts winners.

Quarterly rebalancing is the useful discovery.
It does not beat the monthly persistence rule by MWR, but it comes very close:

- MWR: 63.79% versus 63.84%.
- Final equity: 520.0M KRW versus 520.6M KRW.
- Trades: 150 versus 437.
- Profit factor: 3.67 versus 2.47.

The cost is a slightly higher MDD and lower Sortino.
That makes it an operationally attractive variant, not the new headline best.

KODEX trend gates are not good enough as primary rules.
The 50-day gate reduces MDD but sacrifices too much return.
The 200-day gate has the highest Sharpe in this batch, but it still gives up too much MWR and final equity relative to the accepted persistence rule.
The broad market gate appears to cut both bad and good exposure; this strategy needs to stay invested in strong SMIC-covered names even when the index is imperfect.

Current best by MWR remains:

> `pit_trend_persist20_top5`

Practical low-churn challenger:

> `pit_trend_persist20_quarterly_top5`

## Next Mutation

The next loop should test whether the quarterly variant can be made less drawdown-prone without giving up the trade-count advantage.

Candidates:

1. Quarterly Top5 with monthly risk review but no replacement unless rank exits the Top 30 band.
2. Quarterly Top5 with a cash throttle only when KODEX200 is below its 200-day average and the selected stock is also below its own 50-day average.
3. Quarterly Top5 with rank-persistence Top30 instead of Top20.
4. Compare after-tax/friction-sensitive scoring because quarterly turnover may dominate once realistic cost assumptions tighten.
