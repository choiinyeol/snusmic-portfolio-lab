# 036 Candidate vs Board Account Path Audit

## Idea

Iteration 035 showed that the few `candidate_score`-only Top5 substitutions did not beat the `board_score`-only substitutions on simple next-rebalance return. That means the full-account edge must come from the realized account path:

- when the position first entered,
- how long the run-winners rule retained it,
- how much realized PnL accumulated at rebalance sells,
- how cap trims interacted with the known cost basis.

This iteration audits the promoted candidate-score Profit60 account against the board-score Profit60 account at the account-path level.

## Point-in-time contract

No trading rule changes are introduced.

Both compared accounts are already generated from point-in-time simulation artifacts. This audit reads only generated `data/sim` outputs:

- `summary.csv`
- `equity_daily.csv`
- `trades.csv`
- `position_episodes.csv`

The audit uses ex-post realized account outputs only to explain the already generated result. It does not feed any future information back into a selection rule.

## Buy rule

No new buy rule. Compared accounts:

- Candidate: `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5`
- Baseline: `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5`

## Sell/rebalance rule

No new sell rule. Both accounts keep the same Profit60 construction:

- quarterly rebalance,
- Fresh540 admission,
- run winners,
- weekly 45% position monitor,
- trim only after +60% unrealized profit cushion.

## Result

Command:

```powershell
uv run --locked python -m snusmic_pipeline account-path-audit --sim data/sim --account pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5 --baseline pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5 --title "Candidate Score vs Board Score Account Path Audit" --out docs/research/iterations/036-candidate-vs-board-account-path-generated.md
```

Generated audit artifact:

- `docs/research/iterations/036-candidate-vs-board-account-path-generated.md`

Summary delta:

| metric | candidate | board-score baseline | delta |
| --- | ---: | ---: | ---: |
| MWR | 76.66% | 74.13% | +2.53%p |
| TWR | 982.30% | 911.35% | +70.95%p |
| CAGR | 43.30% | 41.73% | +1.57%p |
| MDD | 27.47% | 27.47% | 0.00%p |
| realized PnL | 236.5M | 217.5M | +18.9M |
| final equity | 705.8M | 665.3M | +40.5M |
| trade count | 131 | 129 | +2 |

Equity path:

| date | candidate equity | baseline equity | delta |
| --- | ---: | ---: | ---: |
| 2021-12-31 | 19.9M | 19.9M | 0.0M |
| 2022-12-30 | 25.5M | 25.5M | 0.0M |
| 2023-12-29 | 64.1M | 64.1M | 0.0M |
| 2024-12-31 | 136.6M | 129.0M | +7.6M |
| 2025-12-31 | 321.1M | 302.6M | +18.5M |
| 2026-05-22 | 705.8M | 665.3M | +40.5M |

The paths first diverged on 2024-07-01. After divergence, the candidate account was ahead on 97.16% of nonzero-delta days.

Largest positive symbol deltas:

| symbol | candidate PnL | baseline PnL | delta |
| --- | ---: | ---: | ---: |
| PLTR | 39.6M | 28.9M | +10.7M |
| RFHIC | 125.1M | 117.9M | +7.2M |
| LITE | 98.8M | 92.7M | +6.1M |
| 278470.KS | 95.4M | 89.6M | +5.8M |
| HD현대일렉트릭 | 0.6M | -4.9M | +5.5M |
| GLW | 78.2M | 73.7M | +4.5M |
| 356860.KQ | 71.4M | 67.3M | +4.1M |

Largest negative deltas:

| symbol | candidate PnL | baseline PnL | delta |
| --- | ---: | ---: | ---: |
| 018290.KS | -4.9M | 0.0M | -4.9M |
| 196170.KQ | -1.6M | 1.4M | -3.0M |
| 475960.KQ | -10.0M | -9.6M | -0.5M |

Trade reason delta:

| reason | candidate trades | baseline trades | realized delta |
| --- | ---: | ---: | ---: |
| rebalance_buy | 69 | 68 | 0.0M |
| rebalance_sell | 59 | 58 | +18.0M |
| retained_cap_trim | 3 | 3 | +0.9M |

First-buy timing:

| symbol | candidate first buy | baseline first buy | candidate minus baseline |
| --- | --- | --- | ---: |
| PLTR | 2024-07-01 | 2024-10-01 | -92 days |
| 196170.KQ | 2024-10-01 | 2024-07-01 | +92 days |

## Retrospective

This explains why Iteration 035 looked contradictory. The candidate-score account did not win because every local Top5 substitution immediately outperformed. It won because the path after the first divergence was better almost all the time, and because the PnL delta concentrated in realized rebalance exits and retained winners.

The important mechanism is PLTR timing. Candidate-score bought PLTR one quarter earlier than the board-score account. That single timing difference produced +10.7M symbol-level PnL delta and helped start the persistent equity lead from 2024-07 onward.

The rest of the edge is distributed across retained winners: RFHIC, LITE, 278470.KS, HD현대일렉트릭, GLW, and 356860.KQ. This supports the current interpretation:

> candidate_score is not a better next-quarter predictor by itself. It changes the moment a winner enters the run-winners machinery.

Decision: keep the canonical candidate unchanged. Do not tune score weights yet.

## Next mutation

The next loop should test whether the "earlier winner entry" mechanism can be made explicit without future leakage:

1. Audit candidate-score entries whose board rank is 6-7 but candidate rank is Top5.
2. Check whether they share observable PIT traits at entry: high report upside, positive current return, target gap not too extended, fresh report age.
3. If the traits are stable, test a conservative "candidate tie-breaker only near the Top5 boundary" variant.
4. If unstable, stop score mutation and keep candidate-score Top5 as the simpler rule.
