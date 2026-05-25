# 044 Mixed Entry Confirmation

## Idea

Iteration 043 showed that replacement buys are useful on average, but the weak
tail is noisy. A blanket one-rebalance delay was too blunt. This iteration tests
a lighter point-in-time quality gate: fill a newly opened slot only if the
candidate was already visible in the prior rebalance's candidate-score board.

Two strictness levels are tested:

- Confirm5: the new entry must appear in the current and prior Top5 candidate board.
- Confirm10: the new entry must appear in the current and prior Top10 candidate board.

## Point-in-time contract

The confirmation set is built only from board snapshots available on each
rebalance date. No future returns, target-hit labels, or later price paths are
used for admission. Existing holdings are retained by the same board-score
retention rule as the canonical mixed-entry account; the confirmation gate only
applies to new slots.

## Buy rule

Base shell:

- quarterly rebalance
- report age <= 540 calendar days
- technical admission gates unchanged
- retain existing holdings by `board_score`
- fill new slots by `candidate_score`
- top_n = 5

Mutation:

- Confirm5: new entries require two consecutive Top5 candidate-score snapshots.
- Confirm10: new entries require two consecutive Top10 candidate-score snapshots.

## Sell/rebalance rule

Unchanged from canonical mixed-entry Profit60:

- keep valid existing holdings inside the rank-exit band
- no equal-weight sell-down during ordinary rebalance
- weekly mark-to-market cap monitor trims toward 40% only after 45% weight and
  at least +60% unrealized return

## Result

Source: `docs/research/iterations/044-mixed-entry-confirmation-generated.md`.

| account | MWR | final equity | MDD | Sharpe | Sortino | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Confirm5 mixed entry | 45.56% | 331.4M | 34.56% | 0.7764 | 0.9402 | 35 |
| Confirm10 mixed entry | 55.24% | 422.0M | 33.55% | 0.9148 | 1.1495 | 50 |
| Canonical mixed entry Profit60 | 76.66% | 705.8M | 27.47% | 1.1847 | 1.8393 | 131 |
| Delay1 mixed entry | 51.73% | 386.9M | 17.87% | 1.0056 | 1.5289 | 89 |
| KODEX200 | 44.62% | 323.7M | 19.90% | 1.0046 | 1.3062 | 65 |
| All-Weather | 32.30% | 236.3M | 9.46% | 1.1374 | 1.6634 | 186 |

Confirm10 still beats KODEX200 and All-Weather by MWR, but it trails the
canonical mixed-entry account by 283.8M final equity. Confirm5 barely clears
KODEX200 and has worse drawdown than the control, so it is not useful.

## Retrospective

Rejected. Prior-board confirmation is another form of entry starvation. It
filters too many replacement buys and delays exactly the early-winner entries
that the mixed-entry account needs. The useful mechanism is prompt vacancy
filling, not repeated-rank persistence.

The important distinction from Iteration 042 is that Confirm10 is less bad than
blanket delay by return, but still not close enough to be a replacement. The
drawdown also worsens versus canonical mixed-entry, so the confirmation gate
does not buy a better risk profile.

## Next mutation

Stop gating replacement by prior rank persistence. The next useful branch should
audit the weak replacement tail by observable entry-date features such as
distance from 52-week high, report age, short-term return, and candidate-score
components, then only test a gate if a pre-trade feature bucket has a clear
failure pattern.
