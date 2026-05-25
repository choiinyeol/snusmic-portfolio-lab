# 016 Entry Age Window

Date: 2026-05-25
Status: rejected as replacement; accepted as boundary evidence

## Idea

Iteration 015 showed that waiting for repeated rank confirmation delays entries too much. The next hypothesis keeps early action but narrows only the new-buy window.

The strategy should be allowed to keep winners under the existing Fresh540 Top20 persistence shell, but it may not need to open brand-new positions in older reports near the end of that 540-day window.

## Point-in-time contract

Only decision-date information is used.

- PIT ranks, report age, technical state, and 52-week-high distance are measured on the rebalance date.
- `entry_max_report_age_days` applies only to new buys.
- Existing holdings can persist up to the normal 540-day report-age boundary and Top20 rank-persistence band.
- Future returns, target outcomes, and post-entry paths are not used for admission.

## Buy rule

Control shell:

- quarterly rebalance
- top 5 PIT trend candidates
- max report age 540 days for the ranked universe
- 20/50/200MA stack required
- within 20% of the 52-week high
- keep holdings while they remain inside the top 20 persistence band
- 60-day minimum holding period

Mutation:

| account | new-buy rule |
| --- | --- |
| `pit_trend_quarterly_fresh540_entry270_top5` | new buys must come from reports <=270 days old |
| `pit_trend_quarterly_fresh540_entry365_top5` | new buys must come from reports <=365 days old |
| `pit_trend_quarterly_fresh540_entry450_top5` | new buys must come from reports <=450 days old |
| `pit_trend_quarterly_fresh540_entry365_vol50_top5` | <=365-day new buys plus the 50% trailing-volatility cap |

## Sell/rebalance rule

Sell and persistence behavior is unchanged:

- rank-persistence exit threshold stays Top20
- existing holdings do not need to remain inside the new-buy age window
- optional vol50 only scales gross exposure after the basket is selected

## Result

Simulation command:

```bash
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
```

Summary:

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 66.76% | 629.94% | 37.19% | 29.74% | 1.0445 | 1.4963 | 558.5M | 150 |
| `pit_trend_quarterly_fresh540_vol50_top5` | 66.45% | 586.21% | 37.00% | 25.95% | 1.0744 | 1.5830 | 554.4M | 150 |
| `pit_trend_quarterly_fresh540_entry270_top5` | 66.05% | 573.80% | 36.76% | 31.32% | 0.9962 | 1.4379 | 549.1M | 134 |
| `pit_trend_quarterly_fresh540_entry365_top5` | 53.68% | 387.98% | 29.29% | 31.46% | 0.8694 | 1.2184 | 406.0M | 139 |
| `pit_trend_quarterly_fresh540_entry450_top5` | 62.59% | 535.22% | 34.65% | 30.16% | 0.9840 | 1.4081 | 505.0M | 143 |
| `pit_trend_quarterly_fresh540_entry365_vol50_top5` | 53.38% | 358.88% | 29.11% | 31.30% | 0.8893 | 1.2741 | 403.0M | 139 |
| `pit_score_top5` | 54.46% | 431.31% | 29.76% | 35.80% | 0.8722 | 1.3412 | 413.9M | 357 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

Closed episodes:

| account | closed episodes | win rate | profit factor | median hold | average hold |
| --- | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 60 | 53.3% | 3.49 | 92 | 124.7 |
| `pit_trend_quarterly_fresh540_vol50_top5` | 60 | 53.3% | 3.48 | 92 | 124.7 |
| `pit_trend_quarterly_fresh540_entry270_top5` | 54 | 42.6% | 2.49 | 92 | 125.0 |
| `pit_trend_quarterly_fresh540_entry365_top5` | 56 | 44.6% | 2.39 | 92 | 125.4 |
| `pit_trend_quarterly_fresh540_entry450_top5` | 55 | 47.3% | 3.30 | 92 | 132.7 |
| `pit_trend_quarterly_fresh540_entry365_vol50_top5` | 56 | 44.6% | 2.39 | 92 | 125.4 |

Average gross exposure:

| account | average | min | max |
| --- | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 92.2% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_vol50_top5` | 91.2% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_entry270_top5` | 92.0% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_entry365_top5` | 92.0% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_entry450_top5` | 92.1% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_entry365_vol50_top5` | 91.0% | 0.0% | 100.0% |

## Retrospective

The new-buy age window is much healthier than rank confirmation because it does not starve exposure. Average gross exposure remains around 92%, so the strategy still deploys capital.

But it does not beat the control:

- Entry270 is close on MWR, 66.05% versus 66.76%, but its MDD worsens to 31.32% and Sharpe/Sortino fall.
- Entry450 is meaningfully weaker than the control and only slightly reduces trade count.
- Entry365 is unexpectedly bad, trailing both Entry270 and Entry450 by a wide margin.
- Entry365 plus vol50 does not rescue the idea; it keeps the weaker stock path and only adds exposure scaling.

The useful lesson is that early admission is important, but the exact age cutoff is not a reliable standalone quality signal. The best rule still appears to be the simpler Fresh540 admission plus rank persistence, optionally with vol50 exposure control.

Current best by absolute MWR remains `pit_trend_quarterly_fresh540_top5`.
Current best risk-adjusted implementation candidate remains `pit_trend_quarterly_fresh540_vol50_top5`.

## Next mutation

Do not replace the Fresh540 control with a hard new-buy age window.

The only entry-age variant worth another look is Entry270, because it kept most of the return while reducing trades from 150 to 134. Test Entry270 with the vol50 cap before abandoning it. If that fails, move away from age gates and test sell discipline around realized trade quality:

- Entry270 + Vol50
- Entry270 + March cycle
- a rank-persistence exit band of Top15 or Top25 around the Fresh540 control
