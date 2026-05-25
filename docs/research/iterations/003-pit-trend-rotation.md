# Iteration 003 - PIT Trend Rotation

Date: 2026-05-25

Status: rejected

## Idea

Iteration 002 showed that stop exits reduced return too aggressively because the account sat in cash after exits.

This mutation tests a different assumption:

> If a PIT trend holding exits, immediately rotate that capital into the next eligible PIT trend candidates instead of waiting in cash.

The hypothesis was that rotation would keep exposure high while still removing broken trend names.

## Point-in-time contract

The strategy may only use fields available on each decision date:

- PIT research board rows generated for that date.
- PIT score / board score computed from past and current information only.
- Current close and moving-average state as of the decision date.
- 52-week high distance as of the decision date.
- Account holdings and realized/unrealized state as of the decision date.

It must not use future return windows, future target-hit status, future report outcomes, or final realized performance.

## Buy rule

Base universe:

- Use `board_score`.
- Require MA stack to pass the trend filter.
- Require the symbol to be no worse than -20% from its 52-week high.
- Equal-weight the selected Top 5 names.

Mutations tested:

| account | rule |
| --- | --- |
| `pit_trend_rotate_top5` | monthly Top 5 plus immediate replacement when a 50MA exit fires |
| `pit_trend_rotate_fast_top5` | twice-monthly Top 5 plus immediate replacement when a 50MA exit fires |
| `pit_trend_rotate_stop_top5` | monthly Top 5 plus immediate replacement when a 50MA or -12% stop fires |

## Sell/rebalance rule

Base trend exit:

- Exit when a held symbol loses the 50MA trend condition.

Rotation addition:

- On an exit day, recompute eligible candidates using only that day.
- Exclude symbols that just exited that day.
- Rebalance immediately into the remaining Top 5 target weights.

This keeps the account invested, but it also makes the strategy much more reactive.

## Result

Benchmark date: 2026-05-22.

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_top5` | 56.59% | 429.34% | 31.03% | 27.58% | 0.89 | 1.30 | 436.3M KRW | 462 |
| `pit_trend_rotate_top5` | 18.88% | 66.03% | 9.58% | 38.80% | 0.43 | 0.61 | 166.8M KRW | 1,073 |
| `pit_trend_rotate_fast_top5` | 17.12% | 44.21% | 8.65% | 37.17% | 0.40 | 0.58 | 159.3M KRW | 1,377 |
| `pit_trend_rotate_stop_top5` | 18.51% | 73.44% | 9.39% | 35.51% | 0.42 | 0.60 | 165.2M KRW | 1,192 |
| `pit_trend_stop_top5` | 32.69% | 111.35% | 17.13% | 22.88% | 0.64 | 0.89 | 238.7M KRW | 489 |
| `pit_score_top5` | 54.46% | 431.31% | 29.76% | 35.80% | 0.87 | 1.34 | 413.9M KRW | 357 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.00 | 1.31 | 323.7M KRW | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.14 | 1.66 | 236.3M KRW | 186 |

Closed episode quality:

| account | closed episodes | win rate | profit factor | median holding days |
| --- | ---: | ---: | ---: | ---: |
| `pit_trend_top5` | 175 | 48.57% | 2.02 | 31.0 |
| `pit_trend_rotate_top5` | 342 | 36.84% | 1.15 | 16.5 |
| `pit_trend_rotate_fast_top5` | 414 | 38.41% | 1.13 | 15.0 |
| `pit_trend_rotate_stop_top5` | 379 | 36.68% | 1.12 | 14.0 |
| `pit_trend_stop_top5` | 201 | 36.82% | 1.22 | 28.0 |
| `pit_score_top5` | 48 | 50.00% | 3.49 | 91.0 |

## Retrospective

The rotation idea failed.

The failure is not subtle:

- Trade count more than doubled versus `pit_trend_top5`.
- Median holding period collapsed from 31 days to roughly 14-17 days.
- Profit factor collapsed from 2.02 to roughly 1.12-1.15.
- MDD got worse, not better.
- Final equity fell below KODEX200, All-Weather, and even the already-rejected stop strategy.

The rule is reacting to trend noise instead of preserving trend winners. It turns a research-ledger trend strategy into churn.

The useful lesson is that PIT trend selection needs persistence. It should not replace a name just because a short-term technical filter flickers.

## Next mutation

Test rank persistence instead of daily exit rotation:

- Keep `pit_trend_top5` as the base.
- Rebalance monthly only.
- Add a minimum holding period, for example 60 trading days.
- Sell only when a holding drops out of a broad PIT rank band such as Top 20 or Top 30.
- Optionally require the trend filter to fail for two consecutive monthly checkpoints before replacement.

This preserves the original edge: concentrated PIT-ranked winners with enough time to compound.
