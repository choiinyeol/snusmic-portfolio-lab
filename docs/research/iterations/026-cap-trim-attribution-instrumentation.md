# 026 Cap-Trim Attribution Instrumentation

Date: 2026-05-25
Status: accepted as auditability improvement

## Idea

Iteration 025 accepted Profit60 as mechanism evidence but found a reporting flaw: retained-winner cap trims were recorded as normal `rebalance_sell` trades.

This iteration does not change the strategy decision rule. It changes the trade ledger so that cap-triggered retained-winner trims are visible as a distinct reason:

```text
retained_cap_trim
```

The goal is to make future strategy iterations easier to audit. A strategy that cannot explain why it sold is not research-grade, even if the final equity is high.

## Point-in-time contract

The trading rule is unchanged.

Only the sell reason label changes when all of the following are true on the decision date:

- the holding is already in the account;
- the holding value exceeds the configured trigger weight;
- the holding passes any configured unrealized-profit cushion;
- the account trims the excess toward the configured retained cap.

No future return, future rank, future target-hit outcome, or future price path is used.

## Buy rule

Unchanged from the audited Profit60 family:

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

Unchanged economically:

- sell holdings absent from the selected rebalance basket as `rebalance_sell`;
- keep still-valid holdings inside the persistence band;
- buy selected underweight names as `rebalance_buy`;
- trim retained holdings above the cap trigger as `retained_cap_trim`.

## Result

Simulation/export:

```bash
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
```

Runtime:

- `run-sim`: 39.4 seconds
- `export-web`: 21.7 seconds

Summary stayed unchanged:

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 73.81% | 794.29% | 41.53% | 29.74% | 1.1082 | 1.6008 | 660.2M | 128 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5` | 73.15% | 806.49% | 41.12% | 27.21% | 1.1693 | 1.7791 | 650.2M | 130 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5` | 74.13% | 911.35% | 41.73% | 27.47% | 1.1516 | 1.7640 | 665.3M | 129 |

Trade reason counts:

| account | rebalance buys | rebalance sells | retained cap trims |
| --- | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 69 | 59 | 0 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5` | 68 | 58 | 4 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5` | 68 | 58 | 3 |

Explicit retained-cap trims:

| account | date | symbol | qty | gross | realized PnL |
| --- | --- | --- | ---: | ---: | ---: |
| Profit25 | 2021-01-18 | BILI | 58 | 7.78M | 1.80M |
| Profit25 | 2021-04-26 | 285490.KQ | 49 | 2.36M | 0.53M |
| Profit25 | 2023-04-17 | 035900.KQ | 43 | 3.80M | 0.90M |
| Profit25 | 2025-08-11 | 278470.KS | 66 | 14.91M | 10.21M |
| Profit60 | 2021-02-15 | BILI | 55 | 9.28M | 3.60M |
| Profit60 | 2023-05-22 | 035900.KQ | 55 | 6.27M | 2.56M |
| Profit60 | 2025-08-11 | 278470.KS | 68 | 15.36M | 10.52M |

The key difference is timing, not frequency. Profit60 waits longer before trimming BILI and JYP, and the later trims realize materially more PnL. Both Profit25 and Profit60 trim APR on 2025-08-11, but Profit60 trims a slightly larger quantity.

## Retrospective

This improves the research process more than the strategy itself.

Before this iteration, the ledger could tell that Profit60 changed the path but not which sells were caused by the retained-winner cap. After this iteration, cap trims are directly queryable from `trades.csv`, `position_episodes.csv`, and exported web trade artifacts.

The main lesson:

```text
Do not add another parameter until the current parameter can be audited.
```

Profit60 remains the current MWR candidate. Profit25 remains the best Sortino candidate. The next mutation can now test nearby +50% and +75% profit-cushion thresholds with cleaner attribution.

## Verification

Passed:

```bash
uv run --locked pytest tests\sim\test_accounts.py -q
uv run --locked ruff check src\snusmic_pipeline\sim\contracts.py src\snusmic_pipeline\sim\accounts\pit_score.py tests\sim\test_accounts.py
pnpm --dir apps/web typecheck
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
uv run --locked ruff format --check
uv run --locked ruff check
uv run --locked pytest tests\sim -q
pnpm --dir apps/web artifact:check
```

Evidence:

- `pytest tests\sim\test_accounts.py -q`: 12 passed
- targeted `ruff check`: all checks passed
- `pnpm --dir apps/web typecheck`: passed
- `run-sim`: artifacts written to `data/sim`
- `export-web`: 260 artifacts written to `data/web`
- `ruff format --check`: 75 files already formatted after formatting `tests\sim\test_accounts.py`
- `ruff check`: all checks passed
- `pytest tests\sim -q`: 80 passed
- `artifact:check`: schema 1.0.0, 202 reports, 93 accounts, 212 price files
- `data/sim/trades.csv`: Profit25 has 4 `retained_cap_trim` trades; Profit60 has 3
- `data/web/portfolio/trades.json`: exported the same retained-cap-trim reason counts

## Next mutation

Now test nearby thresholds with the cleaner ledger:

1. add +50% and +75% profit-cushion variants;
2. rerun simulation/export;
3. compare MWR, Sortino, MDD, final equity, and retained-cap-trim count;
4. reject any variant whose edge comes from a single trim or materially worse drawdown;
5. keep Profit60 unless a nearby threshold is both higher return and at least as auditable.
