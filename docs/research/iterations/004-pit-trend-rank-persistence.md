# Iteration 004 - PIT Trend Rank Persistence

Date: 2026-05-25

Status: accepted

## Idea

Iteration 003 proved that immediate rotation after technical exits creates churn.

This mutation tests the opposite idea:

> Do not replace a PIT trend winner just because it falls out of the exact Top 5. Keep it while it remains inside a broader PIT rank band, then fill only open slots from the current Top 5 candidates.

The hypothesis is trend-following 101: the edge may come from letting a good name keep compounding, not from constantly reselecting the freshest top-ranked row.

## Point-in-time contract

The strategy may only use information observable on the rebalance date:

- PIT board score and technical fields as of that date.
- Rank among same-day PIT trend-eligible rows.
- Current holdings and first-buy dates in the account ledger.
- Current close prices available as of that date.

It must not use future returns, target-hit outcomes, MFE, expiry return, or any later report result.

## Buy rule

Base eligibility matches `pit_trend_top5`:

- Rank by `board_score`.
- Require MA stack.
- Require distance from 52-week high >= -20%.
- Equal-weight up to 5 selected names.
- Monthly rebalance.

Mutations tested:

| account | rule |
| --- | --- |
| `pit_trend_persist20_top5` | keep current holdings while they remain in same-day PIT trend Top 20; fill vacancies from current Top 5 |
| `pit_trend_persist30_top5` | same, but Top 30 keep band |
| `pit_trend_persist20_hold90_top5` | same as Top 20, plus avoid replacing a holding before 90 calendar days if it is still trend-eligible |

## Sell/rebalance rule

On each monthly rebalance date:

1. Build the same-day PIT trend ranking.
2. Keep held symbols that are still trend-eligible and inside the configured rank band.
3. Also keep still-eligible young holdings if the minimum-holding rule applies.
4. Fill any remaining slots from the current PIT trend Top 5.
5. Equal-weight the final selected basket.

There are no daily stop exits in this iteration.

## Result

Benchmark date: 2026-05-22.

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_persist20_top5` | 63.84% | 563.78% | 35.41% | 27.56% | 1.02 | 1.50 | 520.6M KRW | 437 |
| `pit_trend_persist30_top5` | 63.84% | 563.78% | 35.41% | 27.56% | 1.02 | 1.50 | 520.6M KRW | 437 |
| `pit_trend_persist20_hold90_top5` | 63.84% | 563.78% | 35.41% | 27.56% | 1.02 | 1.50 | 520.6M KRW | 437 |
| `pit_trend_top5` | 56.59% | 429.34% | 31.03% | 27.58% | 0.89 | 1.30 | 436.3M KRW | 462 |
| `pit_score_top5` | 54.46% | 431.31% | 29.76% | 35.80% | 0.87 | 1.34 | 413.9M KRW | 357 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.00 | 1.31 | 323.7M KRW | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.14 | 1.66 | 236.3M KRW | 186 |

Closed episode quality:

| account | closed episodes | win rate | profit factor | median holding days | average holding days |
| --- | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_persist20_top5` | 145 | 44.14% | 2.47 | 32.0 | 58.5 |
| `pit_trend_persist30_top5` | 145 | 44.14% | 2.47 | 32.0 | 58.5 |
| `pit_trend_persist20_hold90_top5` | 145 | 44.14% | 2.47 | 32.0 | 58.5 |
| `pit_trend_top5` | 175 | 48.57% | 2.02 | 31.0 | 47.8 |
| `pit_score_top5` | 48 | 50.00% | 3.49 | 91.0 | 161.3 |

## Retrospective

This is the first accepted mutation after the original `pit_trend_top5`.

The result supports a clean interpretation:

- The exact monthly Top 5 list is too twitchy.
- Keeping trend-eligible holdings while they remain inside a wider rank band improves compounding.
- Lower win rate is acceptable because average winner size improved.
- Trade count fell slightly, realized PnL rose, and MDD stayed almost unchanged.
- Top20, Top30, and Top20+90D produced the same path in this sample, meaning the actual replacement events were already decided by a narrower natural rank/eligibility boundary.

The better strategy is not more signals. It is better position persistence.

## Next mutation

Test whether the persistence rule can be improved without adding churn:

1. `persist20_top3`: same rank-persistence logic but concentrated in Top 3.
2. `persist20_top7`: same rank-persistence logic but slightly broader Top 7.
3. `persist20_52w10_top5`: same Top 5 but require distance from 52-week high >= -10%.
4. `persist20_domestic_top5`: same Top 5 but domestic-only, to see whether FX/overseas names are noise or alpha.

The next loop should reject any mutation that improves return only by raising drawdown materially above the current 27.56% MDD.
