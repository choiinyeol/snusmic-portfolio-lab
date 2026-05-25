# 062 CashGate 12.5 Robustness

## Idea

Iteration 061 promoted the 12.5% post-trim cash gate as the local absolute-return leader. This iteration does not search for another threshold. It stress-tests whether that 12.5% rule is robust enough to treat as the branch default.

The tested questions:

- Does the 12.5% gate survive harsh execution friction?
- Does monthly contribution timing change the conclusion?
- Is the edge specific to Top5, or does it generalize to Top3/Top7?
- Does it still beat the standing benchmarks when stressed?

## Point-in-time contract

All strategy decisions use only information visible on the decision date:

- report metadata and scores already present on that date;
- observed account cash, equity, cost basis, holdings, and holding-period highs;
- price history available up to the trade/rebalance date;
- current candidate ranking at the rebalance/redeploy date.

The stress variants do not use target-hit labels, future returns, later report outcomes, or future price windows to decide buys or sells.

## Buy rule

The base account is:

`pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5`

It preserves the current branch construction:

- quarterly PIT Top5 shell;
- report freshness cap of 540 days;
- run-winners retention;
- conservative `board_score` for retention;
- `candidate_score` only for newly opened entry slots;
- weekly 45% concentration monitor with +60% profit cushion;
- trailing-profit trim after a doubled holding draws down 25% from its observed holding-period high;
- trim toward 20% account weight;
- same-day redeploy after trim only if observed cash is at least 12.5% of observed equity.

Stress variants:

| Variant | Change |
| --- | --- |
| Slip25 | 25 bps slippage stress |
| Slip50 | 50 bps slippage stress |
| Mid contribution | monthly contribution on middle trading day |
| Last contribution | monthly contribution on last trading day |
| Top3 | same shell, Top3 basket |
| Top7 | same shell, Top7 basket |

## Sell/rebalance rule

The sell/rebalance rule is unchanged from the current branch:

- scheduled quarterly rebalance;
- retain valid winners when allowed by the board-score retention rule;
- sell invalid/dropped holdings on rebalance;
- perform retained-cap trims and trailing-profit trims only from account state and price path observed so far;
- allow a post-trim same-day redeploy only through the 12.5% observed cash/equity gate.

## Result

Generated evidence:

- [062-cashgate125-robustness-results.csv](062-cashgate125-robustness-results.csv)
- [062-cashgate125-robustness-deltas.csv](062-cashgate125-robustness-deltas.csv)
- [062-cashgate125-robustness-generated.md](062-cashgate125-robustness-generated.md)

Summary:

| Account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | Final equity | Trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Cap20 baseline | 77.22% | 1001.09% | 43.64% | 27.47% | 1.1956 | 1.8570 | 715.1M | 136 |
| CashGate 12.5 | 78.27% | 1031.39% | 44.30% | 27.47% | 1.2061 | 1.8713 | 732.8M | 138 |
| CashGate 12.5 Slip25 | 76.72% | 975.12% | 43.33% | 27.75% | 1.1882 | 1.8410 | 706.9M | 140 |
| CashGate 12.5 Slip50 | 74.79% | 898.14% | 42.14% | 27.97% | 1.1664 | 1.8056 | 675.7M | 138 |
| Mid contribution | 78.20% | 1039.55% | 43.83% | 28.44% | 1.1964 | 1.8743 | 720.0M | 137 |
| Last contribution | 79.06% | 1061.30% | 43.95% | 27.32% | 1.1903 | 1.8758 | 723.4M | 140 |
| Top3 | 65.60% | 626.20% | 36.48% | 29.10% | 0.9833 | 1.5219 | 543.2M | 101 |
| Top7 | 62.11% | 611.75% | 34.36% | 27.33% | 1.0370 | 1.5751 | 499.2M | 179 |
| All-Weather | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |
| KODEX200 | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| QQQ | 28.15% | 219.27% | 14.61% | 18.56% | 0.6643 | 0.9455 | 212.3M | 65 |

Daily delta versus CashGate 12.5:

| Variant | Final delta | Positive days | Min delta | Max delta |
| --- | ---: | ---: | ---: | ---: |
| Cap20 baseline | -17.8M | 0.14% | -18.1M | 0.5M |
| Slip25 | -26.0M | 5.21% | -26.5M | 0.1M |
| Slip50 | -57.1M | 0.00% | -58.3M | -0.0M |
| Mid contribution | -12.9M | 24.68% | -14.6M | 0.6M |
| Last contribution | -9.4M | 2.35% | -11.6M | 0.6M |
| Top3 | -189.7M | 4.78% | -211.2M | 0.7M |
| Top7 | -233.6M | 0.29% | -233.6M | 0.1M |

## Retrospective

CashGate 12.5 remains the base-cost branch best, but the evidence is more cautious than Iteration 061 alone suggested.

What held:

- It still beats All-Weather, KODEX200, and QQQ by a wide margin.
- Contribution timing does not invalidate the rule.
- The base-cost result improves final equity by 17.8M KRW over the Cap20 baseline without increasing MDD.

What failed:

- 25 bps and 50 bps slippage variants trail the Cap20 baseline, so this edge is execution-cost sensitive.
- Top3 and Top7 are not viable replacements. The edge is still a Top5 construction, not a generic Top-N formula.
- The higher MWR from last-day contribution is cash-flow timing, not a better absolute wealth path; final equity is still lower than the canonical first-trading-day account.

Conclusion:

Keep `redeploycash125` as the current branch best, but do not widen it into a final strategy claim yet. Treat it as a live research leader with a known cost-sensitivity boundary.

Verification commands:

```powershell
uv run --locked ruff format --check src/snusmic_pipeline/sim/contracts.py tests/sim/test_contracts.py
uv run --locked ruff check src/snusmic_pipeline/sim/contracts.py tests/sim/test_contracts.py
uv run --locked pytest tests/sim/test_contracts.py tests/sim/test_accounts.py -q
pnpm --dir apps/web artifact:check
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
```

## Next mutation

The next useful loop should reduce cost sensitivity instead of increasing complexity:

1. Turnover-aware redeploy: only redeploy trim cash when the candidate would remain Top5 under a minimum score margin.
2. Partial redeploy: redeploy only half of eligible trim cash, leaving a cash buffer after large winner trims.
3. Basket attribution: isolate the 2025-02-24 redeploy basket and test whether one symbol created the whole benefit.
4. Execution realism: compare market-on-close, next-open proxy, and delayed one-day execution if the data supports it without future reference.
