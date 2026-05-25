# 049 Trailing Profit Trim Tuning

## Idea

Iteration 048 showed that a full trailing exit is too blunt, but a partial trim
can improve the canonical mixed-entry Profit60 account. This iteration tunes
only that accepted mechanism.

The question is narrow: once a winner has doubled and then falls from its own
observed holding-period high, should the account trim earlier, trim harder, or
leave more of the position alone?

## Point-in-time contract

The rule uses only decision-date information:

- current account holdings and average cost,
- the highest close observed while the account held the symbol,
- current close,
- current account equity.

It does not read future returns, later target-hit status, post-hoc outcome
labels, or any 3M/1Y/2Y realized result.

## Buy rule

Unchanged from canonical mixed-entry Profit60:

- quarterly rebalance,
- report age <= 540 calendar days,
- retain existing holdings by `board_score`,
- fill new slots by `candidate_score`,
- top_n = 5.

## Sell/rebalance rule

Base shell is unchanged:

- no equal-weight sell-down for still-valid winners,
- weekly retained-winner cap monitor,
- trim toward 40% only after 45% weight and +60% unrealized return.

Mutation set:

- TrailTrim20: +100% unrealized, 20% observed-high drawdown, trim toward 30%.
- TrailTrim25: +100% unrealized, 25% observed-high drawdown, trim toward 30%.
- TrailTrim25Cap25: +100% unrealized, 25% observed-high drawdown, trim toward 25%.
- TrailTrim25Cap35: +100% unrealized, 25% observed-high drawdown, trim toward 35%.
- TrailTrim35: +100% unrealized, 35% observed-high drawdown, trim toward 30%.

## Result

Source: `docs/research/iterations/049-trailing-profit-trim-tuning-generated.md`.

| account | MWR | final equity | MDD | Sharpe | Sortino | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| TrailTrim25Cap25 mixed entry | 77.10% | 713.2M | 27.47% | 1.1925 | 1.8528 | 136 |
| TrailTrim25 mixed entry | 76.74% | 707.2M | 27.47% | 1.1865 | 1.8432 | 135 |
| TrailTrim25Cap35 mixed entry | 76.66% | 705.8M | 27.47% | 1.1847 | 1.8393 | 132 |
| Canonical mixed entry Profit60 | 76.66% | 705.8M | 27.47% | 1.1847 | 1.8393 | 131 |
| TrailTrim35 mixed entry | 76.63% | 705.4M | 27.47% | 1.1845 | 1.8388 | 132 |
| TrailTrim20 mixed entry | 76.44% | 702.2M | 27.47% | 1.1854 | 1.8376 | 138 |
| KODEX200 | 44.62% | 323.7M | 19.90% | 1.0046 | 1.3062 | 65 |
| All-Weather | 32.30% | 236.3M | 9.46% | 1.1374 | 1.6634 | 186 |

TrailTrim25Cap25 improves final equity by +7.4M KRW versus canonical and by
+6.0M KRW versus TrailTrim25. It also improves MWR, Sharpe, and Sortino without
raising MDD. The extra edge comes from only five `trailing_profit_trim` fills,
so the rule remains low-churn.

## Retrospective

Accepted as the new best variant in this branch.

The result says the mechanism is not "sell the winner when it falls." The useful
behavior is more precise: when a doubled winner starts to draw down from its
own observed high, cut only the excess concentration and keep the core. A 20%
drawdown trigger trims too soon. A 35% residual cap barely changes the account.
A 25% residual cap is the only setting that meaningfully improves final equity.

This is still a path-dependent edge. It needs robustness checks before becoming
the implementation default.

## Next mutation

Stress TrailTrim25Cap25 instead of adding another free-form rule:

- 25 bps and 50 bps slippage,
- contribution timing sensitivity,
- Top3/Top7 basket size check,
- and direct attribution of the five `trailing_profit_trim` fills.
