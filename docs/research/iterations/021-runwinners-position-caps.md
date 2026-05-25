# 021 Run-Winners Position Caps

Date: 2026-05-25
Status: rejected as concentration fix; accepted as robustness evidence

## Idea

Iteration 020 showed that the run-winners edge is broad across several winners, but mature single-name weight can still reach roughly 49.5%.

This iteration tests whether a rebalance-time position cap can reduce that concentration without destroying the run-winners edge.

Tested variants:

- hard 40% retained-position cap;
- hard 35% retained-position cap;
- soft cap: sell only when a retained position is above 45%, then trim toward 40%;
- Vol50 plus hard 40% cap.

## Point-in-time contract

The cap uses only information available on the rebalance date:

- current holdings;
- same-day close marks available to the simulator;
- current account equity;
- the PIT-selected basket already produced by the Fresh540 Top5 rule.

No future return, future drawdown, target-hit outcome, or later report result is used for the trading decision.

The cap is evaluated only during the strategy's existing quarterly rebalance step. It is not a daily stop, not a future-aware drawdown rule, and not a replacement for the PIT signal.

## Buy rule

Base shell:

- quarterly rebalance
- PIT trend candidates
- max report age 540 days
- 20/50/200MA stack required
- within 20% of the 52-week high
- Top20 persistence band
- 60-day minimum holding period
- Top5 target basket
- buy underweight selected names with available cash
- retained winners are not sold down to equal weight

## Sell/rebalance rule

Common run-winners rule:

- sell holdings absent from the selected rebalance basket;
- keep still-valid holdings inside the persistence band;
- buy selected underweight names with available cash.

Cap mutations:

| account | cap behavior |
| --- | --- |
| `pit_trend_quarterly_fresh540_runwinners_cap40_top5` | if a retained holding is above 40% of equity on rebalance day, trim it toward 40% |
| `pit_trend_quarterly_fresh540_runwinners_cap35_top5` | if a retained holding is above 35% of equity on rebalance day, trim it toward 35% |
| `pit_trend_quarterly_fresh540_runwinners_soft45_top5` | trim only when a retained holding is above 45%, then target 40% |
| `pit_trend_quarterly_fresh540_runwinners_vol50_cap40_top5` | combine Vol50 exposure control with the 40% cap |

This is intentionally not equal-weight rebalancing. A 40% winner can remain much larger than the 20% equal-weight target.

## Result

Simulation command:

```bash
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
```

Runtime:

- `run-sim`: 36.76 seconds
- `export-web`: 20.86 seconds

Summary:

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 66.76% | 629.94% | 37.19% | 29.74% | 1.0445 | 1.4963 | 558.5M | 150 |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 73.81% | 794.29% | 41.53% | 29.74% | 1.1082 | 1.6008 | 660.2M | 128 |
| `pit_trend_quarterly_fresh540_runwinners_vol50_top5` | 73.44% | 740.57% | 41.30% | 26.82% | 1.1382 | 1.6899 | 654.6M | 128 |
| `pit_trend_quarterly_fresh540_runwinners_cap40_top5` | 73.33% | 773.82% | 41.24% | 29.74% | 1.1053 | 1.5894 | 652.9M | 130 |
| `pit_trend_quarterly_fresh540_runwinners_cap35_top5` | 72.81% | 753.97% | 40.91% | 29.74% | 1.1010 | 1.5801 | 644.9M | 134 |
| `pit_trend_quarterly_fresh540_runwinners_soft45_top5` | 73.33% | 773.82% | 41.24% | 29.74% | 1.1053 | 1.5894 | 652.9M | 130 |
| `pit_trend_quarterly_fresh540_runwinners_vol50_cap40_top5` | 72.96% | 720.92% | 41.00% | 26.82% | 1.1353 | 1.6765 | 647.1M | 130 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

Mature concentration uses month-end holdings, excluding months before 2022-01 and months with fewer than five holdings:

| account | avg top1 | median top1 | max top1 | avg top3 | median top3 | max top3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 25.43% | 24.50% | 35.90% | 66.93% | 66.46% | 73.21% |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 29.01% | 26.85% | 49.48% | 72.27% | 70.27% | 91.12% |
| `pit_trend_quarterly_fresh540_runwinners_vol50_top5` | 29.00% | 26.93% | 49.47% | 72.27% | 70.29% | 91.12% |
| `pit_trend_quarterly_fresh540_runwinners_cap40_top5` | 29.04% | 26.83% | 49.44% | 72.30% | 70.25% | 91.10% |
| `pit_trend_quarterly_fresh540_runwinners_cap35_top5` | 30.07% | 27.98% | 49.28% | 73.29% | 71.79% | 90.97% |
| `pit_trend_quarterly_fresh540_runwinners_soft45_top5` | 29.04% | 26.83% | 49.44% | 72.30% | 70.25% | 91.10% |
| `pit_trend_quarterly_fresh540_runwinners_vol50_cap40_top5` | 29.04% | 26.93% | 49.44% | 72.30% | 70.26% | 91.08% |

## Retrospective

Reject rebalance-time caps as a concentration fix.

They do not materially reduce month-end concentration because the most important concentration event occurs between quarterly rebalances. A quarterly 40% cap can trim a position on rebalance day, but it cannot stop a strong winner from drifting back toward roughly 49% before the next rebalance.

Accept the result as robustness evidence.

The 40% cap and soft45 cap preserve most of the run-winners edge:

- MWR falls only from 73.81% to 73.33%;
- final equity falls from 660.2M to 652.9M;
- trade count rises only from 128 to 130;
- KODEX200 and All-Weather remain far behind.

The 35% cap costs more return and still does not solve the observed month-end concentration path, so it is not a useful replacement.

The best absolute-return strategy remains:

```text
pit_trend_quarterly_fresh540_runwinners_top5
```

The best risk-adjusted implementation candidate remains:

```text
pit_trend_quarterly_fresh540_runwinners_vol50_top5
```

The 40% cap is operationally acceptable if a human wants an explicit rebalance-day trim rule, but it should not be described as a true max-position risk control.

## Verification

Passed:

```bash
uv run --locked ruff format --check
uv run --locked ruff check
uv run --locked mypy src/snusmic_pipeline/sim
uv run --locked pytest tests/sim -q
pnpm --dir apps/web artifact:check
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
```

Evidence:

- `ruff format --check`: 75 files already formatted
- `ruff check`: all checks passed
- `mypy`: no issues in 27 source files
- `pytest tests/sim -q`: 78 passed
- `artifact:check`: schema 1.0.0, 202 reports, 84 accounts, 212 price files
- `build`: 525 static pages generated

## Next mutation

If concentration must be controlled, the next experiment should test a mark-to-market cap monitor instead of a rebalance-only cap:

1. weekly cap monitor: if any retained holding exceeds 45%, trim to 40%;
2. daily cap monitor: same threshold, but checked every trading day;
3. Vol50 plus weekly cap monitor;
4. report max single-name and top3 concentration directly in the portfolio UI so concentration is visible even when not constrained.

The danger is churn. A daily cap can become a disguised take-profit rule and may cut exactly the winners that make the strategy work. The next test should compare trade count, realized PnL distribution, and post-trim opportunity cost, not just headline MWR.
