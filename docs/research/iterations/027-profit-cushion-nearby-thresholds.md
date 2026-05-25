# 027 Profit-Cushion Nearby Thresholds

Date: 2026-05-25
Status: accepted as boundary evidence; Profit60 retained as current MWR leader

## Idea

Iteration 026 made retained-winner cap trims auditable as `retained_cap_trim`.
This iteration tests the two nearest untested thresholds around the current Profit60 candidate:

```text
+50% unrealized-profit cushion
+75% unrealized-profit cushion
```

The research question is narrow:

```text
Is +60% a brittle one-off threshold, or does the nearby neighborhood confirm the same rule shape?
```

## Point-in-time contract

The strategy uses only data available on the rebalance or cap-check date:

- PIT report candidates generated from already-published reports;
- known daily close/MA/52-week-high state as of the decision date;
- current account holdings, cash, average cost, and mark-to-market value;
- current unrealized return versus known average cost.

The cap monitor does not inspect future returns, future target hits, future ranks, or future price paths.

## Buy rule

Unchanged from the Profit60 family:

- quarterly rebalance;
- PIT trend candidates;
- max report age 540 days;
- 20/50/200MA stack required;
- within 20% of the 52-week high;
- Top20 persistence band;
- 60-day minimum holding period;
- Top5 target basket;
- equal-weight new buys with available cash;
- retained winners are not mechanically sold down to equal weight.

## Sell/rebalance rule

Unchanged except for the tested profit cushion:

- sell holdings absent from the selected rebalance basket as `rebalance_sell`;
- keep still-valid holdings inside the persistence band;
- buy selected underweight names as `rebalance_buy`;
- weekly mark-to-market retained-winner cap check;
- if a retained holding exceeds 45% of equity and unrealized return exceeds the tested cushion, trim toward 40%;
- record that trim as `retained_cap_trim`.

## Result

Simulation/export:

```bash
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
```

Summary:

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| WeeklyCap45 base | 72.22% | 715.21% | 40.55% | 26.93% | 1.1688 | 1.7637 | 636.0M | 133 |
| Profit25 | 73.15% | 806.49% | 41.12% | 27.21% | 1.1693 | 1.7791 | 650.2M | 130 |
| Profit40 | 73.40% | 844.06% | 41.28% | 27.30% | 1.1651 | 1.7779 | 653.9M | 131 |
| Profit50 | 74.13% | 900.49% | 41.73% | 27.38% | 1.1599 | 1.7702 | 665.3M | 131 |
| Profit60 | 74.13% | 911.35% | 41.73% | 27.47% | 1.1516 | 1.7640 | 665.3M | 129 |
| Profit75 | 73.56% | 787.70% | 41.37% | 29.74% | 1.1068 | 1.5962 | 656.3M | 128 |

Profit50 and Profit60 are essentially tied on MWR/CAGR. Profit60 remains ahead by 14,683 KRW final equity, while Profit50 is slightly better on MDD, Sharpe, and Sortino:

| comparison | final equity delta | MDD delta | Sharpe delta | Sortino delta | trades |
| --- | ---: | ---: | ---: | ---: | ---: |
| Profit50 - Profit60 | -14,683 | -0.09pp | +0.0083 | +0.0062 | +2 |
| Profit60 - WeeklyCap45 base | +29.29M | +0.54pp | -0.0172 | +0.0003 | -4 |

Daily path comparison:

| account | final delta vs base | positive days vs base | final delta vs Profit60 | positive days vs Profit60 |
| --- | ---: | ---: | ---: | ---: |
| Profit25 | +14.19M | 99.64% | -15.10M | 0.21% |
| Profit40 | +17.95M | 99.64% | -11.34M | 0.43% |
| Profit50 | +29.28M | 99.64% | -0.01M | 0.07% |
| Profit75 | +20.36M | 98.72% | -8.93M | 0.07% |

Retained-cap-trim counts:

