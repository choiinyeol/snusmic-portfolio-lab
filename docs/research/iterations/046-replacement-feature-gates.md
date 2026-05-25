# 046 Replacement Feature Gates

## Idea

Iteration 045 found two weak observable replacement-entry buckets:

- trailing 3M return between 0% and 20%
- 10-20% below the 52-week high

This iteration tests each as an isolated new-entry gate under the canonical
mixed-entry Profit60 construction. The goal is to improve replacement quality
without using future returns or target-hit labels.

## Point-in-time contract

Both gates use only the rebalance-date PIT research board.

- `return_3m` is trailing price performance known on the rebalance date.
- `distance_from_52w_high` is computed from price history available on the
  rebalance date.

Existing holdings are still retained by board-score rank and minimum holding
rules. The new gates apply only when filling open slots.

## Buy rule

Base shell:

- quarterly rebalance
- report age <= 540 calendar days
- retain existing holdings by `board_score`
- fill new slots by `candidate_score`
- top_n = 5

Mutations:

- Ret3M20: require `return_3m >= 20%`
- High10: require `distance_from_52w_high >= -10%`

## Sell/rebalance rule

Unchanged from canonical mixed-entry Profit60:

- no equal-weight sell-down for still-valid winners
- weekly retained-winner cap monitor
- trim toward 40% only after 45% weight and +60% unrealized return

## Result

Source: `docs/research/iterations/046-replacement-feature-gates-generated.md`.

| account | MWR | final equity | MDD | Sharpe | Sortino | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Ret3M20 mixed entry | 65.69% | 544.4M | 28.56% | 0.9738 | 1.5114 | 135 |
| High10 mixed entry | 64.36% | 527.2M | 23.83% | 1.0428 | 1.5800 | 123 |
| Canonical mixed entry Profit60 | 76.66% | 705.8M | 27.47% | 1.1847 | 1.8393 | 131 |
| Delay1 mixed entry | 51.73% | 386.9M | 17.87% | 1.0056 | 1.5289 | 89 |
| Confirm10 mixed entry | 55.24% | 422.0M | 33.55% | 0.9148 | 1.1495 | 50 |
| KODEX200 | 44.62% | 323.7M | 19.90% | 1.0046 | 1.3062 | 65 |
| All-Weather | 32.30% | 236.3M | 9.46% | 1.1374 | 1.6634 | 186 |

Ret3M20 loses 161.4M KRW versus canonical and worsens drawdown. High10 cuts
MDD from 27.47% to 23.83%, but gives up 178.6M KRW final equity and trails on
Sharpe/Sortino. Both still beat KODEX200 and All-Weather by MWR, but neither is
a replacement for the canonical account.

## Retrospective

Rejected as replacement. The feature audit found weak-looking buckets, but
turning those buckets into hard gates removes too many useful entries. High10
is a real defensive variant, yet it is too expensive for the current objective:
beat benchmarks by final equity and MWR under the same contribution path.

The broader lesson is becoming clear: this strategy's edge is less about
perfectly filtering new entries and more about getting enough strong names into
the run-winners state machine early. Hard admission gates repeatedly create
cash drag or missed compounding.

## Next mutation

Stop adding hard entry gates. The next useful branch should inspect exit and
profit-taking behavior after a winner has already entered:

- staged trimming above the current 45/40 cap rule,
- drawdown-from-peak exits only for oversized winners,
- or a looser defensive sleeve that activates after portfolio drawdown rather
  than before entry.
