# 023 Cap Trigger Profit Cushion

Date: 2026-05-25
Status: accepted as practical concentration/risk-adjusted variant; rejected as absolute-return replacement

## Idea

Iteration 022 proved that mark-to-market concentration monitors can control drift better than quarterly-only caps. The unresolved question was whether the 45% trigger was too eager.

This iteration tests three mutations:

- weekly 50->40 monitor: trim only when a retained winner exceeds 50% of equity;
- weekly 45->40 monitor with a 25% unrealized-profit cushion;
- daily 45->40 monitor with the same 25% unrealized-profit cushion.

The hypothesis: a profit cushion may avoid cutting a position just because it temporarily became large, while still trimming genuinely extended winners.

## Point-in-time contract

The rule uses only information available on the decision date:

- current holdings;
- same-day close marks available to the simulator;
- current account equity;
- average cost of the held lot;
- configured cap, trigger, monitor cadence, and profit-cushion threshold.

It does not use future return, future drawdown, future target-hit outcome, or later report results. The unrealized-profit cushion is calculated from the lot's own current mark versus its historical average cost already known to the account.

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
| `pit_trend_quarterly_fresh540_runwinners_weeklycap50_top5` | weekly check; if a holding is above 50% of equity, trim toward 40% |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5` | weekly check; if a holding is above 45% of equity and unrealized return is at least +25%, trim toward 40% |
| `pit_trend_quarterly_fresh540_runwinners_dailycap45_profit25_top5` | daily check; if a holding is above 45% of equity and unrealized return is at least +25%, trim toward 40% |

## Result

Simulation command:

```bash
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
```

Runtime:

- `run-sim`: 38.51 seconds
- `export-web`: 21.08 seconds

Summary:

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| `pit_trend_quarterly_fresh540_top5` | 66.76% | 629.94% | 37.19% | 29.74% | 1.0445 | 1.4963 | 558.5M | 150 |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 73.81% | 794.29% | 41.53% | 29.74% | 1.1082 | 1.6008 | 660.2M | 128 |
| `pit_trend_quarterly_fresh540_runwinners_vol50_top5` | 73.44% | 740.57% | 41.30% | 26.82% | 1.1382 | 1.6899 | 654.6M | 128 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5` | 72.22% | 715.21% | 40.55% | 26.93% | 1.1688 | 1.7637 | 636.0M | 133 |
| `pit_trend_quarterly_fresh540_runwinners_dailycap45_top5` | 72.01% | 673.99% | 40.42% | 26.70% | 1.1770 | 1.7739 | 632.9M | 137 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap50_top5` | 72.54% | 732.28% | 40.74% | 26.89% | 1.1681 | 1.7715 | 640.8M | 133 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5` | 73.15% | 806.49% | 41.12% | 27.21% | 1.1693 | 1.7791 | 650.2M | 130 |
| `pit_trend_quarterly_fresh540_runwinners_dailycap45_profit25_top5` | 72.83% | 780.71% | 40.93% | 27.05% | 1.1687 | 1.7787 | 645.3M | 133 |

Mature concentration uses month-end holdings, excluding months before 2022-01 and months with fewer than five holdings:

| account | avg top1 | median top1 | max top1 | avg top3 | median top3 | max top3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_top5` | 25.43% | 24.50% | 35.90% | 66.93% | 66.46% | 73.21% |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 29.01% | 26.85% | 49.48% | 72.27% | 70.27% | 91.12% |
| `pit_trend_quarterly_fresh540_runwinners_vol50_top5` | 29.00% | 26.93% | 49.47% | 72.27% | 70.29% | 91.12% |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5` | 28.64% | 27.05% | 45.56% | 71.71% | 70.28% | 84.88% |
| `pit_trend_quarterly_fresh540_runwinners_dailycap45_top5` | 29.68% | 27.54% | 46.44% | 73.07% | 70.32% | 90.53% |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap50_top5` | 30.04% | 27.56% | 49.41% | 73.12% | 70.38% | 91.07% |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5` | 27.48% | 26.79% | 35.10% | 70.74% | 70.10% | 80.91% |
| `pit_trend_quarterly_fresh540_runwinners_dailycap45_profit25_top5` | 28.94% | 27.24% | 46.47% | 72.35% | 70.29% | 90.57% |

Trade count:

| account | trades | buys | sells |
| --- | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 128 | 69 | 59 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5` | 133 | 69 | 64 |
| `pit_trend_quarterly_fresh540_runwinners_dailycap45_top5` | 137 | 70 | 67 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap50_top5` | 133 | 70 | 63 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5` | 130 | 68 | 62 |
| `pit_trend_quarterly_fresh540_runwinners_dailycap45_profit25_top5` | 133 | 69 | 64 |

## Retrospective

Reject the 50% trigger as too late.

`pit_trend_quarterly_fresh540_runwinners_weeklycap50_top5` recovers a little more return than the 45% weekly monitor, but it leaves concentration close to the unconstrained account:

- max top1: 49.41% versus 49.48% unconstrained;
- max top3: 91.07% versus 91.12% unconstrained.

Accept the weekly 45% trigger with a 25% profit cushion as the best practical concentration/risk-adjusted variant tested so far:

```text
pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5
```

It gives up only 0.66 percentage points of MWR versus the unconstrained run-winners account, but materially improves the concentration profile:

- MWR: 73.15% versus 73.81% unconstrained;
- final equity: 650.2M versus 660.2M unconstrained;
- MDD: 27.21% versus 29.74% unconstrained;
- Sortino: 1.7791, the best among the tested variants;
- max top1: 35.10% versus 49.48% unconstrained;
- max top3: 80.91% versus 91.12% unconstrained;
- trades: 130 versus 128 unconstrained.

The daily profit-cushion version is also viable but less clean: it keeps strong Sortino, but its month-end max top1 and top3 concentration remain much closer to the daily cap variant than to the weekly profit-cushion variant.

The absolute-return leader remains:

```text
pit_trend_quarterly_fresh540_runwinners_top5
```

But the practical implementation candidate is now:

```text
pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5
```

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
- `run-sim`: 38.51 seconds
- `export-web`: 21.08 seconds
- `ruff format --check`: 75 files already formatted
- `ruff check`: all checks passed
- `pytest tests/sim -q`: 80 passed
- `artifact:check`: schema 1.0.0, 202 reports, 90 accounts, 212 price files
- `typecheck`: passed
- `build`: 549 static pages generated

## Next mutation

Tune the profit-cushion threshold around the accepted weekly 45->40 monitor:

1. weekly 45->40 with +10% unrealized cushion;
2. weekly 45->40 with +40% unrealized cushion;
3. weekly 45->40 with +60% unrealized cushion;
4. optional cap target test: trim to 35% or 45% instead of 40%.

The goal is not to maximize cosmetic concentration control. The goal is to find the least intrusive trim rule that preserves the run-winners edge while preventing one position from dominating the account.
