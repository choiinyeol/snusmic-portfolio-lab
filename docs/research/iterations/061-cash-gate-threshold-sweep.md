# 061 Cash Gate Threshold Sweep

## Idea

Iteration 060 showed that same-day redeployment after a trailing-profit trim only works when the trim leaves a meaningful cash balance. The first accepted gate used 15% cash/equity. This iteration tests whether 15% is a stable neighborhood or a coarse-grid accident.

The candidate rule remains point-in-time only:

- use the same Profit60 mixed-entry base as the current branch;
- keep the same trailing-profit trim trigger: +100% unrealized winner, then 25% drawdown from observed holding-period high;
- trim toward a 20% account weight cap;
- after a trim, run the existing PIT rebalance engine on the same day only if observed account cash is at least the tested threshold of observed account equity;
- no target-hit label, future return, or later report information participates in the decision.

Thresholds tested:

| Gate | Interpretation |
| ---: | --- |
| 10.0% | nearly blanket redeploy; should catch weak small-cash events |
| 12.5% | admits the large PLTR cash event earlier than 15% |
| 15.0% | Iteration 060 accepted gate |
| 17.5%+ | likely no-op if no trim leaves that much cash |

## Result

Generated CSV evidence:

- [061-cash-gate-threshold-sweep-results.csv](061-cash-gate-threshold-sweep-results.csv)
- [061-cash-gate-threshold-sweep-deltas.csv](061-cash-gate-threshold-sweep-deltas.csv)
- [061-cash-gate-threshold-sweep-trims.csv](061-cash-gate-threshold-sweep-trims.csv)
- [061-cash-gate-threshold-sweep-extra-vs-cap20.csv](061-cash-gate-threshold-sweep-extra-vs-cap20.csv)
- [061-cash-gate-threshold-sweep-event-deltas.csv](061-cash-gate-threshold-sweep-event-deltas.csv)

Summary:

| Account | Gate | MWR | TWR | CAGR | MDD | Sharpe | Sortino | Final equity | Trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Cap20 baseline | none | 77.22% | 1001.09% | 43.64% | 27.47% | 1.1956 | 1.8570 | 715.1M | 136 |
| Cash gate 10.0 | 10.0% | 77.20% | 990.18% | 43.63% | 27.47% | 1.1977 | 1.8552 | 714.8M | 145 |
| Cash gate 12.5 | 12.5% | 78.27% | 1031.39% | 44.30% | 27.47% | 1.2061 | 1.8713 | 732.8M | 138 |
| Cash gate 15.0 | 15.0% | 77.77% | 1016.72% | 43.99% | 27.47% | 1.2026 | 1.8676 | 724.4M | 142 |
| Cash gate 17.5 | 17.5% | 77.22% | 1001.09% | 43.64% | 27.47% | 1.1956 | 1.8570 | 715.1M | 136 |
| Cash gate 20.0 | 20.0% | 77.22% | 1001.09% | 43.64% | 27.47% | 1.1956 | 1.8570 | 715.1M | 136 |
| All-Weather | benchmark | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |
| KODEX200 | benchmark | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| QQQ | benchmark | 28.15% | 219.27% | 14.61% | 18.56% | 0.6643 | 0.9455 | 212.3M | 65 |

Daily delta versus Cap20:

| Gate | Final delta | Positive days | Min delta | Max delta |
| ---: | ---: | ---: | ---: | ---: |
| 10.0% | -0.3M | 1.93% | -6.5M | 6.9M |
| 12.5% | 17.8M | 22.97% | -0.5M | 18.1M |
| 15.0% | 9.3M | 21.47% | -3.1M | 9.5M |
| 17.5% | 0.0M | 0.00% | 0.0M | 0.0M |

The 12.5% gate is the current local winner. It improves final equity by 17.8M KRW versus Cap20 and by 8.5M KRW versus the 15% gate, while keeping MDD unchanged.

Mechanism:

- 10% behaves too much like blanket redeployment and reintroduces weak small-cash events.
- 17.5% and higher are no-ops on this path.
- 12.5% admits the 2025-02-24 PLTR trim event, while still avoiding enough weak churn to keep trade count at 138.
- The 12.5% path starts pulling ahead around 2025-03-21 and finishes 17.8M KRW above Cap20.

Key event deltas:

| Date | 12.5% minus Cap20 | 12.5% minus 15% |
| --- | ---: | ---: |
| 2025-02-24 | -0.2M | -0.2M |
| 2025-03-21 | 2.2M | 2.5M |
| 2025-04-01 | 4.5M | 2.3M |
| 2026-05-22 | 17.8M | 8.5M |

## Retrospective

This result upgrades the branch best from 15% to 12.5%. The threshold is not yet proven as a universal optimum, but the local structure is informative:

- below 12.5%, the gate gets too permissive and allows noisy redeployments;
- above 15%, the gate becomes too strict and loses the useful PLTR cash event;
- 12.5% is a narrow but interpretable midpoint: redeploy only when trim cash is large enough to matter, but not so large that the strategy waits until the opportunity is gone.

The permanent candidate added after this iteration is:

`pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5`

Verification commands:

```powershell
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
uv run --locked ruff format --check src/snusmic_pipeline/sim/contracts.py tests/sim/test_contracts.py
uv run --locked ruff check src/snusmic_pipeline/sim/contracts.py tests/sim/test_contracts.py
uv run --locked pytest tests/sim/test_contracts.py tests/sim/test_accounts.py -q
pnpm --dir apps/web artifact:check
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
```

Next iteration:

- stress 12.5% under 25/50 bps slippage and middle/month-end contribution timing;
- test Top3/Top7 around the same 12.5% redeploy gate;
- attribute the 2025-02-24 redeploy basket to identify whether one symbol or the basket rule created most of the edge.
