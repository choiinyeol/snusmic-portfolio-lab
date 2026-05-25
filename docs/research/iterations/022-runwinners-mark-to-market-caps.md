# 022 Run-Winners Mark-to-Market Caps

Date: 2026-05-25
Status: accepted as concentration/risk-adjusted variant; rejected as absolute-return replacement

## Idea

Iteration 021 showed that quarterly-only retained-position caps preserve the run-winners edge but do not truly control concentration. The reason is mechanical: a winner can drift above the cap between quarterly rebalance dates.

This iteration tests mark-to-market cap monitors that use the current book and same-day marks between rebalances:

- weekly monitor: if any retained holding exceeds 45% of equity, trim it toward 40%;
- daily monitor: same threshold and target, checked every trading day;
- Vol50 plus weekly monitor.

## Point-in-time contract

The monitor uses only information available on the decision date:

- current holdings;
- same-day close marks available to the simulator;
- current account equity;
- configured cap and trigger.

It does not use future return, future drawdown, future target-hit outcome, or later report results. The monitor is a portfolio construction rule, not a signal rule.

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

Monitor mutations:

| account | monitor behavior |
| --- | --- |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5` | check weekly; if a holding is above 45% of equity, trim toward 40% |
| `pit_trend_quarterly_fresh540_runwinners_dailycap45_top5` | check daily; if a holding is above 45% of equity, trim toward 40% |
| `pit_trend_quarterly_fresh540_runwinners_vol50_weeklycap45_top5` | combine Vol50 exposure control with the weekly 45% monitor |

This is not equal-weight rebalancing. A winner can remain far above the 20% Top5 target, but it cannot drift unchecked above the configured trigger for long.

## Result

Simulation command:

```bash
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
```

Runtime:

- `run-sim`: 37.27 seconds
- `export-web`: 20.96 seconds

Summary:

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 66.76% | 629.94% | 37.19% | 29.74% | 1.0445 | 1.4963 | 558.5M | 150 |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 73.81% | 794.29% | 41.53% | 29.74% | 1.1082 | 1.6008 | 660.2M | 128 |
| `pit_trend_quarterly_fresh540_runwinners_vol50_top5` | 73.44% | 740.57% | 41.30% | 26.82% | 1.1382 | 1.6899 | 654.6M | 128 |
| `pit_trend_quarterly_fresh540_runwinners_cap40_top5` | 73.33% | 773.82% | 41.24% | 29.74% | 1.1053 | 1.5894 | 652.9M | 130 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5` | 72.22% | 715.21% | 40.55% | 26.93% | 1.1688 | 1.7637 | 636.0M | 133 |
| `pit_trend_quarterly_fresh540_runwinners_dailycap45_top5` | 72.01% | 673.99% | 40.42% | 26.70% | 1.1770 | 1.7739 | 632.9M | 137 |
| `pit_trend_quarterly_fresh540_runwinners_vol50_weeklycap45_top5` | 72.03% | 680.92% | 40.43% | 26.76% | 1.1746 | 1.7700 | 633.1M | 136 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

Mature concentration uses month-end holdings, excluding months before 2022-01 and months with fewer than five holdings:

| account | avg top1 | median top1 | max top1 | avg top3 | median top3 | max top3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 25.43% | 24.50% | 35.90% | 66.93% | 66.46% | 73.21% |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 29.01% | 26.85% | 49.48% | 72.27% | 70.27% | 91.12% |
| `pit_trend_quarterly_fresh540_runwinners_vol50_top5` | 29.00% | 26.93% | 49.47% | 72.27% | 70.29% | 91.12% |
| `pit_trend_quarterly_fresh540_runwinners_cap40_top5` | 29.04% | 26.83% | 49.44% | 72.30% | 70.25% | 91.10% |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5` | 28.64% | 27.05% | 45.56% | 71.71% | 70.28% | 84.88% |
| `pit_trend_quarterly_fresh540_runwinners_dailycap45_top5` | 29.68% | 27.54% | 46.44% | 73.07% | 70.32% | 90.53% |
| `pit_trend_quarterly_fresh540_runwinners_vol50_weeklycap45_top5` | 29.84% | 27.53% | 46.19% | 73.07% | 70.45% | 90.51% |

Trade count:

| account | trades | buys | sells |
| --- | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 128 | 69 | 59 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5` | 133 | 69 | 64 |
| `pit_trend_quarterly_fresh540_runwinners_dailycap45_top5` | 137 | 70 | 67 |
| `pit_trend_quarterly_fresh540_runwinners_vol50_weeklycap45_top5` | 136 | 70 | 66 |

## Retrospective

Accept mark-to-market caps as a real concentration control.

The weekly and daily monitors reduce the observed max single-name month-end weight from roughly 49.5% to roughly 45-46%. The weekly monitor also reduces max top3 concentration from 91.12% to 84.88%, which the quarterly cap failed to do.

Reject them as absolute-return replacements.

The unconstrained run-winners account still has the highest MWR and final equity:

```text
pit_trend_quarterly_fresh540_runwinners_top5
```

But the daily cap monitor becomes the best risk-adjusted variant by Sharpe and Sortino in this experiment:

```text
pit_trend_quarterly_fresh540_runwinners_dailycap45_top5
```

It gives up about 1.80 percentage points of MWR versus the unconstrained run-winners account, but cuts MDD by about 3.04 percentage points and lifts Sharpe/Sortino from 1.1082/1.6008 to 1.1770/1.7739.

Weekly cap is the cleaner practical compromise:

- fewer trades than daily cap;
- lower max top3 concentration than daily cap;
- still much stronger than KODEX200, All-Weather, and Fresh540 equal-weight.

Vol50 plus weekly cap does not add enough versus the plain weekly cap. The two controls overlap too much.

## Verification

Passed:

```bash
uv run --locked pytest tests/sim/test_contracts.py tests/sim/test_accounts.py -q
uv run --locked mypy src/snusmic_pipeline/sim
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
uv run --locked ruff format --check
uv run --locked ruff check
uv run --locked pytest tests/sim -q
pnpm --dir apps/web artifact:check
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
```

Evidence:

- `pytest tests/sim/test_contracts.py tests/sim/test_accounts.py -q`: 24 passed
- `mypy src/snusmic_pipeline/sim`: no issues in 27 source files
- `run-sim`: 37.27 seconds
- `export-web`: 20.96 seconds
- `ruff format --check`: 75 files already formatted
- `ruff check`: all checks passed
- `pytest tests/sim -q`: 79 passed
- `artifact:check`: schema 1.0.0, 202 reports, 87 accounts, 212 price files
- `typecheck`: passed
- `build`: 537 static pages generated

## Next mutation

The next loop should test whether the cap monitor should respond to concentration alone or to concentration plus profit cushion:

1. weekly 50->40 monitor: trim only above 50%, to see if the 45% trigger is too eager;
2. weekly 45->40 monitor only after unrealized return is positive by at least 25%;
3. daily 45->40 monitor with no Vol50, but expose it separately as the risk-adjusted account rather than the absolute-return account;
4. portfolio UI should show max single-name and top3 concentration so the risk is visible even when the unconstrained account remains the absolute-return leader.
