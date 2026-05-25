# 032 Profit60 Score Field Robustness

Date: 2026-05-25
Status: accepted as new candidate; requires friction and Top-N robustness audit

## Idea

Profit60 has been ranked by `board_score`, which blends report upside, current return, and several technical bonuses. That may be over-engineered. Since the strategy already requires a strong technical setup through admission gates, the ranking field itself might work better if it stays closer to the report economics.

This iteration keeps the full Profit60 construction and changes only the ranking score:

- control: `board_score`;
- variant: `candidate_score`;
- variant: `ta_momentum_score`.

## Point-in-time contract

All three score fields are computed inside the point-in-time research board as of the decision date.

The variants do not use future target-hit outcomes, future returns, future drawdowns, or future holdings. They use the same as-of report row, as-of price, as-of moving-average state, known average cost, and cash ledger.

## Buy rule

All accounts use the same Profit60 shell:

- quarterly rebalance;
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
pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5
pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_momentum_top5
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
uv run --locked python -m snusmic_pipeline research-report --sim data/sim --accounts pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_momentum_top5,benchmark_kodex200,all_weather --baseline pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5 --title "Profit60 Score Field Robustness"
```

## Summary

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5` | 74.13% | 911.35% | 41.73% | 27.47% | 1.1516 | 1.7640 | 665.3M | 129 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5` | 76.66% | 982.30% | 43.30% | 27.47% | 1.1847 | 1.8393 | 705.8M | 131 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_momentum_top5` | 59.63% | 591.65% | 32.86% | 33.86% | 0.9611 | 1.4394 | 470.0M | 131 |
| `benchmark_kodex200` | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| `all_weather` | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

## Daily Delta vs `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5`

| account | final delta | positive days | min daily delta | max daily delta |
| --- | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5` | 40.5M | 34.17% | -2.6M | 41.4M |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_momentum_top5` | -195.3M | 32.45% | -195.3M | 16.6M |
| `benchmark_kodex200` | -341.6M | 17.33% | -352.0M | 4.6M |
| `all_weather` | -428.9M | 33.67% | -442.1M | 11.2M |

## Trade Reasons

| account | rebalance_buy | rebalance_sell | retained_cap_trim |
| --- | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5` | 68 | 58 | 3 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5` | 69 | 59 | 3 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_momentum_top5` | 69 | 59 | 3 |
| `benchmark_kodex200` | 65 | 0 | 0 |
| `all_weather` | 160 | 26 | 0 |

## Retrospective

`candidate_score` is the first clean improvement after Profit60.

It improves:

- MWR: 74.13% -> 76.66%;
- final equity: 665.3M -> 705.8M;
- Sharpe: 1.1516 -> 1.1847;
- Sortino: 1.7640 -> 1.8393.

The drawdown is unchanged at 27.47%, so this is not simply taking more marked drawdown. The result also makes product sense: the entry filters already enforce trend quality, so adding more technical bonuses inside the ranking score may be double-counting momentum. `candidate_score` keeps the rank closer to report upside and current progress while the gates handle trend discipline.

The caution is path shape. The candidate variant is ahead on only 34.17% of daily observations but ends +40.5M KRW ahead. That means the improvement is likely driven by a late or concentrated set of winners, so this is a candidate, not a final declaration.

The pure `ta_momentum_score` variant is clearly rejected. It loses 195.3M KRW of final equity versus Profit60 and worsens MDD to 33.86%, showing that momentum ranking alone is too noisy after the same entry gates.

## Verification

Passed so far:

```bash
uv run --locked pytest tests\sim\test_contracts.py -q
uv run --locked ruff format --check src\snusmic_pipeline\sim\contracts.py src\snusmic_pipeline\web\artifacts.py tests\sim\test_contracts.py
uv run --locked ruff check src\snusmic_pipeline\sim\contracts.py src\snusmic_pipeline\web\artifacts.py tests\sim\test_contracts.py
pnpm --dir apps/web typecheck
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
pnpm --dir apps/web artifact:check
pnpm --dir apps/web build
uv run --locked python -m snusmic_pipeline research-report --sim data/sim --accounts pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_momentum_top5,benchmark_kodex200,all_weather --baseline pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5 --title "Profit60 Score Field Robustness"
```

Evidence:

- `pytest tests\sim\test_contracts.py -q`: 13 passed;
- targeted Python `ruff format --check`: 3 files already formatted;
- targeted Python `ruff check`: all checks passed;
- `pnpm --dir apps/web typecheck`: passed;
- `run-sim`: regenerated `data/sim` in 43.5s;
- `export-web`: regenerated 260 web artifacts in 23.0s;
- `pnpm --dir apps/web artifact:check`: passed with schema 1.0.0, 202 reports, 105 accounts, and 212 price files;
- `pnpm --dir apps/web build`: passed and generated 577 static pages;
- `research-report`: emitted summary, daily-delta, and trade-reason tables above.

## Next mutation

Audit the new candidate before accepting it as the working best:

1. candidate-score Profit60 Top3/Top5/Top7;
2. candidate-score Profit60 25/50 bps slippage stress;
3. candidate-score contribution timing sensitivity;
4. attribution: identify which symbols create the +40.5M final-equity gap.

If it survives those checks, promote `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5` as the new canonical implementation candidate.
