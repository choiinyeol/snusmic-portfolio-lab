# 052 TrailTrim25Cap25 Volatility Target

## Idea

Iteration 049-051 promoted `TrailTrim25Cap25` as the absolute-return leader. The remaining concern is risk: MDD is still 27.47%, so test whether the existing trailing-volatility exposure control can reduce drawdown without destroying the edge.

This is deliberately a parameter-only mutation. No new signal formula, no new sell reason, and no post-hoc stock labels are introduced.

## Point-in-time contract

- Selection still uses the existing PIT report board.
- Retention uses `board_score`.
- New slots use `candidate_score`.
- Volatility scaling uses only trailing daily account returns available before each sizing decision.
- No current/future return, target-hit outcome, final high, or post-window classification is used for buy/sell decisions.

## Buy rule

Same as the current leader:

- Quarterly rebalance.
- `top_n=5`.
- `max_report_age_days=540`.
- Require MA stack and at most 20% below the 52-week high.
- Keep retained holdings by `board_score`.
- Fill newly opened slots by `candidate_score`.

Variants add only:

- `volatility_target_annual=0.45`
- `volatility_target_annual=0.50`
- `volatility_target_annual=0.55`

## Sell/rebalance rule

Same as the current leader:

- Keep winners running instead of mechanically selling back to equal weight.
- Weekly retained-winner cap: if weight exceeds 45% and unrealized return is at least +60%, trim toward 40%.
- Trailing profit trim: after a holding is at least +100% unrealized, if it falls 25% from its observed holding-period high, trim down toward a 25% account weight.
- Existing rank-exit and minimum-holding constraints remain unchanged.

## Result

Generated report: [052-trailtrim25cap25-volatility-target-generated.md](052-trailtrim25cap25-volatility-target-generated.md)

| account | MWR | CAGR | MDD | Sharpe | Sortino | final equity | delta vs leader |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| TrailTrim25Cap25 Vol45 | 75.62% | 42.65% | 27.01% | 1.2029 | 1.8588 | 689.0M | -24.2M |
| TrailTrim25Cap25 Vol50 | 76.34% | 43.10% | 27.17% | 1.2037 | 1.8622 | 700.6M | -12.6M |
| TrailTrim25Cap25 Vol55 | 76.52% | 43.21% | 27.18% | 1.2018 | 1.8618 | 703.5M | -9.7M |
| TrailTrim25Cap25 | 77.10% | 43.57% | 27.47% | 1.1925 | 1.8528 | 713.2M | baseline |
| Clean Mixed Entry | 76.66% | 43.30% | 27.47% | 1.1847 | 1.8393 | 705.8M | -7.4M |
| KODEX200 | 44.62% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | -389.5M |
| All-Weather | 32.30% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | -476.9M |

Vol50 has the best Sharpe/Sortino among the three volatility-target variants, but it gives up 12.6M KRW final equity and only lowers MDD by 0.30 percentage points versus the current leader.

## Retrospective

This is useful defensive evidence, but not enough to replace the current default. The old Fresh540 branch benefited more from volatility targeting because the exposure control removed a larger drawdown pocket. In the current TrailTrim25Cap25 branch, the weekly cap and trailing partial trim already absorb some of that risk, so trailing-volatility sizing mostly reduces upside.

The practical conclusion:

- Absolute-return default stays `TrailTrim25Cap25`.
- `Vol50` is a risk-adjusted sibling if a UI wants a calmer variant.
- Do not keep tuning 45/50/55/60 volatility targets; the marginal MDD improvement is too small.

## Next mutation

Move away from exposure knobs. The next useful branch should test a rule that changes which positions are held, not only how hard the same positions are sized. Candidate directions:

1. holding-period-aware trim cooldown after a trailing profit trim,
2. realized-loss discipline after repeated stop-loss exits by the same report age bucket,
3. sector/country concentration caps if the artifact layer can supply those fields without manual labels.

For the immediate next loop, prefer fill/path diagnostics over another parameter sweep.

## Verification

```powershell
uv run --locked ruff format src/snusmic_pipeline/sim/contracts.py tests/sim/test_contracts.py
uv run --locked pytest tests/sim/test_contracts.py -q
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline research-report --sim data/sim --accounts pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_vol45_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_vol50_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_vol55_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5,benchmark_kodex200,all_weather --baseline pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5 --title "052 TrailTrim25Cap25 Volatility Target" --out docs/research/iterations/052-trailtrim25cap25-volatility-target-generated.md
```
