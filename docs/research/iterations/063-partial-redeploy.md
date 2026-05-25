# 063 Partial Redeploy

## Idea

Iteration 062 showed that the 12.5% post-trim cash gate is a strong base-cost leader, but also cost-sensitive. This iteration tests a narrower mutation: when the cash gate fires, redeploy only part of the available trim cash instead of treating all cash as immediately investable.

The hypothesis is deliberately small. If the 12.5% redeploy edge is real, a partial redeploy should preserve most of the upside while reducing overreaction to one trim event. If the edge is parameter luck, the result should wobble under slippage, contribution timing, or partial-size changes.

## Point-in-time contract

All decisions use only information visible on the decision date:

- PIT report board rows available on that date;
- observed holdings, cash, equity, average cost, and holding-period highs;
- price history up to the rebalance or trim date;
- current candidate ranking when a vacancy or redeploy slot exists.

The partial redeploy variants do not use future target-hit labels, later report outcomes, future returns, or future price windows to decide buys, sells, trims, or cash deployment.

## Buy rule

The base branch is:

`pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5`

It keeps:

- quarterly PIT Top5 selection;
- 540-day report freshness;
- board-score retention;
- candidate-score ordering only for new entry slots;
- run-winners retention;
- weekly 45% concentration monitor with +60% profit cushion;
- trailing-profit trim after a doubled holding draws down 25% from its observed holding-period high;
- trim toward 20% account weight;
- same-day redeploy only when observed cash is at least 12.5% of observed equity.

This iteration tests partial redeploy sizes:

| Variant | Change |
| --- | --- |
| Partial25 | Redeploy 25% of available cash after the 12.5% gate fires |
| Partial50 | Redeploy 50% of available cash after the 12.5% gate fires |
| Partial75 | Redeploy 75% of available cash after the 12.5% gate fires |
| Partial75 Slip25/Slip50 | 25/50 bps slippage stress on the Partial75 candidate |
| Partial75 Mid/Last contribution | Monthly contribution timing stress |
| Partial50 Slip25/Slip50 | Secondary friction check for the near-tie Partial50 branch |

## Sell/rebalance rule

The sell and rebalance rule is unchanged from Iteration 062:

- scheduled quarterly rebalance;
- retain valid winners under the board-score retention rule;
- sell invalid or dropped holdings at rebalance;
- apply retained-cap and trailing-profit trims from observed account state only;
- fill normal rebalance vacancies with candidate-score ordering;
- run the post-trim cash gate only after an observed trim creates enough cash.

Partial redeploy changes only the amount of cash committed when that gate has already fired.

## Result

Generated evidence:

- [063-partial-redeploy-results.csv](063-partial-redeploy-results.csv)
- [063-partial-redeploy-deltas.csv](063-partial-redeploy-deltas.csv)
- [063-partial-redeploy-generated.md](063-partial-redeploy-generated.md)
- [063-partial-redeploy-current-generated.md](063-partial-redeploy-current-generated.md)

The full sweep CSVs preserve the temporary research variants. The current reproducible simulation artifact keeps the representative Partial75 account plus the Cap20/CashGate baselines and benchmarks, because `/portfolio/` now intentionally hides or drops overfit-looking branch clutter.

Summary:

| Account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | Final equity | Trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Cap20 baseline | 77.22% | 1001.09% | 43.64% | 27.47% | 1.1956 | 1.8570 | 715.1M | 136 |
| CashGate 12.5 | 78.27% | 1031.39% | 44.30% | 27.47% | 1.2061 | 1.8713 | 732.8M | 138 |
| Partial25 | 78.32% | 1032.93% | 44.33% | 27.47% | 1.2097 | 1.8764 | 733.7M | 140 |
| Partial50 | 78.35% | 1033.81% | 44.35% | 27.47% | 1.2093 | 1.8768 | 734.2M | 138 |
| Partial75 | 78.43% | 1035.90% | 44.40% | 27.47% | 1.2091 | 1.8760 | 735.5M | 140 |
| Partial75 Slip25 | 76.83% | 978.33% | 43.41% | 27.75% | 1.1908 | 1.8455 | 708.7M | 140 |
| Partial75 Slip50 | 75.00% | 903.30% | 42.26% | 27.97% | 1.1698 | 1.8110 | 678.9M | 140 |
| Partial75 Mid contribution | 78.31% | 1042.80% | 43.90% | 28.44% | 1.1988 | 1.8784 | 721.8M | 139 |
| Partial75 Last contribution | 79.25% | 1066.62% | 44.07% | 27.32% | 1.1935 | 1.8811 | 726.5M | 138 |
| All-Weather | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |
| KODEX200 | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| QQQ | 28.15% | 219.27% | 14.61% | 18.56% | 0.6643 | 0.9455 | 212.3M | 65 |

Daily delta versus CashGate 12.5:

| Variant | Final delta | Positive days | Min delta | Max delta |
| --- | ---: | ---: | ---: | ---: |
| Partial25 | +0.9M | 22.18% | -6.1M | +2.2M |
| Partial50 | +1.4M | 22.47% | -3.4M | +2.3M |
| Partial75 | +2.7M | 22.75% | -0.8M | +2.7M |
| Partial75 Slip25 | -24.1M | 5.21% | -24.6M | +0.1M |
| Partial75 Slip50 | -53.9M | 0.00% | -55.0M | -0.0M |
| Partial75 Mid contribution | -11.0M | 24.68% | -12.8M | +0.6M |
| Partial75 Last contribution | -6.4M | 2.43% | -8.5M | +0.6M |

## Retrospective

Partial75 is the new base-cost local leader, but the improvement is small enough to treat as an overfit warning rather than a final promotion.

What held:

- Partial redeploy still uses only observed cash and same-day PIT candidate ordering.
- Partial75 improves final equity by 2.7M KRW over CashGate 12.5 and by 20.4M KRW over Cap20 without increasing MDD.
- All tested partial variants still beat All-Weather, KODEX200, and QQQ by a wide margin in base-cost form.

What warns against overclaiming:

- The Partial75 edge over CashGate 12.5 is only about 0.37% of final equity.
- Positive daily-delta days versus CashGate 12.5 are only 22.75%, so the edge is path-specific rather than broad.
- 25/50 bps slippage variants still trail the simpler Cap20 baseline, confirming the whole redeploy branch remains cost-sensitive.
- Partial75 adds two trades versus CashGate 12.5 and four trades versus Cap20.

Conclusion:

Expose Partial75 as a current research candidate, not as a final strategy. The portfolio page should show only a curated shortlist, and the research ledger should keep the simpler Cap20 and CashGate 12.5 baselines visible so future review can see how much complexity each extra rule buys.

Verification commands:

```powershell
uv run --locked python -m snusmic_pipeline research-report --sim data/sim --accounts pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5,all_weather,benchmark_kodex200,benchmark_qqq --baseline pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5 --title "063 Partial Redeploy Current Artifact Check" --out docs/research/iterations/063-partial-redeploy-current-generated.md
pnpm --dir apps/web artifact:check
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
```

## Next mutation

Do not add another micro-parameter immediately. The next useful loop should audit generalization:

1. Rank the branch candidates by parsimony-adjusted score: final equity improvement per added trade and per added rule.
2. Compare Cap20, CashGate 12.5, and Partial75 on subperiods around the 2023 trim events and the 2025 PLTR redeploy basket.
3. Keep `/portfolio/` curated to representative accounts only, so the product does not imply that every overfit branch is equally investable.
4. Test execution realism before another return-seeking mutation: next-open proxy or one-day delayed redeploy if the data supports it without future reference.
