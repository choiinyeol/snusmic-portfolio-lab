# 041 Mixed Entry Profit Cushion

## Idea

Iteration 040 clarified the current rule:

> keep valid winners first, then fill remaining slots with `candidate_score`.

The next question is not another score formula. It is whether the retained-winner cap should trim earlier or later under that fixed mixed-entry contract.

The existing rule trims a retained winner toward 40% only when:

- the holding exceeds 45% of account equity,
- the monitor runs on the weekly mark-to-market cadence,
- the holding is at least +60% above known average cost.

This iteration tests nearby profit cushions:

- +50%: trim slightly earlier,
- +60%: current mixed-entry candidate,
- +70%: trim later.

## Point-in-Time Contract

All three accounts use the same point-in-time entry and retention contract:

- report metadata known as of the decision date,
- price history available through the decision date only,
- board-score retention rank for existing holdings,
- candidate-score ordering for newly opened slots,
- no target-hit outcome, future return, or later report data in same-day ranking.

The profit cushion uses only the account's known average cost and the current mark-to-market price on each monitor date.

## Buy Rule

Keep the mixed-entry buy rule:

```text
retain valid holdings first
rank the remaining admissible board by candidate_score
fill open slots up to Top5
```

## Sell/Rebalance Rule

Keep the same run-winners rule and vary only the retained cap profit cushion:

```text
if retained holding weight > 45%
and unrealized return >= cushion
then trim toward 40%
```

Tested cushions:

| account | cushion |
| --- | ---: |
| mixed-entry Profit50 | +50% |
| mixed-entry Profit60 | +60% |
| mixed-entry Profit70 | +70% |

## Implementation

Added two new account configs:

- `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_mixedentry_top5`
- `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit70_mixedentry_top5`

The existing `profit60_mixedentry` account remains the baseline.

Generated report command:

```bash
uv run --locked python -m snusmic_pipeline research-report \
  --sim data/sim \
  --accounts pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_mixedentry_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit70_mixedentry_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5,benchmark_kodex200,all_weather \
  --baseline pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5 \
  --title "041 Mixed Entry Profit Cushion" \
  --out docs/research/iterations/041-mixed-entry-profit-cushion-generated.md
```

## Result

Generated report:

- [041-mixed-entry-profit-cushion-generated.md](041-mixed-entry-profit-cushion-generated.md)

Summary:

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| mixed-entry Profit50 | 76.63% | 969.91% | 43.28% | 27.38% | 1.1931 | 1.8460 | 705.3M | 131 |
| mixed-entry Profit60 | 76.66% | 982.30% | 43.30% | 27.47% | 1.1847 | 1.8393 | 705.8M | 131 |
| mixed-entry Profit70 | 76.00% | 848.26% | 42.88% | 29.74% | 1.1372 | 1.6564 | 695.0M | 130 |
| board-score Profit60 | 74.13% | 911.35% | 41.73% | 27.47% | 1.1516 | 1.7640 | 665.3M | 129 |
| KODEX200 | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| All-Weather | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

Daily delta versus mixed-entry Profit60:

| account | final delta | positive days | min daily delta | max daily delta |
| --- | ---: | ---: | ---: | ---: |
| mixed-entry Profit50 | -0.5M | 0.07% | -0.7M | 0.2M |
| mixed-entry Profit70 | -10.8M | 0.07% | -11.0M | 0.0M |
| board-score Profit60 | -40.5M | 1.00% | -41.4M | 2.6M |

Trade reasons:

| account | rebalance buy | rebalance sell | retained cap trim |
| --- | ---: | ---: | ---: |
| mixed-entry Profit50 | 69 | 59 | 3 |
| mixed-entry Profit60 | 69 | 59 | 3 |
| mixed-entry Profit70 | 69 | 59 | 2 |

## Retrospective

Profit50 and Profit60 are effectively a plateau, but they are not identical.

Profit50 trims a little earlier:

- slightly lower MDD,
- slightly higher Sharpe and Sortino,
- 466K KRW lower final equity.

Profit60 remains the better absolute-return candidate:

- highest MWR,
- highest final equity,
- identical trade count to Profit50,
- still far ahead of KODEX200 and All-Weather.

Profit70 waits too long. It skips one useful trim, worsens MDD back to 29.74%, and gives up 10.8M KRW versus Profit60.

The current conclusion is:

> +60% remains the canonical mixed-entry setting; +50% is a risk-adjusted sibling, not a replacement.

## Next Mutation

The exit-cushion threshold branch is now narrow. The next test should move from "how much profit before trimming?" to "what happens after a position exits?"

Useful next experiment:

```text
mixed-entry Profit60 + delayed replacement
```

Instead of immediately filling every newly opened slot on the next rebalance, require a fresh entrant to exceed the last exited holding's candidate-score rank or clear a minimum candidate-score gap. This tests whether the current edge depends on over-eager replacement after sells.
