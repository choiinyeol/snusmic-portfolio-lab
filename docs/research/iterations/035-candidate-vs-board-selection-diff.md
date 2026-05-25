# 035 Candidate vs Board Selection Difference Audit

## Idea

Iteration 034 showed that `candidate_score` Top5 overlaps `board_score` Top5 by 92.06%. This iteration inspects the small non-overlap set.

The hypothesis was:

> The promoted candidate-score account beats the board-score Profit60 account because the few symbols it swaps into Top5 perform better after selection.

This is a falsifiable audit, not a new strategy.

## Point-in-time contract

The compared selection sets are created from the same admissible PIT universe on each rebalance date.

- Candidate set: Top5 by `candidate_score`.
- Board set: Top5 by `board_score`.
- Eligibility uses only fields observable on the rebalance date.
- The next-rebalance return is an ex-post audit metric and is not used for selection.

## Buy rule

No new buy rule. The audit compares what the current candidate would include versus what the board-score reference would include on the same rebalance date.

## Sell/rebalance rule

No new sell rule. The audit uses next-rebalance return only as a simple local opportunity-cost lens. It does not model the full run-winners account state, cap trims, retained cost basis, or later path.

## Result

Command:

```powershell
uv run --locked python -m snusmic_pipeline selection-diff-audit --warehouse data/warehouse --account pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5 --start 2021-01-04 --end 2026-05-22 --out docs/research/iterations/035-candidate-vs-board-selection-diff-generated.md
```

Generated audit artifact:

- `docs/research/iterations/035-candidate-vs-board-selection-diff-generated.md`

Summary:

| metric | value |
| --- | ---: |
| Divergent rebalance dates | 5 |
| Candidate-only rows | 5 |
| Board-only rows | 5 |
| Candidate-only mean next-rebalance return | -7.72% |
| Board-only mean next-rebalance return | 18.32% |
| Mean candidate minus board spread on divergent dates | -26.04% |

The non-overlap rows do not support the original hypothesis. On a simple next-rebalance return basis, the board-only names were better.

Examples:

| date | candidate-only | next return | board-only | next return |
| --- | --- | ---: | --- | ---: |
| 2023-07-03 | LS | 8.66% | 363250.KQ | -9.04% |
| 2024-04-01 | 089890.KQ | 3.83% | VRT | 10.59% |
| 2024-07-01 | 194480.KQ | -37.10% | 196170.KQ | 17.84% |
| 2025-01-02 | 018290.KS | -17.57% | GRND | 2.95% |
| 2025-07-01 | RFHIC | 3.57% | 278470.KS | 69.26% |

## Retrospective

This is useful precisely because it is uncomfortable. The candidate-score account is still the stronger full account in Iteration 033, but this audit says the edge is not explained by the immediate next-quarter performance of the few swapped-in symbols.

That means the mechanism is probably path-level:

1. different entry timing changes later retained-winner state,
2. the run-winners rule and cap trims interact with cost basis,
3. final account outperformance can come from when exposure is established and preserved, not just which name has the better next-quarter return,
4. simple local opportunity-cost audits are necessary but insufficient.

Decision: do not create a new score formula from this audit. The evidence argues against overfitting a next-quarter return objective.

## Next mutation

The next loop should inspect exact account-path differences rather than rank-board differences:

1. Compare candidate-score Profit60 versus board-score Profit60 trade-by-trade.
2. Attribute final-equity delta by date bucket and symbol.
3. Identify whether the edge came from earlier entry, later exit, retained-winner sizing, or cap-trim timing.
4. Only then consider a strategy mutation.