| account | rebalance buys | rebalance sells | retained cap trims |
| --- | ---: | ---: | ---: |
| WeeklyCap45 base | 69 | 58 | 6 |
| Profit25 | 68 | 58 | 4 |
| Profit40 | 69 | 59 | 3 |
| Profit50 | 69 | 59 | 3 |
| Profit60 | 68 | 58 | 3 |
| Profit75 | 68 | 58 | 2 |

Explicit nearby-threshold trims:

| account | date | symbol | qty | gross | realized PnL |
| --- | --- | --- | ---: | ---: | ---: |
| Profit50 | 2021-02-08 | BILI | 55 | 8.84M | 3.17M |
| Profit50 | 2023-05-22 | 035900.KQ | 55 | 6.27M | 2.56M |
| Profit50 | 2025-08-11 | 278470.KS | 68 | 15.36M | 10.52M |
| Profit60 | 2021-02-15 | BILI | 55 | 9.28M | 3.60M |
| Profit60 | 2023-05-22 | 035900.KQ | 55 | 6.27M | 2.56M |
| Profit60 | 2025-08-11 | 278470.KS | 68 | 15.36M | 10.52M |
| Profit75 | 2023-06-05 | 035900.KQ | 42 | 5.30M | 2.47M |
| Profit75 | 2025-08-11 | 278470.KS | 68 | 15.36M | 10.52M |

## Retrospective

The neighborhood confirms the broad rule shape:

```text
Do not trim winners too early, but do not wait until the cap is purely cosmetic.
```

Profit50 and Profit60 are the useful zone. Both preserve most of the run-winner behavior while removing the worst over-concentration path. Profit60 wins by final equity and TWR, but only by a tiny amount over Profit50. Profit50 is slightly cleaner by risk-adjusted metrics.

Profit75 is too late. It skips the BILI trim entirely, waits longer on JYP, and lets MDD rise back to the unconstrained run-winners level. That makes it a rejected replacement even though the absolute return still beats the WeeklyCap45 base.

The current best should stay:

```text
pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5
```

But the practical implementation note should mention that +50% and +60% are a plateau, not a precise magic number.

## Verification

Passed:

```bash
uv run --locked pytest tests\sim\test_contracts.py tests\sim\test_accounts.py -q
uv run --locked ruff check src\snusmic_pipeline\sim\contracts.py tests\sim\test_contracts.py
uv run --locked mypy src\snusmic_pipeline\sim
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
uv run --locked ruff format --check
uv run --locked ruff check
uv run --locked pytest tests\sim -q
pnpm --dir apps/web artifact:check
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
```

Evidence:

- contract/account tests: 25 passed;
- targeted `ruff check`: all checks passed;
- `mypy src\snusmic_pipeline\sim`: no issues in 27 source files;
- `run-sim`: artifacts written to `data/sim`;
- `export-web`: 260 artifacts written to `data/web`;
- `ruff format --check`: 75 files already formatted;
- `ruff check`: all checks passed;
- `pytest tests\sim -q`: 80 passed;
- initial `artifact:check` correctly failed because the validator had not whitelisted the two new account ids; after adding Profit50/Profit75 to the explicit artifact contract, `artifact:check` passed with schema 1.0.0, 202 reports, 95 accounts, and 212 price files;
- `pnpm --dir apps/web typecheck`: passed;
- `pnpm --dir apps/web build`: passed, 561 static pages generated;
- `summary.csv`: Profit50 and Profit60 tie on rounded MWR/CAGR, Profit60 leads final equity by 14,683 KRW;
- `trades.csv`: Profit50 and Profit60 each have 3 explicit `retained_cap_trim` trades; Profit75 has 2.

## Next mutation

Stop tuning the cushion threshold for now. The next useful branch should test whether the same Profit50/60 plateau survives a more explicit implementation constraint:

1. monthly contribution timing sensitivity;
2. top-N selection 3/5/7 under the Profit60 cap;
3. execution-cost/slippage stress on Profit50 and Profit60 only;
4. a portfolio UI label that presents the cap as a range-like policy, not a magic +60% knob.
