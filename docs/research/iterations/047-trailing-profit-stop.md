# 047 Trailing Profit Stop

## Idea

Iteration 046 showed that stricter entry gates remove too many useful
replacement buys. This iteration moves the mutation to the sell side: let a
winner run, but sell it if it has already doubled from the account cost basis
and then gives back a large share of its own observed high.

This matches the trend-following premise better than hard entry filtering:
the account can be late, wrong, and noisy on entry, but it should not let a
large winner fully round-trip.

## Point-in-time contract

The stop uses only account state and prices observed up to the current trading
day.

- `trailing_highs[symbol]` is the highest close observed while the account has
  held that symbol.
- `peak_return` is that observed high divided by the account average cost.
- `drawdown_from_peak` is the current close divided by the observed high.

No future return, target-hit, expiry, or later report outcome enters the rule.

## Buy rule

Unchanged from canonical mixed-entry Profit60:

- quarterly rebalance
- report age <= 540 calendar days
- retain existing holdings by `board_score`
- fill new slots by `candidate_score`
- top_n = 5

## Sell/rebalance rule

Base shell is unchanged:

- no equal-weight sell-down for still-valid winners
- weekly retained-winner cap monitor
- trim toward 40% only after 45% weight and +60% unrealized return

Mutation:

- Trail25: after a holding reaches +100% unrealized return, sell all if it
  falls 25% from its observed holding-period high.
- Trail35: same, but allow a 35% drawdown from the observed high.

## Result

Source: `docs/research/iterations/047-trailing-profit-stop-generated.md`.

| account | MWR | final equity | MDD | Sharpe | Sortino | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Trail25 mixed entry | 72.43% | 639.2M | 27.47% | 1.1433 | 1.7705 | 133 |
| Trail35 mixed entry | 75.30% | 683.7M | 27.47% | 1.1701 | 1.8162 | 129 |
| Canonical mixed entry Profit60 | 76.66% | 705.8M | 27.47% | 1.1847 | 1.8393 | 131 |
| KODEX200 | 44.62% | 323.7M | 19.90% | 1.0046 | 1.3062 | 65 |
| All-Weather | 32.30% | 236.3M | 9.46% | 1.1374 | 1.6634 | 186 |

Trail35 is close, but still loses 22.1M KRW versus canonical and does not
improve MDD. Trail25 is more active and loses 66.6M KRW. The stop fired only a
few times, so the main effect is selling some long-term compounding too early
rather than preventing a large portfolio drawdown.

## Retrospective

Rejected as replacement. The strategy is already protected by weekly retained
cap trims. A full-position trailing stop is too blunt: once a name has become a
true compounder, selling all on a drawdown sacrifices more upside than it
saves.

This does not kill profit protection entirely. It suggests the protection must
be partial and position-size-aware, not an all-out exit. The right mutation is
probably a staged trim: keep the core winner, but reduce only the excess
weight after a large observed gain.

## Next mutation

Test staged winner trimming instead of full trailing exits:

- after +100% unrealized return and 25-35% drawdown from holding-period high,
  trim only toward a lower cap instead of selling all;
- compare against the existing weekly 45/40 retained-cap rule;
- keep the rule strictly based on current price, account cost basis, and
  observed holding-period highs.
