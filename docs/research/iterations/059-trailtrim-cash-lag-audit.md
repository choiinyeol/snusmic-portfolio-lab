# 059 TrailTrim Cash-Lag Audit

## Idea

Iteration 058 rejected blanket same-day redeployment after every `trailing_profit_trim`. Before testing another redeployment rule, audit whether trim proceeds actually sit idle long enough to be a meaningful bottleneck.

The practical question is narrower:

> When a trailing trim creates cash, does waiting until the next scheduled rebalance cost enough to justify a new selective redeployment rule?

## Point-in-time contract

This is an audit, not a new trading rule. It uses only the already generated point-in-time account path:

- `data/sim/trades.csv`
- `data/sim/equity_daily.csv`
- current best account path
- the same-day redeploy comparison path from Iteration 058

No future outcome is fed back into a live decision. The audit looks backward only to decide whether a future mutation is worth testing.

## Buy rule

No new buy rule is introduced.

The audited account remains:

- `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5`

The comparison account remains:

- `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploy_top5`

## Sell/rebalance rule

No new sell rule is introduced.

The audit inspects the five `trailing_profit_trim` fills in the current best account and measures:

- trim date and symbol
- gross trim proceeds
- cash after trim
- cash as a share of same-day equity
- trading days until the next buy
- equity delta versus the same-day redeploy variant over that waiting window

## Result

Current best account had five trailing-profit trims.

| trim date | symbol | gross trim | cash after | cash / equity | idle trading days before next buy | next buy date |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 2023-08-07 | `007660.KS` | 6.1M | 7.6M | 12.01% | 39 | 2023-10-02 |
| 2023-08-28 | `007660.KS` | 0.2M | 7.8M | 12.40% | 24 | 2023-10-02 |
| 2025-02-24 | `PLTR` | 23.8M | 26.0M | 14.94% | 25 | 2025-04-01 |
| 2025-03-21 | `PLTR` | 0.3M | 28.3M | 15.99% | 6 | 2025-04-01 |
| 2025-03-27 | `PLTR` | 1.2M | 29.5M | 17.43% | 2 | 2025-04-01 |

Same-day redeployment did not convert these idle windows into a better final path.

| window | redeploy delta at window end | min delta | max delta |
| --- | ---: | ---: | ---: |
| 2023-08-07 -> 2023-10-02 | -2.2M | -6.5M | 2.3M |
| 2023-08-28 -> 2023-10-02 | -2.2M | -6.5M | 1.0M |
| 2025-02-24 -> 2025-04-01 | -0.1M | -5.0M | 6.9M |
| 2025-03-21 -> 2025-04-01 | -0.1M | -5.0M | 1.2M |
| 2025-03-27 -> 2025-04-01 | -0.1M | -0.8M | 1.2M |

The 2023 redeploy windows are clearly worse by the next scheduled rebalance. The 2025 PLTR windows briefly show large upside, but by the next scheduled rebalance the advantage nearly disappears and the full-path final delta remains negative.

Iteration 058 final delta still controls the replacement decision:

| comparison | value |
| --- | ---: |
| same-day redeploy final equity delta | -0.3M |
| current best trades | 136 |
| same-day redeploy trades | 145 |

## Retrospective

Cash lag exists, but it is not automatically bad. The account sometimes holds 12-17% cash after trims for 2-39 trading days, yet forcing that cash back into the PIT Top5 immediately fails to improve the path.

The 2023 `007660.KS` trim is the warning case: same-day redeployment created a meaningfully worse equity delta by the next scheduled rebalance. The 2025 `PLTR` trim sequence is more ambiguous, but even there the next-rebalance delta is close to flat, not a clear win.

This closes the simple redeployment branch. The current best rule is not leaving a large obvious cash-drag leak. The trim is more valuable as a risk-and-concentration release than as a mandatory buy signal.

## Next mutation

Do not test another blanket redeployment rule.

The next useful branch should move away from trim proceeds and inspect whether the portfolio should separate two modes:

- a high-conviction five-name book for normal periods
- a temporary cash reserve after large winner drawdowns, unless the next scheduled rebalance has unusually strong PIT candidates

If this becomes a strategy mutation, the gate must be observable on the decision date, for example:

- only redeploy trim cash when the next candidate's PIT score is above the current portfolio median
- only redeploy when cash exceeds 15% and the candidate is within 10% of its 52-week high
- otherwise wait for the scheduled quarterly rebalance

The audit does not yet justify implementing that selective gate. It only says the blanket version is dead.
