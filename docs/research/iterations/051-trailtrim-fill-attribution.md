# 051 TrailTrim Fill Attribution

## Idea

Iteration 050 validated TrailTrim25Cap25 at the account level. This iteration
looks inside the five `trailing_profit_trim` fills to see whether the edge is
explainable or just a one-line leaderboard artifact.

## Point-in-time contract

This is an attribution pass, not a new trading rule. It reads only already
generated simulation artifacts:

- `data/sim/trades.csv`
- `data/sim/current_holdings.csv`
- `data/sim/summary.csv`

No selection or trading decision is changed.

## Buy rule

No change from TrailTrim25Cap25:

- quarterly rebalance,
- report age <= 540 calendar days,
- retain existing holdings by `board_score`,
- fill new slots by `candidate_score`,
- top_n = 5.

## Sell/rebalance rule

No change from TrailTrim25Cap25:

- weekly retained-winner cap monitor,
- trim toward 40% only after 45% weight and +60% unrealized return,
- trim doubled winners toward 25% account weight after a 25% drawdown from
  observed holding-period high.

## Result

The five `trailing_profit_trim` fills are concentrated in two winners:

| date | symbol | qty | sale gross | realized pnl |
| --- | --- | ---: | ---: | ---: |
| 2023-08-07 | 007660.KS | 95 | 2.92M | 1.96M |
| 2023-08-28 | 007660.KS | 8 | 0.25M | 0.17M |
| 2025-02-24 | PLTR | 120 | 15.60M | 11.28M |
| 2025-03-21 | PLTR | 2 | 0.27M | 0.19M |
| 2025-03-27 | PLTR | 11 | 1.45M | 1.06M |

Aggregated against the clean mixed-entry Profit60 baseline:

| comparison | delta |
| --- | ---: |
| final equity | +7.38M |
| final holdings value | +7.38M |
| final cash | +0.00M |
| realized PnL | +3.65M |
| unrealized PnL in final holdings | +3.68M |

The final holding-value delta is spread across the later book:

| symbol | extra final value |
| --- | ---: |
| RFHIC | +2.08M |
| TLB | +1.90M |
| Corning | +1.46M |
| Lumentum | +1.42M |
| Tomocube | +0.52M |

The trim account does not win by avoiding a collapse in the trimmed names.
Both paths later sell 007660.KS and PLTR through ordinary rebalance exits. The
trim account simply realizes part of the profit earlier, then enters the next
book with slightly more capital. The final edge is half realized PnL and half
larger surviving positions.

## Retrospective

Accepted as explanation evidence.

This is a useful but fragile-looking edge. PLTR dominates the trim notional, but
the final benefit is not a single PLTR mark-to-market miracle. It is a cash-flow
path effect: the earlier trims modestly improve realized PnL, and the redeployed
capital compounds into RFHIC, TLB, Corning, and Lumentum.

That means the rule is explainable, but it should not be tuned further by adding
more thresholds. The next useful branch should change the product shape:
surface this current leader clearly in `/portfolio`, then consider whether
trim-attribution should become a standard report for any candidate strategy.

## Next mutation

Promote TrailTrim25Cap25 as the displayed research candidate and add a compact
portfolio explanation:

- why Top5 is fixed,
- why partial trims exist,
- what the latest five trim/rebalance events did,
- and which benchmark paths it beats.
