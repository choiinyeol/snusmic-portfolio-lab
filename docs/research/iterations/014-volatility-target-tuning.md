# 014 Volatility Target Tuning

Date: 2026-05-25
Status: accepted as risk-adjusted refinement; rejected as absolute-return replacement

## Idea

Iteration 013 found that fixed cash sleeves were crude, while a 45% trailing-volatility cap improved risk-adjusted results with little return sacrifice.

This iteration tunes the volatility target around that result and tests whether the defensive March rebalance cycle benefits from the same 45% cap.

## Point-in-time contract

Only decision-date information is used.

- The candidate set and ranks come from the PIT research board on the rebalance date.
- The Fresh540 report-age filter is measured on the rebalance date.
- The volatility cap uses only trailing basket returns ending on the rebalance date.
- Post-rebalance returns and target-hit outcomes are not used for selection, sizing, or exit.

## Buy rule

Keep the accepted Fresh540 Top5 selection rule unchanged:

- quarterly rebalance
- top 5 PIT trend candidates
- keep holdings while they remain inside the top 20 persistence band
- ignore reports older than 540 days at the decision date
- equal weight before volatility scaling

## Sell/rebalance rule

Same as `pit_trend_quarterly_fresh540_top5`, with these account-level exposure controls:

| account | mutation |
| --- | --- |
| `pit_trend_quarterly_fresh540_vol35_top5` | 35% annualized trailing basket-vol target |
| `pit_trend_quarterly_fresh540_vol40_top5` | 40% annualized trailing basket-vol target |
| `pit_trend_quarterly_fresh540_vol45_top5` | 45% annualized trailing basket-vol target |
| `pit_trend_quarterly_fresh540_vol50_top5` | 50% annualized trailing basket-vol target |
| `pit_trend_quarterly_fresh540_vol55_top5` | 55% annualized trailing basket-vol target |
| `pit_trend_quarterly_fresh540_mar_vol45_top5` | March quarterly cycle plus 45% annualized trailing basket-vol target |

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
| `pit_trend_quarterly_fresh540_vol35_top5` | 64.16% | 530.28% | 35.61% | 25.97% | 1.0937 | 1.6355 | 524.7M | 150 |
| `pit_trend_quarterly_fresh540_vol40_top5` | 64.80% | 537.11% | 36.00% | 25.86% | 1.0827 | 1.6157 | 532.8M | 150 |
| `pit_trend_quarterly_fresh540_vol45_top5` | 65.82% | 567.12% | 36.62% | 25.86% | 1.0799 | 1.6021 | 546.1M | 150 |
| `pit_trend_quarterly_fresh540_vol50_top5` | 66.45% | 586.21% | 37.00% | 25.95% | 1.0744 | 1.5830 | 554.4M | 150 |
| `pit_trend_quarterly_fresh540_vol55_top5` | 66.54% | 598.07% | 37.06% | 26.00% | 1.0672 | 1.5618 | 555.6M | 150 |
| `pit_trend_quarterly_fresh540_mar_top5` | 62.94% | 584.17% | 34.86% | 21.41% | 1.0359 | 1.4981 | 509.4M | 157 |
| `pit_trend_quarterly_fresh540_mar_vol45_top5` | 62.94% | 584.17% | 34.86% | 21.41% | 1.0359 | 1.4981 | 509.4M | 157 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

Closed episodes:

| account | closed episodes | win rate | profit factor | median hold | average hold |
| --- | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 60 | 53.3% | 3.49 | 92 | 124.7 |
| `pit_trend_quarterly_fresh540_vol35_top5` | 60 | 53.3% | 3.51 | 92 | 124.7 |
| `pit_trend_quarterly_fresh540_vol40_top5` | 60 | 53.3% | 3.49 | 92 | 124.7 |
| `pit_trend_quarterly_fresh540_vol45_top5` | 60 | 53.3% | 3.49 | 92 | 124.7 |
| `pit_trend_quarterly_fresh540_vol50_top5` | 60 | 53.3% | 3.48 | 92 | 124.7 |
| `pit_trend_quarterly_fresh540_vol55_top5` | 60 | 53.3% | 3.49 | 92 | 124.7 |
| `pit_trend_quarterly_fresh540_mar_top5` | 62 | 48.4% | 4.60 | 91 | 134.1 |
| `pit_trend_quarterly_fresh540_mar_vol45_top5` | 62 | 48.4% | 4.60 | 91 | 134.1 |

Average gross exposure:

| account | average | min | max |
| --- | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 92.2% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_vol35_top5` | 87.7% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_vol40_top5` | 89.5% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_vol45_top5` | 90.5% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_vol50_top5` | 91.2% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_vol55_top5` | 91.4% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_mar_top5` | 94.1% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_mar_vol45_top5` | 94.1% | 0.0% | 100.0% |

## Retrospective

The volatility cap is useful, but the target should not be too low.

- 35% has the best Sharpe/Sortino, but gives up too much absolute return.
- 40% and 45% improve risk-adjusted numbers, but still leave meaningful final-equity gap versus the baseline.
- 50% keeps almost all of the absolute return while cutting MDD from 29.74% to 25.95%.
- 55% is nearly the baseline with a smaller drawdown, but the risk-adjusted improvement is weaker than 50%.

`pit_trend_quarterly_fresh540_vol50_top5` is the best compromise:

- MWR 66.45% versus 66.76% baseline
- final equity 554.4M versus 558.5M baseline
- MDD 25.95% versus 29.74% baseline
- Sharpe/Sortino 1.0744/1.5830 versus 1.0445/1.4963 baseline

The March cycle plus 45% volatility cap is identical to the plain March cycle in this sample. That means the cap did not bind enough to matter there; the March cycle's lower MDD is coming from rebalance timing, not exposure scaling.

The absolute MWR leader remains `pit_trend_quarterly_fresh540_top5`.
The best risk-adjusted implementation candidate is now `pit_trend_quarterly_fresh540_vol50_top5`.

## Next mutation

Stop tuning the volatility target for now. The next useful mutation is signal quality, not another exposure knob:

- test whether PIT score can be decomposed into "trend quality" and "report freshness" without using outcome labels
- test an entry confirmation that requires the stock to remain in the top rank set for two consecutive decision dates
- keep the accepted Fresh540 quarterly Top5/Top20 persistence shell as the control
