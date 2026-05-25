# 025 Profit60 Attribution Audit

Date: 2026-05-25
Status: accepted as mechanism evidence; reporting limitation found

## Idea

Iteration 024 promoted:

```text
pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5
```

as the current PIT-only money-weighted-return candidate.

Before testing more thresholds, this iteration checks whether the +60% profit-cushion edge is broad enough to trust or merely a path-dependent accident from one lucky trim.

Questions:

- Does Profit60 beat the unconstrained run-winners account across the path, not only at the final date?
- Which symbols explain the edge?
- Does Profit60 also beat the Profit25 risk-adjusted variant by a meaningful margin?
- Did the earlier concentration improvement survive a less selective concentration measurement?
- Can the current trade ledger identify cap-triggered trims explicitly?

## Point-in-time contract

This iteration does not introduce a new trading rule.

It audits already-exported PIT-only simulations. The audited strategies use only:

- decision-date PIT score/rank fields;
- report age available on the decision date;
- decision-date moving-average and 52-week-high state;
- current holdings, average cost, same-day marks, and account equity;
- configured rebalance/cap/profit-cushion rules.

The audit uses future realized outcomes only after simulation completion to evaluate the strategy, not to make simulated decisions.

## Buy rule

Audited base shell:

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

Compared accounts:

| account | cap logic |
| --- | --- |
| `pit_trend_quarterly_fresh540_runwinners_top5` | no mark-to-market retained-winner cap |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5` | weekly trim toward 40% only if weight >45% and unrealized return >= +25% |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5` | weekly trim toward 40% only if weight >45% and unrealized return >= +60% |

## Method

The audit reads:

- `data/sim/summary.csv`
- `data/sim/trades.csv`
- `data/sim/position_episodes.csv`
- `data/sim/monthly_holdings.csv`
- `data/sim/equity_daily.csv`

It compares:

- final metrics for base, Profit25, and Profit60;
- realized sell PnL differences by symbol;
- total position PnL differences by symbol;
- daily equity delta for Profit60 versus base and Profit25;
- all-month concentration, including early months with fewer than five holdings.

## Result

Summary:

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pit_trend_quarterly_fresh540_runwinners_top5` | 73.81% | 794.29% | 41.53% | 29.74% | 1.1082 | 1.6008 | 660.2M | 128 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5` | 73.15% | 806.49% | 41.12% | 27.21% | 1.1693 | 1.7791 | 650.2M | 130 |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5` | 74.13% | 911.35% | 41.73% | 27.47% | 1.1516 | 1.7640 | 665.3M | 129 |

Daily equity delta:

| comparison | final delta | max delta | min delta | positive-days share |
| --- | ---: | ---: | ---: | ---: |
| Profit60 - base | +5.06M | +5.62M on 2025-12-04 | -2.44M on 2025-11-04 | 96.01% |
| Profit60 - Profit25 | +15.10M | n/a | n/a | 99.07% |

The Profit60 edge is persistent across the path. It is not only a final-day mark.

Top total PnL contributors versus base:

| symbol | company | Profit60 - base |
| --- | --- | ---: |
| BILI | Bili bili | +2.33M |
| LITE | Lumentum Holdings Inc | +0.87M |
| 218410.KQ | RFHIC | +0.83M |
| 278470.KS | 에이피알 | +0.66M |
| GLW | Corning | +0.64M |
| 356860.KQ | 티엘비 | +0.47M |
| 211050.KQ | 인카금융서비스 | +0.43M |
| 007660.KS | 이수페타시스 | +0.41M |
| PLTR | Palantir Technologies Inc. | +0.38M |
| 042660.KS | 한화오션 | +0.31M |

Worst total PnL contributors versus base:

| symbol | company | Profit60 - base |
| --- | --- | ---: |
| 475960.KQ | 토모큐브 | -1.10M |
| 035900.KQ | JYP Ent. | -0.32M |
| 298020.KQ | 효성티앤씨 | -0.27M |
| 194480.KQ | 데브시스터즈 | -0.17M |
| 005850.KS | 에스엘 | -0.16M |

The improvement is not one-name-only. BILI is the largest contributor, but the final edge also comes from Lumentum, RFHIC, APR, Corning, TLB, Incar, Isu Petasys, Palantir, and Hanwha Ocean.

All-month concentration:

| account | months | avg names | max top1 | median top1 | max top3 | median top3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| base run-winners | 50 | 4.52 | 58.24% | 28.63% | 100.00% | 74.40% |
| Profit25 | 50 | 4.46 | 58.27% | 28.84% | 100.00% | 74.88% |
| Profit60 | 50 | 4.46 | 58.25% | 28.68% | 100.00% | 74.82% |

This weakens the earlier concentration claim. The mature-month lens is still useful for live-like steady-state behavior, but the all-month lens shows that Profit25/Profit60 do not fully eliminate early concentration. The correct claim is narrower:

```text
Profit60 improves return and MDD versus base, and mature-month concentration looks cleaner, but all-month concentration is not materially different.
```

Trade-reason audit:

| account | rebalance buys | rebalance sells | explicit cap sells |
| --- | ---: | ---: | ---: |
| base run-winners | 69 | 59 | 0 |
| Profit25 | 68 | 62 | 0 |
| Profit60 | 68 | 61 | 0 |

The simulator currently records cap-triggered trims as `rebalance_sell`, so exact cap-trigger attribution is inferred from account differences rather than directly visible in the ledger.

## Retrospective

Profit60 survives the first attribution audit.

The result has three strengths:

1. Profit60 beats the unconstrained run-winners account by +5.06M final equity.
2. Profit60 is ahead of the unconstrained account on 96.01% of daily observations.
3. The edge is distributed across several winners instead of being one single-stock accident.

It also has two caveats:

1. The cap-trim reason is not explicit in `trades.csv`, which makes the causal audit weaker than it should be.
2. Concentration control is less clean when early under-diversified months are included.

So the current status is:

```text
Profit60 remains the current MWR candidate, but it is not yet a final strategy.
```

The next implementation should improve auditability before adding more knobs. If cap-triggered sells are written with an explicit reason such as `retained_cap_trim`, future iterations can separate true cap trims from normal rebalance exits.

## Verification

The audited artifacts are from the Iteration 024 simulation/export run:

```bash
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
```

Fresh validation for this documentation/audit pass:

```bash
uv run --locked ruff format --check
uv run --locked ruff check
pnpm --dir apps/web artifact:check
```

Evidence:

- `ruff format --check`: 75 files already formatted
- `ruff check`: all checks passed
- `artifact:check`: schema 1.0.0, 202 reports, 93 accounts, 212 price files

## Next mutation

Do this before testing more threshold values:

1. expose retained-winner cap trims as a distinct trade reason;
2. rerun the current base/Profit25/Profit60 accounts;
3. verify that explicit cap-trim attribution matches the inferred account differences;
4. only then test nearby +50% and +75% profit-cushion thresholds.

Reject for now:

- declaring Profit60 final from summary metrics alone;
- adding more signal filters before trade-reason attribution is fixed;
- claiming that Profit60 fully solves concentration under every measurement lens.
