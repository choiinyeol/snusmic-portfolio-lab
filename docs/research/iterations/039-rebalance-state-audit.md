# 039 Rebalance State Audit

## Idea

Iteration 038 showed that a global dual-rank sort does not reproduce the current candidate-score edge. The previous audit still left one unanswered question:

> If PLTR was already board-score Top5 on 2024-07-01, why did only the candidate-score account buy it?

The next diagnostic should inspect the portfolio state at the rebalance dates rather than another score formula. The hypothesis is that retained winners reduce the number of new-entry slots, so the meaningful comparison is not full Top5 versus Top5. It is:

1. held positions that survive the rank/holding-age rule,
2. remaining entry slots,
3. new-entry ordering among admissible PIT rows.

## Implementation

Added a deterministic Markdown audit command:

```bash
uv run --locked python -m snusmic_pipeline rebalance-state-audit \
  --warehouse data/warehouse \
  --sim data/sim \
  --accounts pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5 \
  --dates 2024-07-01,2024-10-01 \
  --start 2021-01-04 \
  --end 2026-05-22 \
  --top-rows 10 \
  --out docs/research/iterations/039-rebalance-state-audit-generated.md
```

The command reconstructs each account immediately before the selected rebalance dates from generated trade/equity ledgers, then rebuilds the same-day PIT board from warehouse reports/prices.

Decision fields are point-in-time. Generated trades are used only as evidence of what the simulator already did.

## Result

Generated report:

- [039-rebalance-state-audit-generated.md](039-rebalance-state-audit-generated.md)

The decisive date is 2024-07-01.

Both accounts entered the rebalance with the same equity, cash, and 5 open positions:

| account | equity before | cash before | open positions |
| --- | ---: | ---: | ---: |
| candidate-score Profit60 | 91.7M | 3.0M | 5 |
| board-score Profit60 | 91.7M | 3.0M | 5 |

Both accounts retained SK Hynix as an existing winner. That retained position consumed one of the five target slots.

So the live decision was not "which Top5 should I own from scratch?" It was "after keeping SK Hynix, which four new names fill the book?"

Candidate-score account:

| symbol | candidate rank | board rank | target? | action |
| --- | ---: | ---: | --- | --- |
| BYD | 1 | 2 | yes | buy |
| HD Hyundai Electric | 2 | 1 | yes | buy |
| Kosses | 3 | 4 | yes | buy |
| PLTR | 4 | 5 | yes | buy |
| LIGACHEM / 196170.KQ | 7 | 3 | no | none |
| SK Hynix | 6 | 6 | retained | hold |

Board-score account:

| symbol | candidate rank | board rank | target? | action |
| --- | ---: | ---: | --- | --- |
| HD Hyundai Electric | 1 | 1 | yes | buy |
| BYD | 2 | 2 | yes | buy |
| LIGACHEM / 196170.KQ | 3 | 3 | yes | buy |
| Kosses | 4 | 4 | yes | buy |
| PLTR | 5 | 5 | no | none |
| SK Hynix | 6 | 6 | retained | hold |

This explains the earlier PLTR entry without contradiction: PLTR was board Top5, but the retained SK Hynix slot made the board-score account's new-entry capacity only four names. Board-score chose 196170.KQ ahead of PLTR. Candidate-score chose PLTR ahead of 196170.KQ.

On 2024-10-01, both accounts targeted the same five symbols. The board-score account bought PLTR then, one quarter later. The candidate account already held PLTR and had higher equity entering the rebalance.

## Review

The mechanism is now more precise:

- The edge is not from adding more names.
- The edge is not from blending candidate and board ranks globally.
- The edge is a stateful interaction between retained-winner slots and new-entry ordering.

The current candidate strategy is effectively:

> keep valid winners first, then fill the remaining slots using `candidate_score`.

That is a coherent PIT rule and remains the current best.

## Next Experiment

The next useful mutation is a mixed-ranker strategy:

- retain/sell existing holdings using the conservative board-score rank,
- fill newly opened slots using candidate-score ordering,
- keep all other Profit60 construction rules unchanged.

This tests whether the edge comes specifically from candidate-score new-entry selection, without letting candidate-score also control retention.

