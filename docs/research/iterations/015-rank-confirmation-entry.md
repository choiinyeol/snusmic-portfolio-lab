# 015 Rank Confirmation Entry

Date: 2026-05-25
Status: rejected

## Idea

Iteration 014 made the exposure/risk-control side good enough for now. This iteration moves back to signal quality.

The hypothesis: a stock that appears in the top PIT rank set for two consecutive quarterly decision dates may be a more durable signal than a one-off top rank entry. If true, repeated rank confirmation should improve realized trade quality enough to compensate for fewer entries.

## Point-in-time contract

Only decision-date information is used.

- The candidate set and ranks come from the PIT research board available on each rebalance date.
- Entry confirmation uses only the current rebalance snapshot and prior rebalance snapshots already observed by the strategy.
- Future target-hit outcomes, future returns, and post-entry price paths are not used for selection.
- Existing holdings can persist under the existing Top20 rank-persistence rule; confirmation gates only new buys.

## Buy rule

Keep the accepted Fresh540 Top5 shell:

- quarterly rebalance
- top 5 PIT trend candidates
- ignore reports older than 540 days at the decision date
- keep holdings while they remain inside the top 20 persistence band

Add a confirmation gate for new entries:

| account | mutation |
| --- | --- |
| `pit_trend_quarterly_fresh540_confirm5_top5` | new buys must be inside the top 5 on two consecutive quarterly decision dates |
| `pit_trend_quarterly_fresh540_confirm10_top5` | new buys must be inside the top 10 on two consecutive quarterly decision dates |
| `pit_trend_quarterly_fresh540_confirm10_vol50_top5` | same top 10 confirmation gate plus the 50% trailing-volatility cap from iteration 014 |

## Sell/rebalance rule

Sell and persistence behavior is unchanged:

- rebalance quarterly
- hold existing names while they remain inside the top 20 persistence band
- respect the 60-day minimum holding period
- size equal weight before the optional volatility cap

Confirmation does not force an existing holding to be sold. It only prevents a new name from entering unless it has also appeared in the confirmation snapshot.

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
| `pit_trend_quarterly_fresh540_confirm5_top5` | 54.50% | 566.94% | 29.78% | 37.80% | 0.8192 | 0.9964 | 414.4M | 32 |
| `pit_trend_quarterly_fresh540_confirm10_top5` | 49.97% | 498.74% | 27.09% | 37.51% | 0.8222 | 0.9804 | 370.2M | 52 |
| `pit_trend_quarterly_fresh540_confirm10_vol50_top5` | 47.76% | 463.13% | 25.79% | 33.42% | 0.8238 | 1.0005 | 350.3M | 52 |
| `pit_score_top5` | 54.46% | 431.31% | 29.76% | 35.80% | 0.8722 | 1.3412 | 413.9M | 357 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

Closed episodes:

| account | closed episodes | win rate | profit factor | median hold | average hold |
| --- | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 60 | 53.3% | 3.49 | 92 | 124.7 |
| `pit_trend_quarterly_fresh540_vol50_top5` | 60 | 53.3% | 3.48 | 92 | 124.7 |
| `pit_trend_quarterly_fresh540_confirm5_top5` | 12 | 58.3% | 8.68 | 92 | 136.8 |
| `pit_trend_quarterly_fresh540_confirm10_top5` | 21 | 57.1% | 4.47 | 92 | 121.9 |
| `pit_trend_quarterly_fresh540_confirm10_vol50_top5` | 21 | 57.1% | 4.36 | 92 | 121.9 |

Average gross exposure:

| account | average | min | max |
| --- | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 92.2% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_vol50_top5` | 91.2% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_confirm5_top5` | 57.3% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_confirm10_top5` | 57.3% | 0.0% | 100.0% |
| `pit_trend_quarterly_fresh540_confirm10_vol50_top5` | 55.7% | 0.0% | 100.0% |

## Retrospective

The confirmation gate is not a better signal-quality filter. It is mostly an entry delay and cash-drag machine.

The confirm5 variant looks good only if viewed through closed-trade profit factor: 8.68 versus 3.49 for the baseline. That is a trap. It cuts trades from 150 to 32, drops average gross exposure from 92.2% to 57.3%, and raises MDD to 37.80%. The strategy is not becoming cleaner; it is failing to deploy capital into the winning trend window.

The confirm10 variants are not meaningfully better. They raise activity to 52 trades, but still sit near 57% average gross exposure and trail the baseline by roughly 17 percentage points of MWR. Adding the vol50 cap lowers MDD from 37.51% to 33.42%, but the final equity falls further to 350.3M.

The edge appears to come from acting early on fresh PIT trend candidates, not from waiting until they have been repeatedly obvious across quarterly snapshots. Confirmation is too slow for this dataset.

Current best by absolute MWR remains `pit_trend_quarterly_fresh540_top5`.
Current best risk-adjusted implementation candidate remains `pit_trend_quarterly_fresh540_vol50_top5`.

## Next mutation

Do not use repeated rank confirmation as an entry gate.

The next signal-quality mutation should preserve early entry but test narrower report-age subwindows:

- allow new buys only when the report is still in an early decision window, such as <=270, <=365, or <=450 days
- keep existing winners under the 540-day/Top20 persistence shell after entry
- optionally combine the best entry-age window with the vol50 risk cap

This tests whether new purchases should be fresh earlier, while still allowing winners to compound after they are already admitted.
