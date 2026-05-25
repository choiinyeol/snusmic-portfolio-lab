# 040 Mixed Entry Ranker

## Idea

Iteration 039 showed that the candidate-score edge came from a stateful slot problem.

On 2024-07-01 both the candidate-score and board-score Profit60 accounts retained SK Hynix. That retained winner consumed one of the five target slots, so the live decision was not a fresh Top5 board. It was four new entries after one retained holding.

This iteration tests the narrow mechanism:

> keep and sell existing holdings using conservative `board_score`, but fill newly opened slots using `candidate_score`.

If the result still matches candidate-score Top5, then the edge is specifically new-entry ordering, not candidate-score retention.

## Point-in-Time Contract

The mixed-entry account uses the same point-in-time inputs as the accepted Profit60 branch:

- eligible reports known on each decision date,
- daily close/high/low data available through that date,
- report freshness cap of 540 days,
- technical admission gates already present in the PIT board,
- generated account state from prior trades only.

No future price, target-hit outcome, or later report result is used to rank a same-day candidate.

## Buy Rule

The account keeps the existing Profit60 shell and Top5 target count.

For new entries:

```text
rank eligible rows by candidate_score
fill open target slots after retained holdings
buy equal target weights for newly admitted symbols
```

## Sell/Rebalance Rule

For retained holdings:

```text
rank eligible rows by board_score
keep existing holdings while they remain inside the retention band
avoid equal-weight sell-downs of valid retained winners
trim retained winners only when the weekly 45% cap and +60% profit cushion fire
```

This separates the two decisions that were previously entangled:

- retention is conservative and board-shaped,
- new-entry admission is candidate-score shaped.

## Implementation

Added account-level score overrides:

- `entry_score_field`
- `retention_score_field`

The new account is:

```text
pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5
```

The generated report command:

```bash
uv run --locked python -m snusmic_pipeline research-report \
  --sim data/sim \
  --accounts pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5,benchmark_kodex200,all_weather \
  --baseline pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5 \
  --title "040 Mixed Entry Ranker" \
  --out docs/research/iterations/040-mixed-entry-ranker-generated.md
```

## Result

Generated report:

- [040-mixed-entry-ranker-generated.md](040-mixed-entry-ranker-generated.md)

Summary:

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| mixed-entry Top5 | 76.66% | 982.30% | 43.30% | 27.47% | 1.1847 | 1.8393 | 705.8M | 131 |
| candidate-score Top5 | 76.66% | 982.30% | 43.30% | 27.47% | 1.1847 | 1.8393 | 705.8M | 131 |
| board-score Profit60 | 74.13% | 911.35% | 41.73% | 27.47% | 1.1516 | 1.7640 | 665.3M | 129 |
| KODEX200 | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| All-Weather | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

Daily delta versus candidate-score Top5:

| account | final delta | positive days | min daily delta | max daily delta |
| --- | ---: | ---: | ---: | ---: |
| mixed-entry Top5 | 0.0M | 0.00% | 0.0M | 0.0M |
| board-score Profit60 | -40.5M | 1.00% | -41.4M | 2.6M |

Mixed-entry exactly matches candidate-score Top5 at the daily equity level.

## Retrospective

This is not a new return improvement, but it is a useful simplification of the explanation.

The accepted mechanism is now:

```text
1. Keep valid winners first.
2. Let those winners run unless the profit-cushion cap fires.
3. Fill only the remaining open slots.
4. Rank those new entries by candidate_score.
```

Candidate-score retention is not necessary in the observed path. Conservative board-score retention plus candidate-score new-entry ordering produces the same account.

This makes the strategy less like a leaderboard artifact and more like a repeatable rule:

> candidate_score is an entry-priority score, not a full portfolio truth score.

## Next Mutation

The next branch should keep mixed-entry/candidate-entry semantics fixed and test exit construction only.

Useful next mutations:

1. profit-cushion 50/60/70 under mixed-entry semantics,
2. delayed replacement after a sell event,
3. minimum new-entry score gap before replacing cash,
4. transaction-cost stress after any accepted exit mutation.

Do not add another free-form score formula until the exit/replacement branch is exhausted.
