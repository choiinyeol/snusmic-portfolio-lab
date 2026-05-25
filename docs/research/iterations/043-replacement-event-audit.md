# 043 Replacement Event Audit

## Idea

Iteration 042 rejected a blanket one-rebalance replacement delay. The next question is narrower:

> When the canonical mixed-entry Profit60 account sells one or more holdings and immediately fills the slots, are those replacement buys mostly useful, or are a few weak replacements hiding inside an otherwise good rule?

This iteration adds a deterministic audit command instead of changing the trading rule. The purpose is to inspect replacement events before inventing another parameter.

## Point-in-time contract

The audit reconstructs rebalance-date rank and score fields from the same point-in-time research board used by the account.

Decision-visible columns:

- candidate rank,
- board rank,
- candidate score,
- board score,
- target upside known at publication,
- current return as of the rebalance date,
- target gap as of the rebalance date.

Ex-post review-only columns:

- next-rebalance return,
- best available next-rebalance return,
- selected-minus-best return,
- whether the bought symbol was still held at the next rebalance.

The ex-post columns are explicitly research evidence and are not used by the strategy.

## Buy rule

No trading rule changed.

Audited account:

`pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5`

The command treats a replacement event as a rebalance date where the account has both:

- at least one `rebalance_sell`, and
- at least one new `rebalance_buy`.

## Sell/rebalance rule

Unchanged canonical mixed-entry Profit60:

- quarterly rebalance,
- Fresh540 report window,
- MA stack required,
- 52-week high distance gate at `>= -20%`,
- rank exit threshold 20,
- minimum holding days 60,
- board-score retention,
- candidate-score new-entry ordering,
- weekly retained-winner cap monitor at 45% trigger / 40% target / +60% unrealized cushion.

## Result

Generated with:

```bash
uv run --locked python -m snusmic_pipeline replacement-event-audit --warehouse data/warehouse --sim data/sim --account pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5 --start 2021-01-04 --end 2026-05-22 --out docs/research/iterations/043-replacement-event-audit-generated.md
```

Summary:

| metric | value |
| --- | ---: |
| Replacement buys audited | 61 |
| Mean next-rebalance return | 13.46% |
| Positive next-rebalance replacements | 34 / 61 |
| Held until next rebalance | 61 / 61 |
| Mean selected minus best available | -47.26% |

Best observed replacement events:

| date | replacement | candidate rank | board rank | next return |
| --- | --- | ---: | ---: | ---: |
| 2023-04-03 | `007660.KS` | 4 | 3 | 214.00% |
| 2026-01-02 | `218410.KQ` | 1 | 1 | 168.76% |
| 2025-04-01 | `278470.KS` | 3 | 4 | 118.10% |
| 2026-01-02 | `LITE` | 5 | 2 | 106.23% |
| 2025-04-01 | `211050.KQ` | 2 | 2 | 103.86% |

Worst observed replacement events:

| date | replacement | candidate rank | board rank | next return |
| --- | --- | ---: | ---: | ---: |
| 2024-07-01 | `089890.KQ` | 3 | 4 | -46.81% |
| 2021-10-01 | `194480.KQ` | 1 | 1 | -34.78% |
| 2023-10-02 | `007210.KS` | 5 | 5 | -33.21% |
| 2022-04-01 | `189300.KQ` | 4 | 5 | -31.58% |
| 2021-07-01 | `298020.KQ` | 2 | 1 | -29.48% |

## Retrospective

Accepted as mechanism evidence.

The audit explains why the blanket delay failed. Replacement buys are not mostly bad: the mean next-rebalance return is +13.46%, and several replacement events became the exact winners that the account needed to own quickly. Delaying every vacancy throws away too much upside.

But the replacement board is not clean either. Only 34 of 61 replacement buys were positive by the next rebalance, and several high-ranked replacements still lost 30-47% before the next quarterly checkpoint. The negative examples are not simply low-rank garbage. Some were candidate rank 1 or 2, so a naive rank cutoff would not be enough.

The useful lesson is:

- prompt replacement is necessary,
- rank alone is not sufficient quality control,
- confirmation should be tested as a replacement-quality filter,
- the filter must be light enough not to recreate Iteration 042 cash drag.

## Next mutation

Test a mixed-entry confirmation variant:

- retain existing holdings exactly as canonical mixed-entry Profit60,
- fill new slots with candidate-score ordering,
- require a new-entry symbol to have appeared in the prior rebalance's candidate Top10 before it can be bought.

This uses only historical PIT boards available at the decision date. It is less blunt than leaving every vacancy in cash, but stricter than immediate entry into a one-quarter spike.
