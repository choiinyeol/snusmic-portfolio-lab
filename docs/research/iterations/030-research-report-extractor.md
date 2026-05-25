# 030 Research Report Extractor

Date: 2026-05-25
Status: accepted as process improvement; no strategy change

## Idea

Iterations 024-029 started to rely on repeated comparison tables:

- summary metrics across candidate accounts;
- daily equity deltas against the current best;
- trade-reason counts, especially `retained_cap_trim`.

That is useful, but manually copying the same numbers from `summary.csv`, `equity_daily.csv`, and `trades.csv` is a research bug waiting to happen. Before adding another strategy knob, this iteration adds a small Markdown extractor so future idea-result-retrospective notes can be generated from the simulation artifacts with one command.

## Point-in-time contract

No trading decision changed in this iteration.

The new extractor reads already-generated simulation artifacts only:

- `data/sim/summary.csv`;
- `data/sim/equity_daily.csv`;
- `data/sim/trades.csv`.

It does not feed anything back into the simulator, it does not change account construction, and it does not introduce future information into the strategy. It is a reporting tool for research notes, not a signal.

## Buy rule

No change.

The current candidate remains:

```text
pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5
```

Its buy shell is still:

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

No change.

The current candidate still:

- sells holdings absent from the selected rebalance basket as `rebalance_sell`;
- keeps still-valid holdings inside the persistence band;
- runs a weekly retained-winner cap monitor;
- trims toward 40% only when a retained holding exceeds 45% of equity and is at least +60% above known average cost;
- records that trim as `retained_cap_trim`.

## Result

Added:

```text
python -m snusmic_pipeline research-report
```

The command emits a Markdown report from generated simulation artifacts. Smoke output for the Profit50/60 comparison:

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_top5` | 74.13% | 900.49% | 41.73% | 27.38% | 1.1599 | 1.7702 | 665.3M | 131 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5` | 74.13% | 911.35% | 41.73% | 27.47% | 1.1516 | 1.7640 | 665.3M | 129 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_slip50_top5` | 71.00% | 798.71% | 39.79% | 27.97% | 1.1160 | 1.7081 | 617.8M | 131 |

Daily delta versus Profit60:

| account | final delta | positive days | min daily delta | max daily delta |
| --- | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_top5` | -0.0M | 0.07% | -0.7M | 0.2M |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_slip50_top5` | -47.4M | 0.00% | -48.4M | -0.0M |

Trade reason counts:

| account | rebalance_buy | rebalance_sell | retained_cap_trim |
| --- | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_top5` | 69 | 59 | 3 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5` | 68 | 58 | 3 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_slip50_top5` | 69 | 59 | 3 |

The extractor also has regression tests for:

- missing `--accounts` input;
- missing account IDs;
- summary/delta/trade-reason Markdown output.

## Retrospective

This is not a return improvement, but it improves the research loop.

The previous workflow was too easy to corrupt:

```text
open CSV -> manually filter accounts -> copy numbers -> hand-format tables
```

The new workflow is:

```text
run-sim -> research-report -> paste or write deterministic Markdown
```

That matters because the search is now close to narrow threshold questions where small deltas matter. If Profit60 beats Profit50 by only 14,683 KRW in final equity, manual table generation is an unacceptable source of noise.

## Verification

Passed:

```bash
uv run --locked pytest tests\sim\test_research_report.py -q
uv run --locked ruff check src\snusmic_pipeline\sim\research_report.py tests\sim\test_research_report.py src\snusmic_pipeline\cli.py
uv run --locked python -m snusmic_pipeline research-report --sim data/sim --accounts pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_slip50_top5 --baseline pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5 --title "Profit60 Research Extract"
```

Evidence:

- `pytest tests\sim\test_research_report.py -q`: 2 passed;
- targeted `ruff check`: all checks passed;
- CLI smoke emitted the expected summary, daily-delta, and trade-reason tables.

## Next mutation

Use `research-report` for every new strategy iteration.

The next strategy branch should test contribution-date sensitivity around Profit60:

1. monthly contribution on first trading day;
2. monthly contribution on middle trading day;
3. monthly contribution on last trading day;
4. same Profit60 rules and same PIT inputs.

This checks whether the result is robust to salary-transfer timing rather than another hidden calendar artifact.
