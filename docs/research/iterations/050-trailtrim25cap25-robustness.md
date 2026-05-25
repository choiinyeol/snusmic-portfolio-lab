# 050 TrailTrim25Cap25 Robustness

## Idea

Iteration 049 promoted TrailTrim25Cap25 as the branch leader. This iteration
does not add a new signal. It checks whether the result survives realistic
implementation stress and the usual Top-N boundary checks.

## Point-in-time contract

All variants keep the same PIT-only rule:

- report board fields available on the rebalance date,
- current account holdings and cost basis,
- observed holding-period high up to the current day,
- current close and current account equity.

No future return, later target-hit state, or post-hoc outcome bucket is used for
selection or exit.

## Buy rule

Base account:

- quarterly rebalance,
- report age <= 540 calendar days,
- retain existing holdings by `board_score`,
- fill new slots by `candidate_score`,
- default basket size top_n = 5.

Robustness variants:

- 25 bps and 50 bps slippage,
- middle-month and month-end contribution timing,
- Top3 and Top7 baskets.

## Sell/rebalance rule

Unchanged TrailTrim25Cap25:

- let still-valid winners run,
- weekly retained-winner cap monitor,
- trim toward 40% only after 45% weight and +60% unrealized return,
- after +100% unrealized return and a 25% drawdown from observed holding-period
  high, trim only down toward 25% account weight.

## Result

Source: `docs/research/iterations/050-trailtrim25cap25-robustness-generated.md`.

| account | MWR | final equity | MDD | Sharpe | Sortino | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| TrailTrim25Cap25 Top5 | 77.10% | 713.2M | 27.47% | 1.1925 | 1.8528 | 136 |
| Slip25 | 75.62% | 689.0M | 27.75% | 1.1756 | 1.8249 | 134 |
| Slip50 | 73.83% | 660.6M | 27.97% | 1.1554 | 1.7921 | 136 |
| Mid-month contribution | 77.12% | 702.2M | 28.44% | 1.1833 | 1.8593 | 135 |
| Month-end contribution | 77.73% | 701.6M | 27.32% | 1.1755 | 1.8584 | 134 |
| Top3 | 64.50% | 529.0M | 29.10% | 0.9718 | 1.5049 | 100 |
| Top7 | 61.29% | 489.4M | 27.33% | 1.0241 | 1.5542 | 169 |
| Canonical mixed entry Profit60 | 76.66% | 705.8M | 27.47% | 1.1847 | 1.8393 | 131 |
| KODEX200 | 44.62% | 323.7M | 19.90% | 1.0046 | 1.3062 | 65 |
| All-Weather | 32.30% | 236.3M | 9.46% | 1.1374 | 1.6634 | 186 |

TrailTrim25Cap25 survives friction. Even with 50 bps slippage it keeps 73.83%
MWR and 660.6M final equity, still far above KODEX200 and All-Weather and close
to the pre-trim Profit60 family.

Contribution timing changes MWR because the cash-flow denominator changes, but
does not create a better final-equity account than first-trading-day
contributions. Top3 is too concentrated and Top7 is too diluted, repeating the
older Top-N finding under the new trim rule.

## Retrospective

Accepted as robustness evidence for TrailTrim25Cap25.

The useful strategy shape is now quite specific:

- Top5 concentration,
- quarterly patience,
- fresh-enough reports,
- board-score retention,
- candidate-score new-entry ordering,
- let winners run,
- cap extreme retained winners,
- and only partially trim doubled winners after an observed-high drawdown.

The trim is not a universal magic parameter. It is attached to the Top5 path and
does not rescue Top3/Top7.

## Next mutation

Inspect the five `trailing_profit_trim` fills directly:

- which symbols were trimmed,
- how much future PnL was preserved or lost,
- whether the +7.4M edge is concentrated in one event,
- and whether any simpler human-readable rule can explain the same behavior.
