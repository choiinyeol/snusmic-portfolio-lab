# 038 Dual Rank Admission

## Idea

Iteration 037 showed that PLTR was already strong under both candidate and board rankers when the candidate account entered it earlier. A natural mutation is therefore to avoid trusting only one score field and rank each PIT board by the best rank a symbol receives from either `candidate_score` or `board_score`.

This is intentionally conservative:

- no future return input,
- same Top5 basket size,
- same trend gates,
- same Fresh540 report-age cap,
- same run-winners and Profit60 retained-cap construction.

## Point-in-time contract

The new `rank_mode="dual_rank"` sorts each rebalance-date eligible board using only same-day PIT fields.

For each eligible row:

1. rank by `candidate_score`,
2. rank by `board_score`,
3. sort by the better of the two ranks,
4. break ties by candidate rank, board rank, publication date, and symbol.

No future price, target-hit outcome, or next-rebalance return is used.

## Buy rule

The tested account is:

`pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_dualrank_top5`

It buys the Top5 symbols under the dual-rank ordering, after the same admission filters:

- report age <= 540 days,
- MA stack required,
- distance from 52-week high >= -20%,
- valid market price on the decision date.

## Sell/rebalance rule

Unchanged from the current candidate:

- quarterly rebalance,
- retain still-valid winners within the rank-exit band,
- do not mechanically sell winners down to equal weight,
- weekly retained-position cap monitor,
- trim toward 40% only above 45% weight and +60% unrealized profit.

## Result

Generated evidence:

- [038-dual-rank-admission-generated.md](038-dual-rank-admission-generated.md)

Command:

```bash
uv run --locked python -m snusmic_pipeline research-report --sim data/sim --accounts pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_dualrank_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5,benchmark_kodex200,all_weather --baseline pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5 --title "038 Dual Rank Admission" --out docs/research/iterations/038-dual-rank-admission-generated.md
```

| account | MWR | MDD | final equity | verdict |
| --- | ---: | ---: | ---: | --- |
| candidate Top5 | 76.66% | 27.47% | 705.8M | keep |
| dual-rank Top5 | 74.13% | 27.47% | 665.3M | reject |
| board-score Profit60 | 74.13% | 27.47% | 665.3M | reference |
| KODEX200 | 44.62% | 19.90% | 323.7M | benchmark |
| All-Weather | 32.30% | 9.46% | 236.3M | benchmark |

Dual-rank exactly collapses back to the board-score Profit60 result: 74.13% MWR, 665.3M final equity, 129 trades. It trails the candidate-score account by 40.5M final equity and 2.53 percentage points MWR.

## Retrospective

Rejected.

This is useful evidence because it kills a tempting but wrong interpretation of Iteration 037. The PLTR mechanism was not solved by "take whichever ranker likes the stock more." The dual-rank sort gives too much authority back to board-score ordering and loses the candidate-score path edge.

The current best remains:

`pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5`

## Next mutation

Stop blending ranks globally. The next idea should preserve candidate-score ordering and only inspect portfolio-state constraints:

1. why the board-score account missed PLTR despite PLTR being board Top5,
2. whether existing retained positions blocked admission,
3. whether a "shared Top5 must be admitted when cash/slot exists" rule can be expressed without creating Top7-like dilution.

If that is too stateful, the safer next loop is a no-code diagnostic: generate a rebalance-date holdings/target-weight audit for 2024-07-01 and 2024-10-01.
