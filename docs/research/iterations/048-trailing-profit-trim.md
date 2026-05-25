# 048 Trailing Profit Trim

## Idea

Iteration 047 rejected full-position trailing exits. They sold winners too
bluntly and gave up compounding. This iteration keeps the same observed-high
signal, but turns it into a partial position-size trim.

The rule is deliberately narrow: if a holding has already doubled from account
cost basis and then falls meaningfully from its own holding-period high, trim
only the excess weight. The core position remains alive.

## Point-in-time contract

The rule uses only data known on the trading day:

- current account holdings and average cost,
- the highest close observed while the account held the symbol,
- current close,
- current account equity.

It does not use future returns, later target-hit status, expiry labels, or
post-hoc outcome buckets.

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

- TrailTrim25: after a holding reaches +100% unrealized return, if it falls
  25% from its observed holding-period high, trim only down toward 30% account
  weight.
- TrailTrim35: same, but with a 35% observed-high drawdown trigger.

## Result

Source: `docs/research/iterations/048-trailing-profit-trim-generated.md`.

| account | MWR | final equity | MDD | Sharpe | Sortino | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| TrailTrim25 mixed entry | 76.74% | 707.2M | 27.47% | 1.1865 | 1.8432 | 135 |
| TrailTrim35 mixed entry | 76.63% | 705.4M | 27.47% | 1.1845 | 1.8388 | 132 |
| Canonical mixed entry Profit60 | 76.66% | 705.8M | 27.47% | 1.1847 | 1.8393 | 131 |
| Trail35 full exit | 75.30% | 683.7M | 27.47% | 1.1701 | 1.8162 | 129 |
| KODEX200 | 44.62% | 323.7M | 19.90% | 1.0046 | 1.3062 | 65 |
| All-Weather | 32.30% | 236.3M | 9.46% | 1.1374 | 1.6634 | 186 |

TrailTrim25 is a small improvement over canonical: +1.4M KRW final equity,
slightly higher MWR, Sharpe, and Sortino, with the same MDD. It uses four
`trailing_profit_trim` fills. TrailTrim35 is effectively neutral and trails by
0.4M KRW.

## Retrospective

Accepted as a narrow improvement, not a major new champion. The result is too
small to over-celebrate, but it confirms the mechanism: protect some excess
winner concentration without killing the winner.

The full trailing exit was wrong because it converted a position-management
problem into an exit problem. The partial trim keeps the strategy's edge:
early enough entry, patient retention, and controlled winner concentration.

## Next mutation

Tune the partial trim shape around TrailTrim25:

- trim cap 25% vs 30% vs 35%,
- +80% vs +100% activation threshold,
- and one stricter drawdown trigger around 20%.

The acceptance bar should be high because the current edge is only +1.4M KRW.
Any extra parameter must improve either final equity materially or MDD without
turning into churn.
