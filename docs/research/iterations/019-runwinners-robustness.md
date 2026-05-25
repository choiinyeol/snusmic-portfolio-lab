# 019 Run-Winners Robustness

Date: 2026-05-25
Status: accepted as robustness evidence

## Idea

Iteration 018 accepted the first large improvement after Fresh540: keep the same PIT signal shell, but do not sell down still-valid winners to equal weight.

This iteration checks whether that result is fragile.

Stress dimensions:

- concentration: Top3 versus Top5 versus Top7
- rebalance calendar: January cycle versus February and March offsets
- execution friction: 25 bps and 50 bps slippage stress

## Point-in-time contract

Only decision-date information is used.

- PIT rank, report age, moving-average stack, and 52-week-high distance are measured on the rebalance date.
- Existing holdings are kept only if they remain inside the Top20 rank band or are inside the 60-day minimum holding period.
- Retained winners are not sold down to equal weight.
- Calendar offsets only change which months rebalance.
- Fee and slippage stress only changes execution prices and costs.
- Future returns, target outcomes, and later drawdowns are not used.

## Buy rule

Base shell:

- quarterly rebalance
- PIT trend candidates
- max report age 540 days
- 20/50/200MA stack required
- within 20% of the 52-week high
- Top20 persistence band
- 60-day minimum holding period
- no sell-down of retained winners

Mutation:

| account | mutation |
| --- | --- |
| `pit_trend_quarterly_fresh540_runwinners_top3` | Top3 concentration |
| `pit_trend_quarterly_fresh540_runwinners_top7` | Top7 dilution |
| `pit_trend_quarterly_fresh540_runwinners_feb_top5` | February/May/August/November quarterly cycle |
| `pit_trend_quarterly_fresh540_runwinners_mar_top5` | March/June/September/December quarterly cycle |
| `pit_trend_quarterly_fresh540_runwinners_slip25_top5` | 25 bps slippage stress with 5 bps commission and 18 bps sell tax |
| `pit_trend_quarterly_fresh540_runwinners_slip50_top5` | 50 bps slippage stress with 5 bps commission and 18 bps sell tax |

## Sell/rebalance rule

Sell rules:

- sell holdings absent from the selected rebalance basket
- sell explicit stop/technical exits if configured by the strategy shell
- do not sell a retained holding solely to restore equal weight

Buy rules:

- buy only underweight selected names with available cash
- do not use leverage

## Result

Simulation command:

```bash
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
```

Runtime:

- `run-sim`: 35.50 seconds
- `export-web`: 20.21 seconds

Summary:

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 66.76% | 629.94% | 37.19% | 29.74% | 1.0445 | 1.4963 | 558.5M | 150 |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 73.81% | 794.29% | 41.53% | 29.74% | 1.1082 | 1.6008 | 660.2M | 128 |
| `pit_trend_quarterly_fresh540_runwinners_vol50_top5` | 73.44% | 740.57% | 41.30% | 26.82% | 1.1382 | 1.6899 | 654.6M | 128 |
| `pit_trend_quarterly_fresh540_runwinners_top3` | 57.90% | 431.20% | 31.82% | 29.74% | 0.8725 | 1.3171 | 450.6M | 89 |
| `pit_trend_quarterly_fresh540_runwinners_top7` | 63.33% | 556.05% | 35.10% | 29.74% | 1.0092 | 1.4279 | 514.2M | 163 |
| `pit_trend_quarterly_fresh540_runwinners_feb_top5` | 49.01% | 228.70% | 26.53% | 23.45% | 0.8365 | 1.1936 | 361.5M | 143 |
| `pit_trend_quarterly_fresh540_runwinners_mar_top5` | 58.97% | 527.46% | 32.46% | 22.04% | 0.9717 | 1.4231 | 462.5M | 137 |
| `pit_trend_quarterly_fresh540_runwinners_slip25_top5` | 72.20% | 739.11% | 40.54% | 29.78% | 1.0904 | 1.5751 | 635.8M | 128 |
| `pit_trend_quarterly_fresh540_runwinners_slip50_top5` | 70.58% | 682.09% | 39.53% | 29.57% | 1.0727 | 1.5510 | 611.8M | 128 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

Closed episodes:

| account | closed episodes | win rate | profit factor | median hold | average hold |
| --- | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 59 | 54.2% | 4.92 | 92 | 123.7 |
| `pit_trend_quarterly_fresh540_runwinners_vol50_top5` | 59 | 54.2% | 4.92 | 92 | 123.7 |
| `pit_trend_quarterly_fresh540_runwinners_top3` | 40 | 47.5% | 2.45 | 92 | 123.3 |
| `pit_trend_quarterly_fresh540_runwinners_top7` | 74 | 51.4% | 3.20 | 92 | 120.8 |
| `pit_trend_quarterly_fresh540_runwinners_feb_top5` | 62 | 48.4% | 4.10 | 92 | 128.0 |
| `pit_trend_quarterly_fresh540_runwinners_mar_top5` | 61 | 50.8% | 4.35 | 91 | 134.8 |
| `pit_trend_quarterly_fresh540_runwinners_slip25_top5` | 59 | 50.8% | 4.70 | 92 | 123.7 |
| `pit_trend_quarterly_fresh540_runwinners_slip50_top5` | 59 | 50.8% | 4.46 | 92 | 123.7 |

Average gross exposure:

| account | average | min | max |
| --- | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 92.1% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_runwinners_vol50_top5` | 91.2% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_runwinners_top3` | 92.1% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_runwinners_top7` | 92.0% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_runwinners_feb_top5` | 94.4% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_runwinners_mar_top5` | 94.1% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_runwinners_slip25_top5` | 92.1% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_runwinners_slip50_top5` | 92.1% | 0.0% | 100.0% |

## Retrospective

Accept as robustness evidence, not as a replacement for the Top5 January-cycle run-winners rule.

Top5 remains the right concentration. Top3 is too narrow and cuts the edge sharply. Top7 dilutes the portfolio and adds churn without improving risk. This repeats the earlier non-run-winners lesson: the useful signal is concentrated, but not so concentrated that three names are enough.

Calendar offsets lower drawdown but give up too much return. The March cycle still has a defensive profile with 22.04% MDD, but its MWR is only 58.97%. The January cycle remains the main implementation candidate.

The important result is cost robustness. Even with 50 bps slippage plus 5 bps commission and 18 bps sell tax, the strategy keeps 70.58% MWR and 611.8M final equity. That still beats:

- KODEX200: 44.62% MWR, 323.7M final equity
- All-Weather: 32.30% MWR, 236.3M final equity
- Fresh540 equal-weight control: 66.76% MWR, 558.5M final equity

Current best by absolute MWR remains `pit_trend_quarterly_fresh540_runwinners_top5`.
Current best risk-adjusted implementation candidate remains `pit_trend_quarterly_fresh540_runwinners_vol50_top5`.

## Next mutation

The construction edge is now plausible enough to inspect mechanism rather than add filters.

Next loop:

- attribution of which winners were trimmed by equal-weight control but preserved by run-winners
- concentration path through time: max single-name weight, top3 weight, and drawdown contribution
- compare realized trade PnL distribution between equal-weight and run-winners

If the edge comes from a small number of extremely concentrated names, the strategy needs a max-position cap. If the edge is broad across multiple winners, preserve the current construction and test live-operational constraints next.
