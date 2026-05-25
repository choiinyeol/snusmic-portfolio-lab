# 024 Profit Cushion Thresholds

Date: 2026-05-25
Status: accepted as new candidate; requires attribution follow-up

## Idea

Iteration 023 found that a weekly 45->40 retained-winner cap with a +25% unrealized-profit cushion was the best practical concentration/risk-adjusted variant.

This iteration tests whether +25% was a lucky threshold or part of a stable profit-cushion family:

- weekly 45->40 with +10% unrealized-profit cushion;
- weekly 45->40 with +25% unrealized-profit cushion;
- weekly 45->40 with +40% unrealized-profit cushion;
- weekly 45->40 with +60% unrealized-profit cushion.

## Point-in-time contract

The rule uses only decision-date information:

- current holdings;
- same-day close marks available to the simulator;
- current account equity;
- each lot's known average cost;
- configured cap, trigger, monitor cadence, and profit-cushion threshold.

The rule does not use future return, future target-hit outcome, later drawdown, later ranking, or later report data. The profit cushion is a current unrealized return test.

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

Common rule:

- sell holdings absent from the selected rebalance basket;
- keep still-valid holdings inside the persistence band;
- buy selected underweight names with available cash.

Cap mutation:

- monitor retained holdings weekly;
- if a holding exceeds 45% of account equity and passes the configured unrealized-profit cushion, trim it toward 40%;
- if the holding is large but does not pass the profit cushion, do not trim it.

## Result

Simulation command:

```bash
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
```

Runtime:

- `run-sim`: 39.39 seconds
- `export-web`: 21.53 seconds

Summary:

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 73.81% | 794.29% | 41.53% | 29.74% | 1.1082 | 1.6008 | 660.2M | 128 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5` | 72.22% | 715.21% | 40.55% | 26.93% | 1.1688 | 1.7637 | 636.0M | 133 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap50_top5` | 72.54% | 732.28% | 40.74% | 26.89% | 1.1681 | 1.7715 | 640.8M | 133 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit10_top5` | 72.57% | 743.67% | 40.77% | 26.97% | 1.1688 | 1.7705 | 641.3M | 134 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5` | 73.15% | 806.49% | 41.12% | 27.21% | 1.1693 | 1.7791 | 650.2M | 130 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit40_top5` | 73.40% | 844.06% | 41.28% | 27.30% | 1.1651 | 1.7779 | 653.9M | 131 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5` | 74.13% | 911.35% | 41.73% | 27.47% | 1.1516 | 1.7640 | 665.3M | 129 |
| `pit_trend_quarterly_fresh540_runwinners_dailycap45_profit25_top5` | 72.83% | 780.71% | 40.93% | 27.05% | 1.1687 | 1.7787 | 645.3M | 133 |

Mature concentration uses month-end holdings, excluding months before 2022-01 and months with fewer than five holdings:

| account | months | avg top1 | median top1 | max top1 | avg top3 | median top3 | max top3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 35 | 29.01% | 26.85% | 49.48% | 72.27% | 70.27% | 91.13% |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5` | 35 | 28.64% | 27.05% | 45.56% | 71.71% | 70.28% | 84.88% |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap50_top5` | 38 | 30.04% | 27.56% | 49.41% | 73.12% | 70.38% | 91.07% |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit10_top5` | 38 | 29.94% | 27.68% | 46.22% | 73.18% | 70.62% | 90.53% |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5` | 32 | 27.48% | 26.79% | 35.10% | 70.74% | 70.10% | 80.91% |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit40_top5` | 35 | 28.95% | 27.04% | 46.17% | 72.39% | 70.24% | 90.54% |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5` | 32 | 27.50% | 27.16% | 34.59% | 70.76% | 70.06% | 80.90% |
| `pit_trend_quarterly_fresh540_runwinners_dailycap45_profit25_top5` | 35 | 28.94% | 27.24% | 46.47% | 72.35% | 70.29% | 90.57% |

Trade count:

| account | trades | buys | sells |
| --- | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 128 | 69 | 59 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit10_top5` | 134 | 70 | 64 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5` | 130 | 68 | 62 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit40_top5` | 131 | 69 | 62 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5` | 129 | 68 | 61 |
| `pit_trend_quarterly_fresh540_runwinners_dailycap45_profit25_top5` | 133 | 69 | 64 |

## Retrospective

The profit-cushion family is real. It is not a one-point accident around +25%.

The +10% cushion behaves close to the plain weekly cap and does not justify itself. It trims too early and gives up return without giving the clean concentration profile of +25% or +60%.

The +25% and +40% thresholds are strong risk-adjusted variants, with Sortino near 1.78 and MWR above 73%.

The surprise result is +60%:

```text
pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5
```

It becomes the new PIT-only MWR leader in this run:

- MWR: 74.13% versus 73.81% for unconstrained run-winners;
- final equity: 665.3M versus 660.2M;
- MDD: 27.47% versus 29.74%;
- trades: 129 versus 128;
- Sortino: 1.7640, below +25% but still materially above the unconstrained account's 1.6008.

This is plausible: the monitor waits until a retained winner is both large and meaningfully profitable, so it avoids unnecessary trims but still harvests enough excess concentration to fund later opportunities.

However, this result needs an attribution pass before declaring victory. The concentration table is not perfectly monotonic across thresholds and excludes months with fewer than five holdings, so the next iteration should inspect which trades changed, which winners were harvested, and whether +60% is driven by one path-dependent lucky trim.

## Verification

Passed:

```bash
uv run --locked pytest tests/sim/test_contracts.py tests/sim/test_accounts.py -q
uv run --locked mypy src/snusmic_pipeline/sim
uv run --locked ruff check src/snusmic_pipeline/sim tests/sim/test_accounts.py tests/sim/test_contracts.py
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

- `pytest tests/sim/test_contracts.py tests/sim/test_accounts.py -q`: 25 passed
- `mypy src/snusmic_pipeline/sim`: no issues in 27 source files
- `ruff check src/snusmic_pipeline/sim tests/sim/test_accounts.py tests/sim/test_contracts.py`: all checks passed
- `run-sim`: 39.39 seconds
- `export-web`: 21.53 seconds
- `ruff format --check`: 75 files already formatted
- `ruff check`: all checks passed
- `pytest tests/sim -q`: 80 passed
- `artifact:check`: schema 1.0.0, 202 reports, 93 accounts, 212 price files
- `typecheck`: passed
- `build`: 561 static pages generated

## Next mutation

Run an attribution audit for the new +60% candidate:

1. compare trade diffs versus unconstrained run-winners and +25%;
2. identify which symbols caused the return improvement;
3. compare monthly top1/top3 concentration without excluding months with fewer than five holdings;
4. test nearby thresholds +50% and +75% only if attribution says +60% is not a single lucky path.
