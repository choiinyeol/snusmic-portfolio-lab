# Iteration 005 - PIT Persistence Boundaries

Date: 2026-05-25

Status: rejected

## Idea

Iteration 004 found a strong improvement: keep PIT trend holdings while they remain inside a broad Top 20 rank band.

This iteration tests whether the accepted rule can be improved by changing concentration and admission strictness:

1. Concentrate into Top 3.
2. Broaden into Top 7.
3. Require names to be within -10% of their 52-week high.
4. Restrict the universe to domestic reports only.

The goal is not to add complexity. The goal is to find the boundary around the accepted `pit_trend_persist20_top5` rule.

## Point-in-time contract

The strategy may only use data available on each decision date:

- Same-day PIT board score.
- Same-day PIT trend eligibility.
- Same-day rank within the PIT trend universe.
- Same-day distance from 52-week high.
- Symbol universe label available in the PIT board.
- Current account holdings and first-buy dates.

It must not use future returns, target-hit outcomes, future MFE, expiry return, or later report results.

## Buy rule

All variants preserve the accepted rank-persistence structure:

- Rank by `board_score`.
- Keep held names while they remain trend-eligible and inside the Top 20 rank band.
- Fill vacancies from current eligible candidates.
- Monthly rebalance.

Mutations tested:

| account | mutation |
| --- | --- |
| `pit_trend_persist20_top3` | Top 3 concentration |
| `pit_trend_persist20_top7` | Top 7 broader basket |
| `pit_trend_persist20_52w10_top5` | Top 5, but require distance from 52-week high >= -10% |
| `pit_trend_persist20_domestic_top5` | Top 5, domestic-only universe |

## Sell/rebalance rule

The sell/rebalance rule is unchanged from Iteration 004:

1. Keep held symbols inside the Top 20 PIT trend band.
2. Sell names outside the band or no longer trend-eligible.
3. Fill vacancies from the current PIT trend ranking.
4. Equal-weight the resulting basket.

No daily stop, no target-hit exit, no future result labels.

## Result

Benchmark date: 2026-05-22.

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_persist20_top5` | 63.84% | 563.78% | 35.41% | 27.56% | 1.02 | 1.50 | 520.6M KRW | 437 |
| `pit_trend_persist20_top3` | 53.31% | 255.74% | 29.07% | 32.29% | 0.82 | 1.24 | 402.3M KRW | 285 |
| `pit_trend_persist20_top7` | 44.61% | 230.98% | 23.95% | 27.86% | 0.80 | 1.16 | 323.6M KRW | 574 |
| `pit_trend_persist20_52w10_top5` | 57.10% | 417.64% | 31.34% | 28.89% | 0.94 | 1.38 | 441.8M KRW | 417 |
| `pit_trend_persist20_domestic_top5` | 50.13% | 197.37% | 27.19% | 34.93% | 0.80 | 1.18 | 371.7M KRW | 400 |
| `pit_trend_top5` | 56.59% | 429.34% | 31.03% | 27.58% | 0.89 | 1.30 | 436.3M KRW | 462 |
| `pit_score_top5` | 54.46% | 431.31% | 29.76% | 35.80% | 0.87 | 1.34 | 413.9M KRW | 357 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.00 | 1.31 | 323.7M KRW | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.14 | 1.66 | 236.3M KRW | 186 |

Closed episode quality:

| account | closed episodes | win rate | profit factor | median holding days | average holding days |
| --- | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_persist20_top5` | 145 | 44.14% | 2.47 | 32.0 | 58.5 |
| `pit_trend_persist20_top3` | 97 | 43.30% | 2.32 | 32.0 | 57.1 |
| `pit_trend_persist20_top7` | 205 | 40.98% | 1.68 | 32.0 | 52.8 |
| `pit_trend_persist20_52w10_top5` | 146 | 41.78% | 2.13 | 32.0 | 53.7 |
| `pit_trend_persist20_domestic_top5` | 145 | 40.00% | 2.04 | 32.0 | 51.8 |
| `pit_trend_top5` | 175 | 48.57% | 2.02 | 31.0 | 47.8 |

## Retrospective

No tested mutation beats `pit_trend_persist20_top5`.

The boundary is useful:

- Top 3 is too concentrated. Average winner is larger, but drawdown rises and total compounding falls.
- Top 7 is too diluted. It behaves close to KODEX200 and loses the concentrated winner effect.
- The -10% 52-week-high gate is too strict. It avoids some weaker names but appears to enter too late.
- Domestic-only removes too much opportunity. The accepted strategy benefits from allowing overseas winners when they rank well on the same PIT board.

The accepted shape is therefore still:

> Top 5 equal weight, broad Top 20 keep band, all-universe PIT trend eligibility.

## Next mutation

The next loop should test position sizing, not more entry filters:

1. Keep the same Top 5 / Top 20 persistence rule.
2. Compare equal weight against score-weighted caps, for example 30% max per name.
3. Test volatility-aware sizing using only trailing volatility observable on the decision date.
4. Keep the same monthly rebalance and no daily stop.

Reject any mutation that improves return only by pushing MDD materially above the current 27.56%.
