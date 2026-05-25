# 033 Candidate Score Profit60 Audit

## Idea

Iteration 032 found that the existing Profit60 shell became stronger when the ranker changed from `board_score` to `candidate_score`. This iteration tests whether that was a real point-in-time edge or a fragile artifact.

The audit keeps the same rule shell:

- quarterly rebalance,
- report age <= 540 days,
- MA stack required,
- no new buy if farther than 20% below the 52-week high,
- Top20 rank exit,
- minimum 60 holding days,
- no sell-down of still-valid winners at rebalance,
- weekly cap trim only when a holding exceeds 45% of equity and is at least +60% above known average cost.

Only the audit axis changes:

- Top-N concentration: Candidate Top3 / Top5 / Top7,
- friction: Candidate Top5 with 25 bps and 50 bps slippage,
- contribution timing: middle-month and month-end salary cash flows,
- attribution versus the original board-score Profit60 account.

All variants rank with point-in-time data only. The strategy still cannot read future target hits, future returns, or future prices.

## Result

Command:

```powershell
uv run --locked python -m snusmic_pipeline research-report --sim data/sim --accounts pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top3,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top7,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip25_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip50_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_midcontrib_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_lastcontrib_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5,benchmark_kodex200,all_weather --baseline pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5 --title "Candidate Score Profit60 Audit"
```

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Candidate Top5 | 76.66% | 982.30% | 43.30% | 27.47% | 1.1847 | 1.8393 | 705.8M | 131 |
| Candidate Top3 | 64.33% | 601.40% | 35.71% | 29.10% | 0.9686 | 1.4999 | 526.8M | 97 |
| Candidate Top7 | 61.20% | 593.35% | 33.81% | 27.33% | 1.0222 | 1.5508 | 488.3M | 165 |
| Candidate Slip25 Top5 | 75.17% | 930.03% | 42.37% | 27.75% | 1.1678 | 1.8113 | 681.7M | 131 |
| Candidate Slip50 Top5 | 73.57% | 864.42% | 41.38% | 27.97% | 1.1498 | 1.7827 | 656.6M | 131 |
| Candidate Mid-Contribution Top5 | 76.75% | 995.22% | 42.93% | 28.44% | 1.1765 | 1.8475 | 696.2M | 131 |
| Candidate Last-Contribution Top5 | 77.33% | 1007.65% | 42.89% | 27.32% | 1.1683 | 1.8459 | 695.1M | 131 |
| Board Score Profit60 Top5 | 74.13% | 911.35% | 41.73% | 27.47% | 1.1516 | 1.7640 | 665.3M | 129 |
| KODEX200 | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| All Weather | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

Daily equity delta versus Candidate Top5:

- Candidate Top3: -179.0M final delta, positive on only 4.78% of days.
- Candidate Top7: -217.5M final delta, positive on only 0.29% of days.
- Candidate Slip25: -24.1M final delta; still 681.7M final equity and 75.17% MWR.
- Candidate Slip50: -49.2M final delta; still 656.6M final equity and 73.57% MWR.
- Board Score Profit60: -40.5M final delta; Candidate Top5 is ahead on 99.00% of daily observations.
- KODEX200: -382.1M final delta.
- All Weather: -469.5M final delta.

Trade reasons:

| account | rebalance_buy | rebalance_sell | retained_cap_trim |
| --- | ---: | ---: | ---: |
| Candidate Top5 | 69 | 59 | 3 |
| Candidate Top3 | 47 | 40 | 10 |
| Candidate Top7 | 87 | 75 | 3 |
| Candidate Slip25 Top5 | 69 | 59 | 3 |
| Candidate Slip50 Top5 | 69 | 59 | 3 |
| Candidate Mid-Contribution Top5 | 69 | 59 | 3 |
| Candidate Last-Contribution Top5 | 69 | 59 | 3 |
| Board Score Profit60 Top5 | 68 | 58 | 3 |

Attribution versus Board Score Profit60:

| symbol | company | candidate delta | candidate PnL | board-score PnL |
| --- | --- | ---: | ---: | ---: |
| PLTR | Palantir Technologies Inc. | +10.7M | 39.6M | 28.9M |
| 218410.KQ | RFHIC | +7.2M | 125.1M | 117.9M |
| LITE | Lumentum Holdings Inc | +6.1M | 98.8M | 92.7M |
| 278470.KS | 에이피알 | +5.8M | 95.4M | 89.6M |
| 267260.KS | HD현대일렉트릭 | +5.5M | 0.6M | -4.9M |
| GLW | Corning | +4.5M | 78.2M | 73.7M |
| 356860.KQ | 티엘비 | +4.1M | 71.4M | 67.3M |
| 211050.KQ | 인카금융서비스 | +2.0M | 33.5M | 31.4M |

Main negative deltas were much smaller: 브이티 -4.9M, 알테오젠 -3.0M, 토모큐브 -0.5M, BYD -0.3M.

## Reflection

Candidate Top5 passes the audit. The edge is not just a Top-N accident: Top3 becomes too concentrated, Top7 dilutes the winners, and Top5 remains the useful basket size. It also survives friction: even the 50 bps slippage stress still beats the board-score Profit60 account by MWR and remains far above KODEX200 and All Weather.

Contribution timing does not break the strategy. Middle/month-end contribution variants post similar or slightly higher MWR, while first-trading-day Candidate Top5 remains the final-equity leader. As before, cash-flow timing variants are robustness evidence, not separate canonical accounts.

The attribution is broad enough to promote the candidate. The improvement comes from better allocation across several realized winners rather than a single isolated stock. `candidate_score` appears to keep the ranker closer to report economics while the existing technical gates handle trend confirmation.

Decision: promote `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5` from provisional candidate to current canonical research candidate.

Next loop:

1. Inspect score mechanics: decompose `candidate_score` into the observable inputs that create the edge.
2. Add a compact “why selected” audit table for the canonical account at each rebalance date.
3. Stress the promoted candidate against market-regime gates only if the audit table shows obvious market-wide bad-entry clusters.
