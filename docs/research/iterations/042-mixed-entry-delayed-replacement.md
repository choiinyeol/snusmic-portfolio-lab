# 042 Mixed Entry Delayed Replacement

## Idea

Iteration 040 proved the current edge is not a new global score formula. The useful mechanism is:

1. retain already-valid winners with `board_score`,
2. open only the remaining slots,
3. fill those new-entry slots with `candidate_score`,
4. let winners run under the Profit60 retained-cap rule.

That leaves one obvious suspicion: maybe the strategy is still too eager when a rebalance sells a name and immediately replaces it. This iteration tests whether a one-rebalance cooling-off delay after a dropped holding improves the result by leaving that vacated slot in cash until the next rebalance.

## Point-in-time contract

The delayed-replacement account uses the same PIT inputs as the canonical mixed-entry Profit60 account:

- report metadata available on or before the decision date,
- daily close-derived technical fields available on or before the decision date,
- current holdings and average cost known from the simulated ledger,
- no target-hit, future return, MFE, expiry return, or post-decision price information.

The delay rule only observes whether a currently held symbol is still retained on the current rebalance date. It does not inspect future replacement performance.

## Buy rule

Base account:

`pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5`

Mutation:

`pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_delay1_top5`

Entry selection still uses `candidate_score`, but if the current rebalance dropped one or more previously held symbols, the account does not immediately fill those vacated slots during the same rebalance.

Example:

- target basket size: 5
- retained holdings after sell filter: 4
- one previous holding dropped
- highest candidate exists

Immediate mixed-entry account buys 1 new name. Delay1 keeps that slot in cash for this rebalance.

## Sell/rebalance rule

Unchanged from the canonical mixed-entry Profit60 account:

- quarterly rebalance,
- max report age 540 calendar days,
- MA stack required,
- 52-week high distance gate at `>= -20%`,
- rank exit threshold 20,
- minimum holding days 60,
- no mechanical sell-down of still-valid retained winners,
- weekly retained-winner cap monitor trims toward 40% only after a holding exceeds 45% of equity and has at least +60% unrealized return.

The only added behavior is one-rebalance replacement delay for newly vacated slots.

## Result

Generated with:

```bash
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline research-report --sim data/sim --accounts pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_delay1_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_mixedentry_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5,benchmark_kodex200,all_weather --baseline pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5 --title "042 Mixed Entry Delayed Replacement" --out docs/research/iterations/042-mixed-entry-delayed-replacement-generated.md
uv run --locked python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
```

| account | MWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Delay1 mixed-entry Profit60 | 51.73% | 28.14% | 17.87% | 1.0056 | 1.5289 | 386.9M | 89 |
| Canonical mixed-entry Profit60 | 76.66% | 43.30% | 27.47% | 1.1847 | 1.8393 | 705.8M | 131 |
| Mixed-entry Profit50 | 76.63% | 43.28% | 27.38% | 1.1931 | 1.8460 | 705.3M | 131 |
| Board-score Profit60 reference | 74.13% | 41.73% | 27.47% | 1.1516 | 1.7640 | 665.3M | 129 |
| KODEX200 | 44.62% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| All-Weather | 32.30% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

Daily delta versus the canonical mixed-entry Profit60 account:

| account | final delta | positive days | min daily delta | max daily delta |
| --- | ---: | ---: | ---: | ---: |
| Delay1 mixed-entry Profit60 | -318.9M | 44.08% | -324.7M | 17.1M |

Trade reason comparison:

| account | rebalance buys | rebalance sells | retained cap trims |
| --- | ---: | ---: | ---: |
| Delay1 mixed-entry Profit60 | 47 | 39 | 3 |
| Canonical mixed-entry Profit60 | 69 | 59 | 3 |

## Retrospective

Rejected.

The delay does what it was designed to do mechanically: it cuts trades from 131 to 89 and lowers MDD from 27.47% to 17.87%. But it destroys the core edge. Final equity drops by 318.9M KRW versus the canonical mixed-entry Profit60 account, and MWR falls from 76.66% to 51.73%.

That is too expensive. The strategy is not suffering from over-eager replacement in the aggregate. Its edge appears to require fast re-entry into the next eligible winner candidate when a slot opens. Leaving the slot in cash suppresses the volatility and drawdown, but it also creates cash drag exactly when the signal set is still strong.

The lesson is narrower:

- do not add blanket replacement delay,
- do not solve churn by staying out of market,
- inspect replacement quality case-by-case instead of delaying every vacancy.

## Next mutation

Run a replacement-event audit before changing the rule again.

The next useful artifact should list each rebalance vacancy and show, using PIT decision fields plus future outcome only for evaluation:

- dropped symbol,
- retained symbols,
- replacement candidate selected by canonical mixed-entry,
- replacement candidate rank/score components on that date,
- next-rebalance return of the replacement,
- opportunity cost versus the best available same-date eligible candidates,
- whether the replacement later became a retained winner.

If a rule is added after that audit, it should be a selective quality gate for replacement candidates, not a blanket delay. For example: fill the vacancy only when the replacement candidate clears a PIT score/technical threshold; otherwise keep cash. This keeps the “avoid bad replacements” idea without suppressing every new-entry slot.
