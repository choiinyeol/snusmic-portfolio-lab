# 029 Profit50/60 Friction Stress

Date: 2026-05-25
Status: accepted as robustness evidence; Profit60 retained

## Idea

Iterations 027 and 028 established that:

- Profit50/Profit60 form the useful cap-cushion plateau;
- Top5 is the right basket size inside that shell.

This iteration checks whether the plateau survives harsher execution friction. The stress uses:

```text
commission 5 bps
sell tax 18 bps
slippage 25 bps or 50 bps
```

This is intentionally harsher than the default fee model. The goal is not to model exact broker execution; it is to see whether the edge disappears when fills are worse.

## Point-in-time contract

The strategy logic is unchanged and remains PIT-only.

The stress changes only the execution-cost model:

- buy fills are marked up by slippage;
- sell fills are marked down by slippage;
- commission/tax are applied at fill time;
- no future return, future rank, future target hit, or future drawdown is inspected.

## Buy rule

Shared Profit50/60 shell:

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

Shared shell:

- sell holdings absent from the selected rebalance basket as `rebalance_sell`;
- keep still-valid holdings inside the persistence band;
- weekly mark-to-market retained-winner cap check;
- if a retained holding exceeds 45% of equity and unrealized return exceeds the configured cushion, trim toward 40%;
- record that trim as `retained_cap_trim`.

Variant:

| account | profit cushion | stress |
| --- | ---: | --- |
| Profit50 | +50% | default |
| Profit50 Slip25 | +50% | 5 bps commission, 18 bps sell tax, 25 bps slippage |
| Profit50 Slip50 | +50% | 5 bps commission, 18 bps sell tax, 50 bps slippage |
| Profit60 | +60% | default |
| Profit60 Slip25 | +60% | 5 bps commission, 18 bps sell tax, 25 bps slippage |
| Profit60 Slip50 | +60% | 5 bps commission, 18 bps sell tax, 50 bps slippage |

## Result

Summary:

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Profit50 | 74.13% | 900.49% | 41.73% | 27.38% | 1.1599 | 1.7702 | 665.3M | 131 |
| Profit60 | 74.13% | 911.35% | 41.73% | 27.47% | 1.1516 | 1.7640 | 665.3M | 129 |
| Profit50 Slip25 | 72.46% | 834.99% | 40.69% | 27.64% | 1.1398 | 1.7388 | 639.6M | 131 |
| Profit60 Slip25 | 72.69% | 862.80% | 40.83% | 27.75% | 1.1351 | 1.7376 | 643.0M | 131 |
| Profit50 Slip50 | 70.80% | 771.40% | 39.67% | 27.88% | 1.1203 | 1.7080 | 614.9M | 131 |
| Profit60 Slip50 | 71.00% | 798.71% | 39.79% | 27.97% | 1.1160 | 1.7081 | 617.8M | 131 |

Benchmark anchors:

| account | MWR | final equity | MDD | Sortino |
| --- | ---: | ---: | ---: | ---: |
| KODEX200 | 44.62% | 323.7M | 19.90% | 1.3062 |
| All-Weather | 32.30% | 236.3M | 9.46% | 1.6634 |

Stress deltas versus default Profit60:

| account | final delta | MWR | MDD | Sortino |
| --- | ---: | ---: | ---: | ---: |
| Profit50 | -14,683 | 74.13% | 27.38% | 1.7702 |
| Profit50 Slip25 | -25.70M | 72.46% | 27.64% | 1.7388 |
| Profit50 Slip50 | -50.35M | 70.80% | 27.88% | 1.7080 |
| Profit60 Slip25 | -22.23M | 72.69% | 27.75% | 1.7376 |
| Profit60 Slip50 | -47.43M | 71.00% | 27.97% | 1.7081 |

## Retrospective

The edge survives friction.

Both Profit50 and Profit60 stay far above KODEX200 and All-Weather under 25 bps and 50 bps slippage stress. That matters because the strategy's trade count is not tiny, and any real implementation should assume imperfect fills.

Profit60 remains the preferred MWR candidate under stress:

- at 25 bps, Profit60 beats Profit50 by 3.47M final equity;
- at 50 bps, Profit60 beats Profit50 by 2.91M final equity;
- Profit50 still has slightly cleaner default MDD/Sortino, but that advantage does not overturn Profit60's return edge.

The research branch is now more credible:

```text
Profit60 is not only a rounded-score artifact. It survives neighboring thresholds, basket-size checks, and harsh execution friction.
```

## Verification

Passed before full regeneration:

```bash
uv run --locked pytest tests\sim\test_contracts.py tests\sim\test_accounts.py -q
uv run --locked ruff check src\snusmic_pipeline\sim\contracts.py tests\sim\test_contracts.py
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
- `run-sim`: artifacts written to `data/sim` with Profit50/60 slippage stress accounts included;
- `export-web`: 260 artifacts written to `data/web`;
- `ruff format --check`: 75 files already formatted;
- `ruff check`: all checks passed;
- `pytest tests\sim -q`: 80 passed;
- `artifact:check`: schema 1.0.0, 202 reports, 101 accounts, 212 price files;
- `pnpm --dir apps/web typecheck`: passed;
- `pnpm --dir apps/web build`: passed, 561 static pages generated;
- `summary.csv`: Profit60 Slip50 still posts 71.00% MWR and 617.8M final equity;
- `summary.csv`: Profit60 Slip50 remains far ahead of KODEX200 and All-Weather by MWR and final equity.

## Next mutation

Do not add more variants until the search process itself is cleaner.

The next engineering step should be:

1. add a small research-result extractor that emits the comparison tables used in these Markdown files;
2. reduce manual copy/paste risk in future iterations;
3. then test contribution-date sensitivity for Profit60.
