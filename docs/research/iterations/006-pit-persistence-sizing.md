# Iteration 006 - PIT Persistence Sizing

Date: 2026-05-25

Status: rejected

## Idea

Iteration 004 accepted the main shape: Top 5 PIT trend names, held while they remain inside a broader Top 20 rank band.
Iteration 005 showed that changing concentration or admission filters made the strategy worse.

This iteration keeps the same entry and exit logic and changes only position sizing:

1. Weight by current PIT board score.
2. Weight by current PIT board score with a 30% per-name cap.
3. Weight by inverse trailing volatility.
4. Weight by inverse trailing volatility with a 30% per-name cap.

The test asks whether equal weight is leaving obvious information on the table.

## Point-in-time contract

The strategy may use only information observable on the decision date:

- Same-day PIT board score.
- Same-day PIT trend eligibility.
- Same-day rank within the PIT trend universe.
- Same-day distance from 52-week high.
- Current account holdings and first-buy dates.
- Trailing close-to-close volatility ending on the decision date.

It must not use future returns, target-hit outcomes, future MFE, expiry return, or later report results.

## Buy Rule

All variants preserve the accepted rank-persistence structure:

- Rank by `board_score`.
- Keep held names while they remain trend-eligible and inside the Top 20 rank band.
- Fill vacancies from current eligible candidates.
- Monthly rebalance.
- Top 5 target basket.

Sizing mutations:

| account | sizing |
| --- | --- |
| `pit_trend_persist20_score_top5` | selected names weighted by positive PIT board score |
| `pit_trend_persist20_scorecap_top5` | score weights capped at 30% per name |
| `pit_trend_persist20_invvol_top5` | selected names weighted by inverse trailing 180-calendar-day volatility |
| `pit_trend_persist20_invvolcap_top5` | inverse-volatility weights capped at 30% per name |

## Sell/Rebalance Rule

The sell/rebalance rule is unchanged:

1. Keep held symbols inside the Top 20 PIT trend band.
2. Sell names outside the band or no longer trend-eligible.
3. Fill vacancies from the current PIT trend ranking.
4. Apply the sizing rule to the resulting basket.

No target-hit exit, no future result label, no daily stop.

## Result

Benchmark date: 2026-05-22.

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_persist20_top5` | 63.84% | 563.78% | 35.41% | 27.56% | 1.02 | 1.50 | 520.6M KRW | 437 |
| `pit_trend_persist20_score_top5` | 60.44% | 425.42% | 33.35% | 34.27% | 0.93 | 1.35 | 479.4M KRW | 437 |
| `pit_trend_persist20_scorecap_top5` | 60.09% | 430.21% | 33.14% | 28.92% | 0.94 | 1.40 | 475.4M KRW | 437 |
| `pit_trend_persist20_invvol_top5` | 58.43% | 503.04% | 32.13% | 26.02% | 0.98 | 1.44 | 456.4M KRW | 436 |
| `pit_trend_persist20_invvolcap_top5` | 58.79% | 500.64% | 32.35% | 25.97% | 0.98 | 1.45 | 460.5M KRW | 434 |
| `pit_trend_top5` | 56.59% | 429.34% | 31.03% | 27.58% | 0.89 | 1.30 | 436.3M KRW | 462 |
| `pit_score_top5` | 54.46% | 431.31% | 29.76% | 35.80% | 0.87 | 1.34 | 413.9M KRW | 357 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.00 | 1.31 | 323.7M KRW | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.14 | 1.66 | 236.3M KRW | 186 |

Closed episode quality:

| account | closed episodes | win rate | profit factor | median holding days | average holding days |
| --- | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_persist20_top5` | 145 | 44.14% | 2.47 | 32.0 | 58.5 |
| `pit_trend_persist20_score_top5` | 148 | 44.59% | 2.31 | 32.0 | 56.5 |
| `pit_trend_persist20_scorecap_top5` | 148 | 44.59% | 2.28 | 32.0 | 56.5 |
| `pit_trend_persist20_invvol_top5` | 148 | 43.92% | 2.40 | 32.0 | 56.7 |
| `pit_trend_persist20_invvolcap_top5` | 147 | 43.54% | 2.41 | 32.0 | 57.1 |
| `pit_trend_top5` | 175 | 48.57% | 2.02 | 31.0 | 47.8 |

## Retrospective

No sizing mutation beats the equal-weight accepted rule.

Score weighting is especially unattractive: it reduces final equity and Sharpe, and the uncapped version pushes MDD to 34.27%.
That suggests `board_score` is good enough to rank admission, but too noisy to size capital linearly.

Inverse-volatility sizing is more respectable. It lowers MDD from 27.56% to about 26.0%, but the return tradeoff is too expensive:
MWR falls from 63.84% to 58.43-58.79%, and final equity falls by roughly 60M KRW.
The accepted strategy appears to need equal-weight exposure to volatile winners rather than dampening them.

The accepted shape is still:

> Top 5 equal weight, broad Top 20 keep band, all-universe PIT trend eligibility.

## Next Mutation

The next loop should not keep squeezing the same weight vector.
The more promising next question is timing:

1. Preserve equal weighting.
2. Test whether rebalance timing matters: monthly first trading day versus quarterly.
3. Test a mild market-regime gate using only same-day benchmark trend, not future returns.
4. Reject any variant that improves drawdown by giving up most of the persistence edge.
