# 054 TrailTrim25Cap25 Cooldown

## Idea

Iteration 053 showed that retention rank bands are inactive on the current path. This iteration tests a real execution-mechanics question: after a trailing partial profit trim fires, should the same symbol be protected from another trim for a short period?

Hypothesis:

- A trim already realizes profit and reduces concentration.
- Repeated trims inside the same drawdown cluster may be unnecessary churn.
- A 20-trading-day cooldown should suppress close repeated trims without touching the PIT entry signal.

## Point-in-time contract

- Entry and retention rankings still use only PIT board data available on each rebalance date.
- The cooldown uses only the account's own prior fill date for the same symbol.
- No future return, target-hit outcome, expiry label, or ex-post winner label is used.

## Buy rule

Same as the current TrailTrim25Cap25 leader:

- quarterly rebalance,
- `top_n=5`,
- report age <= 540 calendar days,
- require MA stack,
- require distance from 52-week high >= -20%,
- retain existing holdings by `board_score`,
- fill new slots by `candidate_score`.

## Sell/rebalance rule

Same as TrailTrim25Cap25, with one added state rule:

- after `trailing_profit_trim`, do not trim the same symbol again for 20 trading days.

All other logic is unchanged:

- no equal-weight sell-down of still-valid winners,
- weekly retained-winner cap,
- trail trim after a +100% observed holding-period peak and 25% drawdown,
- trim toward 25% account weight.

## Result

Generated report: [054-trailtrim25cap25-cooldown-generated.md](054-trailtrim25cap25-cooldown-generated.md)

| account | MWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Cool20 | 77.09% | 43.56% | 27.47% | 1.1923 | 1.8524 | 713.0M | 132 |
| TrailTrim25Cap25 canonical | 77.10% | 43.57% | 27.47% | 1.1925 | 1.8528 | 713.2M | 136 |
| Clean Mixed Entry | 76.66% | 43.30% | 27.47% | 1.1847 | 1.8393 | 705.8M | 131 |
| KODEX200 | 44.62% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| All-Weather | 32.30% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

Cool20 ends 0.2M KRW below the canonical leader. It reduces trailing-profit-trim fills from 5 to 3 and total trades from 136 to 132.

The remaining Cool20 trim fills are:

| date | symbol | qty | realized PnL |
| --- | --- | ---: | ---: |
| 2023-08-07 | 007660.KS | 95 | 1.96M |
| 2025-02-24 | PLTR | 119 | 11.19M |
| 2025-03-27 | PLTR | 14 | 1.34M |

## Retrospective

Rejected as a default replacement, accepted as execution-boundary evidence.

The cooldown does what it is supposed to do mechanically: it suppresses repeated close trims and reduces trade count. But the current strategy path benefits slightly from the repeated trim behavior. The loss is small, yet the evidence is clear enough not to replace the leader.

The useful lesson is that trailing partial trims are not obviously over-churning. The account can tolerate a second trim in the same winner cluster when the position again breaches the cap after a new observed high.

## Next mutation

Do not keep tuning cooldown lengths unless there is a clear risk objective. The absolute-return branch should next test trim cap boundaries or drawdown thresholds around the accepted rule:

- TrailTrim25Cap20,
- TrailTrim25Cap30,
- TrailTrim20Cap25,
- TrailTrim30Cap25.

These change realized profit timing more directly than cooldown.

## Verification

```powershell
uv run --locked ruff format src/snusmic_pipeline/sim/contracts.py src/snusmic_pipeline/sim/accounts/pit_score.py tests/sim/test_contracts.py tests/sim/test_accounts.py
uv run --locked pytest tests/sim/test_accounts.py tests/sim/test_contracts.py -q
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline research-report --sim data/sim --accounts pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_cool20_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5,benchmark_kodex200,all_weather --baseline pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5 --title "054 TrailTrim25Cap25 Cooldown" --out docs/research/iterations/054-trailtrim25cap25-cooldown-generated.md
```
