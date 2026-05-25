# 057 TrailTrim Profit Gate

## Idea

Iteration 056 confirmed that the 20% post-trigger weight cap is the useful local cap. This iteration checks whether the trim trigger is too early by requiring a larger winner before the same partial trim can fire.

## Point-in-time contract

The profit gate uses only live account state available on the decision date:

- holding average cost known from prior fills
- current marked price from the daily close
- current account equity and holding weight
- holding-period high observed so far

It does not inspect future returns, later target hits, or final outcome labels.

## Buy rule

Unchanged from the current leader:

- quarterly Top 5
- reports no older than 540 days
- moving-average stack required
- entry no more than 20% below 52-week high
- retain existing holdings with `board_score`
- fill new vacancies with `candidate_score`

## Sell/rebalance rule

Keep:

- weekly retained-winner cap: above 45% weight, trim toward 40% only after +60% unrealized profit
- trailing drawdown trigger: 25% pullback from the observed holding-period high
- trailing trim cap: trim toward 20% account weight

Compare the minimum unrealized-profit gate before the trailing trim is allowed:

- +100% current leader
- +120%
- +150%

## Result

Generated report: [057-trailtrim-profit-gate-generated.md](057-trailtrim-profit-gate-generated.md)

| account | MWR | CAGR | MDD | final equity | trades | trailing trims |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| TrailTrim +100 / DD25 / Cap20 | 77.22% | 43.64% | 27.47% | 715.1M | 136 | 5 |
| TrailTrim +120 / DD25 / Cap20 | 77.22% | 43.64% | 27.47% | 715.1M | 136 | 5 |
| TrailTrim +150 / DD25 / Cap20 | 77.22% | 43.64% | 27.47% | 715.1M | 136 | 5 |

The +120% and +150% gates are exact no-ops in the current generated path: daily equity delta is 0.0M and trade reason counts are identical.

The five trailing-profit trims still occur in `007660.KS` and `PLTR`. Raising the gate does not remove any of them, so the actual fired trims were already deep-profit events.

## Retrospective

This closes the profit-gate branch. The current rule is not accidentally trimming modest winners after only doubling; the realized trim path already satisfies a much stricter profit threshold. Keeping the simpler +100% label is acceptable because it is easier to understand, but the effective behavior is closer to "very large winner pulled back materially."

## Next mutation

Do not keep raising the profit gate. The next useful mutation should inspect whether the strategy needs a post-trim redeployment rule, because the edge now appears to come from when trimmed cash is recycled rather than from the trim threshold itself.
