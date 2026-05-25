# 028 Profit60 Top-N Boundary

Date: 2026-05-25
Status: rejected as replacement; accepted as Top5 boundary evidence

## Idea

The user originally proposed PIT-score Top N portfolios such as Top3, Top5, and Top10.
After the research path converged on the Profit60 run-winners rule, this iteration retests the same concentration question inside the current best shell:

```text
Profit60 Top3
Profit60 Top5
Profit60 Top7
```

The goal is to check whether Top5 is still the right basket size once the weekly retained-winner cap and +60% profit cushion are active.

## Point-in-time contract

The tested accounts use the same PIT-only inputs as Profit60:

- only reports published by the decision date;
- only prices, moving averages, 52-week-high distance, account cash, holdings, and average costs known on the decision date;
- no future target-hit outcomes, future returns, future ranks, or future price paths.

The only changed parameter is `top_n`.

## Buy rule

Shared shell:

- quarterly rebalance;
- PIT trend candidates;
- max report age 540 days;
- 20/50/200MA stack required;
- within 20% of the 52-week high;
- Top20 persistence band;
- 60-day minimum holding period;
- equal-weight new buys with available cash;
- retained winners are not mechanically sold down to equal weight.

Variant:

| account | target basket |
| --- | ---: |
| Profit60 Top3 | 3 |
| Profit60 Top5 | 5 |
| Profit60 Top7 | 7 |

## Sell/rebalance rule

Shared shell:

- sell holdings absent from the selected rebalance basket as `rebalance_sell`;
- keep still-valid holdings inside the persistence band;
- weekly mark-to-market retained-winner cap check;
- if a retained holding exceeds 45% of equity and unrealized return is at least +60%, trim toward 40%;
- record that trim as `retained_cap_trim`.

## Result

Summary:

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Profit60 Top3 | 56.67% | 475.79% | 31.08% | 29.10% | 0.8889 | 1.4205 | 437.1M | 98 |
| Profit60 Top5 | 74.13% | 911.35% | 41.73% | 27.47% | 1.1516 | 1.7640 | 665.3M | 129 |
| Profit60 Top7 | 63.58% | 642.57% | 35.25% | 27.26% | 1.0512 | 1.5838 | 517.4M | 166 |

Comparison to the current Top5:

| account | final delta vs Top5 | positive days vs Top5 | min daily delta | max daily delta |
| --- | ---: | ---: | ---: | ---: |
| Profit60 Top3 | -228.1M | 13.27% | -239.2M | +15.9M |
| Profit60 Top7 | -147.9M | 1.14% | -147.9M | +1.6M |

Trade reason counts:

| account | rebalance buys | rebalance sells | retained cap trims |
| --- | ---: | ---: | ---: |
| Profit60 Top3 | 49 | 40 | 9 |
| Profit60 Top5 | 68 | 58 | 3 |
| Profit60 Top7 | 89 | 74 | 3 |

The comparison with the old unconstrained run-winners Top N family is also instructive:

| account | MWR | final equity | MDD | Sortino |
| --- | ---: | ---: | ---: | ---: |
| Run-winners Top3 | 57.90% | 450.6M | 29.74% | 1.3171 |
| Run-winners Top5 | 73.81% | 660.2M | 29.74% | 1.6008 |
| Run-winners Top7 | 63.33% | 514.2M | 29.74% | 1.4279 |

Top5 was already the best basket size before the Profit60 cap. The cap does not change that conclusion.

## Retrospective

Top3 is not "higher conviction"; it is under-diversified and over-dependent on the exact first few ranks. It has fewer trades, but that is not a virtue here because it misses too much of the winner set.

Top7 is not "safer"; it dilutes the account with lower-ranked names and adds turnover. It slightly lowers MDD versus Top5, but gives up 147.9M KRW final equity and materially worsens Sharpe/Sortino.

The lesson is:

```text
The edge is concentrated, but not Top3-concentrated.
```

Top5 remains the correct default for this research branch. Further Top-N tuning is unlikely to be productive unless the score model itself changes.

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
- `run-sim`: artifacts written to `data/sim` with Profit60 Top3/Top7 included;
- `export-web`: 260 artifacts written to `data/web`;
- `ruff format --check`: 75 files already formatted;
- `ruff check`: all checks passed;
- `pytest tests\sim -q`: 80 passed;
- `artifact:check`: schema 1.0.0, 202 reports, 97 accounts, 212 price files;
- `pnpm --dir apps/web typecheck`: passed;
- `pnpm --dir apps/web build`: passed, 561 static pages generated;
- `summary.csv`: Profit60 Top5 remains ahead of Top3 by 228.1M KRW and ahead of Top7 by 147.9M KRW final equity;
- `trades.csv`: Top3 needed 9 retained cap trims, while Top5 and Top7 each needed 3.

## Next mutation

Stop testing Top N around this shell. The next branch should test robustness rather than shape:

1. apply slippage/cost stress directly to Profit50 and Profit60;
2. compare whether Profit50 or Profit60 is the safer implementation under friction;
3. keep Top5 fixed unless a future score model changes the ranking semantics.
