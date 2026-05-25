# 031 Profit60 Contribution Timing

Date: 2026-05-25
Status: accepted as contribution-timing robustness evidence; no canonical strategy replacement

## Idea

The Profit60 account might be benefiting from the assumed monthly cash-flow calendar rather than the trading rule itself. The canonical salaried-worker plan contributes on the first available trading day of each month. This iteration keeps the same Profit60 PIT rule and moves only the monthly contribution date:

- first trading day of the month;
- middle trading day of the month;
- last trading day of the month.

If the edge disappears when cash arrives later, the strategy is too dependent on a hidden implementation calendar.

## Point-in-time contract

The variants change cash arrival timing only. They do not change the ranking inputs, report window, price history visibility, or sell rules.

Each account still sees only information available on each decision date:

- PIT research board rows available on that date;
- prices up to that date;
- known average cost and realized cash balance up to that date;
- no future return, target-hit outcome, or post-publication performance.

The middle/month-end contribution variants receive cash later in the same month, so they are deliberately different cash-flow schedules rather than a pure strategy replacement.

## Buy rule

All three accounts use the same Profit60 shell:

- quarterly rebalance;
- PIT trend candidates;
- max report age 540 days;
- 20/50/200MA stack required;
- within 20% of the 52-week high;
- Top20 persistence band;
- 60-day minimum holding period;
- Top5 target basket;
- equal-weight new buys using available cash;
- retained winners are not mechanically sold down to equal weight.

Compared accounts:

```text
pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5
pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_midcontrib_top5
pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_lastcontrib_top5
benchmark_kodex200
all_weather
```

## Sell/rebalance rule

All Profit60 variants:

- sell holdings absent from the selected rebalance basket as `rebalance_sell`;
- keep still-valid holdings inside the persistence band;
- run a weekly retained-winner cap monitor;
- trim toward 40% only when a retained holding exceeds 45% of equity and is at least +60% above known average cost;
- record those trims as `retained_cap_trim`.

## Result

Generated with:

```bash
uv run --locked python -m snusmic_pipeline research-report --sim data/sim --accounts pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_midcontrib_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_lastcontrib_top5,benchmark_kodex200,all_weather --baseline pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5 --title "Profit60 Contribution Timing"
```

## Summary

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5` | 74.13% | 911.35% | 41.73% | 27.47% | 1.1516 | 1.7640 | 665.3M | 129 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_midcontrib_top5` | 74.19% | 920.91% | 41.35% | 28.44% | 1.1433 | 1.7712 | 655.9M | 131 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_lastcontrib_top5` | 74.77% | 934.30% | 41.32% | 27.32% | 1.1354 | 1.7693 | 655.1M | 131 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

## Daily Delta vs `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5`

| account | final delta | positive days | min daily delta | max daily delta |
| --- | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_midcontrib_top5` | -9.4M | 28.03% | -11.2M | 0.6M |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_lastcontrib_top5` | -10.2M | 2.50% | -12.4M | 0.6M |
| `benchmark_kodex200` | -341.6M | 17.33% | -352.0M | 4.6M |
| `all_weather` | -428.9M | 33.67% | -442.1M | 11.2M |

## Trade Reasons

| account | rebalance_buy | rebalance_sell | retained_cap_trim |
| --- | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5` | 68 | 58 | 3 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_midcontrib_top5` | 69 | 59 | 3 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_lastcontrib_top5` | 69 | 59 | 3 |
| `benchmark_kodex200` | 65 | 0 | 0 |
| `all_weather` | 160 | 26 | 0 |

## Retrospective

The Profit60 edge is not explained away by the first-trading-day deposit convention.

All three contribution calendars beat KODEX200 and All-Weather by a wide margin. Month-end contribution even reports the highest MWR at 74.77%, but that is partly a cash-flow timing effect: money arrives later, so the internal-rate denominator changes. Under the canonical first-trading-day savings plan, the existing Profit60 account still has the highest final equity:

- +9.4M KRW versus the middle-month contribution variant;
- +10.2M KRW versus the month-end contribution variant.

So this iteration is robustness evidence, not a reason to replace the canonical account. The strategy claim should stay tied to the explicit cash-flow schedule used in the simulation.

## Verification

Passed:

```bash
uv run --locked pytest tests\sim\test_savings.py tests\sim\test_contracts.py -q
uv run --locked ruff check src\snusmic_pipeline\sim\savings.py src\snusmic_pipeline\sim\runner.py src\snusmic_pipeline\sim\contracts.py tests\sim\test_savings.py tests\sim\test_contracts.py src\snusmic_pipeline\web\artifacts.py
pnpm --dir apps/web typecheck
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
pnpm --dir apps/web artifact:check
pnpm --dir apps/web build
uv run --locked python -m snusmic_pipeline research-report --sim data/sim --accounts pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_midcontrib_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_lastcontrib_top5,benchmark_kodex200,all_weather --baseline pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5 --title "Profit60 Contribution Timing"
```

Evidence:

- `pytest tests\sim\test_savings.py tests\sim\test_contracts.py -q`: 22 passed;
- targeted `ruff check`: all checks passed;
- `pnpm --dir apps/web typecheck`: passed;
- `run-sim`: regenerated `data/sim` in 42.7s;
- `export-web`: regenerated 260 web artifacts in 22.9s;
- `pnpm --dir apps/web artifact:check`: passed with schema 1.0.0, 202 reports, 103 accounts, and 212 price files;
- `pnpm --dir apps/web build`: passed and generated 569 static pages;
- `research-report`: emitted summary, daily-delta, and trade-reason tables above.

## Next mutation

Keep the canonical first-trading-day Profit60 account as the implementation candidate, then test ranking-score robustness inside the same shell:

1. Profit60 ranked by the current board score;
2. Profit60 ranked by candidate score;
3. Profit60 ranked by technical momentum subscore;
4. same Top5, freshness, persistence, cap, and cash-flow assumptions.

This is the next clean PIT-only branch because it tests whether the selected names are robust to the scoring field rather than another portfolio-construction knob.
