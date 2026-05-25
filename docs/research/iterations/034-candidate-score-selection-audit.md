# 034 Candidate Score Selection Audit

## Idea

Iteration 033 promoted `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5` as the current research candidate. Before mutating the strategy again, this iteration asks a narrower question:

Can we explain what the promoted strategy actually selects at each rebalance date, using only point-in-time fields available on that date?

This iteration does not add a new trading rule. It adds a repeatable selection-audit command and records the first audit output.

## Point-in-time contract

The audit reconstructs the eligible PIT rank board on each rebalance date from committed warehouse reports and prices. It does not inspect future target hits, future returns, or future price paths.

The rank formula is:

```text
candidate_score =
  1.4 * target_upside_at_publication
  + max(current_return, 0)
  - max(target_gap_to_target * 0.25, 0)
```

Meaning:

- `target_upside_at_publication`: the report's known upside at publication,
- `current_return`: the stock's return from publication to the rebalance date,
- `target_gap_to_target`: how far the current price has already exceeded the target, penalized only when positive.

The existing entry shell still applies before ranking:

- quarterly rebalance,
- report age <= 540 days,
- MA stack required,
- no new buy if farther than 20% below the 52-week high,
- Top20 rank exit,
- minimum 60 holding days,
- no sell-down of still-valid winners at rebalance,
- weekly cap trim only when a holding exceeds 45% of equity and is at least +60% above known average cost.

## Buy rule

Buy the top 5 eligible rows by `candidate_score` on the rebalance date, subject to the existing PIT admission gates and portfolio construction rules.

## Sell/rebalance rule

No change from the promoted candidate:

- keep valid winners instead of mechanically selling them back to equal weight,
- sell names that fall outside the persistence/eligibility shell,
- apply retained-winner cap trims only when the weekly monitor is triggered.

## Result

New command:

```powershell
uv run --locked python -m snusmic_pipeline selection-audit --warehouse data/warehouse --sim data/sim --account pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5 --start 2021-01-04 --end 2026-05-22 --recent-rebalances 8 --out docs/research/iterations/034-candidate-score-selection-audit-generated.md
```

Generated audit artifact:

- `docs/research/iterations/034-candidate-score-selection-audit-generated.md`

Audit summary:

| metric | value |
| --- | ---: |
| Rebalance dates audited | 21 |
| Distinct selected symbols | 56 |
| Mean overlap with board-score Top5 | 92.06% |

Most frequent Top-N selections:

| symbol | selected rebalances |
| --- | ---: |
| ANET | 5 |
| PLTR | 4 |
| SBLK | 3 |
| 006260.KS | 3 |
| 007660.KS | 3 |
| 267260.KS | 3 |
| 1211.HK | 3 |
| 218410.KQ | 3 |

Important observation: `candidate_score` is not creating a totally different universe. It has high overlap with the original `board_score` Top5. The edge appears to come from local ordering and allocation changes after the technical admission gates have already filtered the universe.

In plain terms:

- `board_score` mixes report economics and several technical bonuses.
- `candidate_score` keeps the technical gates but ranks the survivors closer to report upside plus already-observed winner behavior.
- That likely avoids double-counting technical strength after the MA/52-week gates already did their job.

## Retrospective

This audit makes the current candidate easier to trust. The strategy is not a black-box leaderboard artifact. Its selection logic is simple enough to explain:

1. Only consider reports still fresh enough to matter.
2. Require observable trend strength at the decision date.
3. Rank by publication upside plus realized strength so far.
4. Penalize names that have already moved far beyond the report target.
5. Hold winners instead of repeatedly cutting them back to equal weight.

The audit also found a data-quality nuisance: some Korean company names in the warehouse artifacts are mojibake in generated Markdown. The symbols and calculations are intact, but the display names should be cleaned in a separate data-quality pass rather than patched with presentation fallbacks.

Decision: keep the current canonical candidate unchanged and preserve this audit as explanation evidence.

## Next mutation

Do not add another score knob yet. The next useful loop should be:

1. Build a miss/opportunity audit: compare selected Top5 versus board-score Top5 differences and quantify which excluded names later mattered.
2. Add a compact per-rebalance selected-holdings view to the report output so future strategy notes can say "what changed" without reading full CSVs.
3. Only after the miss audit, test a constrained mutation such as "candidate_score plus stale-winner decay" if the same over-extended winners repeatedly create drawdown.
