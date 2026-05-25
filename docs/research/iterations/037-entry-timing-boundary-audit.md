# 037 Entry Timing Boundary Audit

## Idea

Iteration 036 showed that `candidate_score` beat the board-score Profit60 reference mostly through path timing, especially PLTR entering one quarter earlier and then staying inside the run-winners construction. The next question is not "which score looks prettier?" but "which first-buy timing changes actually happened, and what did the PIT board say on those dates?"

This iteration adds a deterministic audit for symbols whose first buy date differs between:

- candidate: `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5`
- baseline: `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5`

## Point-in-time contract

The new `entry-timing-audit` command reads generated trades to find first-buy dates, then reconstructs the eligible research board on those dates from committed warehouse data. Candidate rank, board rank, target upside, current return, target gap, report age, 52-week distance, and MA stack are all measured on the entry date.

The `audited entry next return` field is explicitly ex-post evidence for research review. It is not used by either strategy and must not be used as a future input.

## Buy rule

No trading rule changed in this iteration.

The audited candidate still buys quarterly Top5 names selected by `candidate_score` inside the Fresh540, run-winners, weekly-cap45, Profit60 shell.

## Sell/rebalance rule

No sell rule changed.

The audited account still:

- rebalances quarterly,
- lets still-valid winners run instead of forcing equal weight,
- trims retained winners toward 40% only when weight exceeds 45% and unrealized profit is at least +60%,
- keeps the same generated trade ledger already used in Iteration 036.

## Result

Generated evidence:

- [037-entry-timing-boundary-audit-generated.md](037-entry-timing-boundary-audit-generated.md)

Command:

```bash
uv run --locked python -m snusmic_pipeline entry-timing-audit --warehouse data/warehouse --sim data/sim --account pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5 --baseline pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5 --start 2021-01-04 --end 2026-05-22 --out docs/research/iterations/037-entry-timing-boundary-audit-generated.md
```

Key findings:

| finding | value |
| --- | ---: |
| symbols with different first-buy timing | 5 |
| candidate entered earlier | 1 |
| candidate entered later | 1 |
| candidate-only traded symbols | 2 |
| baseline-only traded symbols | 1 |
| candidate first-buy date also board-score Top5 | 3 |

The main useful difference remains PLTR:

| symbol | candidate first buy | baseline first buy | candidate-date candidate rank | candidate-date board rank | next-rebalance return |
| --- | --- | --- | ---: | ---: | ---: |
| PLTR | 2024-07-01 | 2024-10-01 | 4 | 5 | 34.25% |

This is important because PLTR was already board-score Top5 on 2024-07-01. The edge is therefore not a simple "candidate score pulled a rank 6-7 boundary name into Top5" story. It is a portfolio-state story: the candidate account admitted PLTR earlier into the run-winners machinery, while the baseline account only bought it one quarter later.

The cautionary differences are also visible:

- `196170.KQ` entered the candidate account one quarter later and had a negative candidate-entry next return.
- `018290.KS` and `472850.KQ` were candidate-only trades and both had negative audited next-rebalance returns.
- `GRND` was baseline-only and had a small positive audited next-rebalance return.

So the full-account edge is not broad evidence that every candidate-score timing decision is better. It is narrow evidence that earlier admission of the right winner can dominate several smaller bad substitutions once run-winners and cap trims are in place.

## Retrospective

This loop makes the current research candidate more explainable but also less comfortable. The candidate branch wins the account path, but the audit says the mechanism is concentrated in entry timing for a small number of names. The strongest fact is still path-level: PLTR entered earlier, compounded, and then persisted.

The practical lesson is that the next strategy should not add another raw score formula just to chase PLTR. A better mutation is to make the admission rule explicitly aware of "already Top5 by either candidate score or board score, with strong price confirmation" and then test whether that widens entry just enough without turning the account into a noisy Top7 portfolio.

## Next mutation

Test a conservative dual-rank admission rule:

1. Start with the existing candidate-score Top5 as the base basket.
2. Permit a board-score Top5 name into the candidate basket only when it also passes the existing trend gates and does not force out an existing retained winner.
3. Keep Top5 final exposure and the same run-winners/Profit60 construction.
4. Compare against both current candidate-score Top5 and board-score Profit60.

The acceptance bar stays unchanged: improve final equity or MWR without increasing MDD, and preserve the PIT-only contract.
