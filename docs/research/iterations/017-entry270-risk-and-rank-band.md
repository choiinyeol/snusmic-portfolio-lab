# 017 Entry270 Risk and Rank Band

Date: 2026-05-25
Status: rejected

## Idea

Iteration 016 left one narrow opening: `entry270` nearly matched the Fresh540 control while reducing trade count. This iteration gives that idea one final risk-adjusted check, then tests whether the Fresh540 control is sensitive to a tighter or looser rank-persistence band.

Hypotheses:

- `entry270 + vol50` might keep the lower trade count while cutting the worse drawdown seen in iteration 016.
- `entry270 + March cycle` might combine a younger-entry gate with the lower-drawdown calendar offset observed in iteration 012.
- Top15 or Top25 persistence might reveal whether the accepted Top20 exit band is materially binding.

## Point-in-time contract

Only decision-date information is used.

- PIT rank, report age, moving-average stack, and 52-week-high distance are measured on the rebalance date.
- `entry_max_report_age_days=270` applies only to new buys.
- Existing holdings can persist under the normal Fresh540 report-age and rank-band rules.
- Volatility targeting uses trailing realized daily returns available before or on the rebalance date.
- Calendar offset changes only the rebalance month schedule.
- Future returns, target outcomes, and post-entry paths are not used for admission or sizing.

## Buy rule

Control shell:

- quarterly rebalance
- top 5 PIT trend candidates
- max report age 540 days for the ranked universe
- 20/50/200MA stack required
- within 20% of the 52-week high
- 60-day minimum holding period

Mutation:

| account | mutation |
| --- | --- |
| `pit_trend_quarterly_fresh540_entry270_vol50_top5` | new buys must be <=270 days old; trailing-volatility cap at 50% annualized |
| `pit_trend_quarterly_fresh540_entry270_mar_top5` | new buys must be <=270 days old; quarterly cycle offset to March/June/September/December |
| `pit_trend_quarterly_fresh540_rank15_top5` | Fresh540 control, but keep holdings only while they remain inside Top15 |
| `pit_trend_quarterly_fresh540_rank25_top5` | Fresh540 control, but keep holdings while they remain inside Top25 |

## Sell/rebalance rule

Sell behavior remains rank-persistence based.

- Base Fresh540 shell exits when a holding leaves the configured rank band after the 60-day minimum hold.
- `entry270` does not force an age-based sale.
- Vol50 only scales gross exposure after the basket is selected.
- No realized outcome, target-hit status, or future drawdown is used for sell decisions.

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
| `pit_trend_quarterly_fresh540_entry270_vol50_top5` | 65.80% | 534.47% | 36.60% | 31.25% | 1.0197 | 1.5056 | 545.8M | 135 |
| `pit_trend_quarterly_fresh540_entry270_mar_top5` | 38.39% | 288.35% | 20.36% | 27.10% | 0.7213 | 1.0561 | 276.3M | 136 |
| `pit_trend_quarterly_fresh540_rank15_top5` | 66.76% | 629.94% | 37.19% | 29.74% | 1.0445 | 1.4963 | 558.5M | 150 |
| `pit_trend_quarterly_fresh540_rank25_top5` | 66.76% | 629.94% | 37.19% | 29.74% | 1.0445 | 1.4963 | 558.5M | 150 |
| `pit_score_top5` | 54.46% | 431.31% | 29.76% | 35.80% | 0.8722 | 1.3412 | 413.9M | 357 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

Closed episodes:

| account | closed episodes | win rate | profit factor | median hold | average hold |
| --- | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 60 | 53.3% | 3.49 | 92 | 124.7 |
| `pit_trend_quarterly_fresh540_vol50_top5` | 60 | 53.3% | 3.48 | 92 | 124.7 |
| `pit_trend_quarterly_fresh540_entry270_top5` | 54 | 42.6% | 2.49 | 92 | 125.0 |
| `pit_trend_quarterly_fresh540_entry270_vol50_top5` | 54 | 42.6% | 2.49 | 92 | 125.0 |
| `pit_trend_quarterly_fresh540_entry270_mar_top5` | 50 | 50.0% | 3.16 | 92 | 146.2 |
| `pit_trend_quarterly_fresh540_rank15_top5` | 60 | 53.3% | 3.49 | 92 | 124.7 |
| `pit_trend_quarterly_fresh540_rank25_top5` | 60 | 53.3% | 3.49 | 92 | 124.7 |

Average gross exposure:

| account | average | min | max |
| --- | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 92.2% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_vol50_top5` | 91.2% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_entry270_top5` | 92.0% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_entry270_vol50_top5` | 91.0% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_entry270_mar_top5` | 94.2% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_rank15_top5` | 92.2% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_rank25_top5` | 92.2% | 0.0% | 100.0% |

## Retrospective

Reject the whole mutation set.

`entry270 + vol50` slightly improves Sharpe and Sortino versus plain Entry270, but it does not solve the real defect. MDD barely moves from 31.32% to 31.25%, while MWR falls from 66.05% to 65.80%. It still trails the simpler `pit_trend_quarterly_fresh540_vol50_top5`, which has better MWR, lower MDD, higher Sharpe, and higher Sortino.

`entry270 + March cycle` is a hard failure. The lower drawdown is bought by giving up too much return: MWR collapses to 38.39%, below KODEX200.

`rank15` and `rank25` are exact no-ops against the Fresh540 control in this sample. The accepted Top20 band is not the current bottleneck. Either holdings that matter are staying well inside Top15, or the widened Top25 band does not keep any additional high-impact winner. This makes further local rank-band tuning low value.

Current best by absolute MWR remains `pit_trend_quarterly_fresh540_top5`.
Current best risk-adjusted implementation candidate remains `pit_trend_quarterly_fresh540_vol50_top5`.

## Next mutation

Stop age-window and rank-band microtuning.

The next high-value direction is portfolio construction, not candidate admission:

- keep the Fresh540 Top5 PIT signal shell
- stop trimming winners back to equal weight every rebalance
- sell only rank-exit / invalid holdings
- deploy new cash and sale proceeds into current top candidates

This tests the trend-following idea more directly: small losers can be cut by rank decay, but large winners should not be mechanically sold down just because they got bigger.
