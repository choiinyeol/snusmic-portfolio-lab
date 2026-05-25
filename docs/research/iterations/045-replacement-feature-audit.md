# 045 Replacement Feature Audit

## Idea

Iteration 044 rejected repeated-rank confirmation. Before adding another gate,
audit the weak replacement tail by features visible on the rebalance date. The
goal is to identify whether failed replacement buys share a point-in-time
signature that can be tested without future leakage.

## Point-in-time contract

Bucket labels use only rebalance-date fields from the PIT research board:

- candidate rank and board rank
- report age
- 3M/6M trailing return
- distance from 52-week high
- current return since report
- remaining gap to the report target

The next-rebalance return and selected-minus-best values are ex-post review
evidence only and are not used as trading inputs.

## Buy rule

No trading rule changes in this iteration. The audited account is the canonical
mixed-entry Profit60 account:

`pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5`

## Sell/rebalance rule

Unchanged. The audit only examines same-rebalance `rebalance_sell` plus new
`rebalance_buy` replacement events.

## Result

Source: `docs/research/iterations/045-replacement-feature-audit-generated.md`.

Replacement buys audited: 61. Mean next-rebalance return: +13.46%.

Notable buckets:

| feature bucket | count | positive | mean next return | comment |
| --- | ---: | ---: | ---: | --- |
| candidate rank 1-2 | 27 | 13/27 | +9.11% | rank alone is not enough |
| candidate rank 3-5 | 34 | 21/34 | +16.91% | lower rank was not worse |
| 3M return 0-20% | 13 | 5/13 | -0.76% | weakest visible bucket |
| 3M return 20-50% | 25 | 16/25 | +23.35% | strongest broad bucket |
| 52W high 10-20% below | 12 | 5/12 | +1.49% | weak near-admission edge |
| 52W high 5-10% below | 17 | 10/17 | +17.96% | healthier |
| within 5% of 52W high | 32 | 19/32 | +15.56% | still healthy |
| current return <0% | 4 | 2/4 | +0.92% | too small, but weak |
| target gap <=0% | 46 | 25/46 | +7.90% | already-over-target names still work, but weaker |
| target gap 25-100% | 6 | 3/6 | +62.33% | strong but too small to trust alone |

The worst rows are not explained by one clean rank bucket. Several failed
replacement buys were rank 1-2, confirming Iteration 043's warning.

## Retrospective

Accepted as mechanism evidence. The useful next mutation is not prior-rank
confirmation. Two observable weak zones are more plausible:

1. new entries with only 0-20% trailing 3M return,
2. new entries sitting 10-20% below their 52-week high.

Both are pre-trade technical fields. They can be tested as stricter new-entry
gates while preserving board-score retention and the Profit60 run-winners
construction. The audit does not prove either gate will help; it only justifies
testing them.

## Next mutation

Test two mixed-entry variants:

- require new entries to have `return_3m >= 20%`
- require new entries to be within 10% of the 52-week high

Do not combine them first. Test each alone against canonical mixed-entry
Profit60, then only combine if one improves risk or final equity without obvious
cash drag.
