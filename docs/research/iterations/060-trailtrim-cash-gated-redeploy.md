# 060 TrailTrim Cash-Gated Redeploy

## Idea

Iteration 058 showed that redeploying after every trailing-profit trim is too blunt. Iteration 059 showed why: some trims leave only about 12% cash, and forcing those proceeds back into the book hurt the 2023 path.

This iteration tests a narrower rule:

> After a trailing-profit trim, redeploy on the same day only if cash is at least 15% of account equity.

The rule keeps the useful part of the redeploy idea while skipping smaller trim-cash events.

## Point-in-time contract

The rule uses only state observable on the decision date:

- current account cash
- current marked account equity
- already observed holding-period high and drawdown for the trimmed position
- existing PIT report board and price history
- the same entry/retention score fields used by the current best account

It does not use future returns, future target hits, future report outcomes, or realized post-redeploy performance.

## Buy rule

Base account:

- quarterly Top5
- max report age 540 days
- MA stack required
- no more than 20% below 52-week high at entry
- retain existing holdings by `board_score`
- fill opened slots by `candidate_score`
- let winners run instead of mechanically selling down to equal weight

New 060 mutation:

- if `trailing_profit_trim` fires and post-trim cash / equity is at least 15%, allow same-day rebalance and buy eligible PIT candidates immediately
- if cash / equity is below 15%, wait for the next scheduled rebalance

## Sell/rebalance rule

Same as the current best account:

- scheduled quarterly rebalance
- retain valid winners inside the rank band
- weekly retained-position cap monitor
- cap retained winners only after weight exceeds 45% and unrealized return is at least +60%
- trailing partial trim after +100% unrealized return and a 25% drawdown from observed holding-period high
- trailing trim target weight: 20%

The only new sell/rebalance behavior is the 15% cash gate for same-day redeployment after a trailing trim.

## Result

Generated comparison: [060-trailtrim-cash-gated-redeploy-generated.md](060-trailtrim-cash-gated-redeploy-generated.md)

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Current `TrailTrim25Cap20` | 77.22% | 1001.09% | 43.64% | 27.47% | 1.1956 | 1.8570 | 715.1M | 136 |
| Blanket same-day redeploy | 77.20% | 990.18% | 43.63% | 27.47% | 1.1977 | 1.8552 | 714.8M | 145 |
| Cash-gated redeploy 15% | 77.77% | 1016.72% | 43.99% | 27.47% | 1.2026 | 1.8676 | 724.4M | 142 |
| Prior `TrailTrim25Cap25` | 77.10% | 996.50% | 43.57% | 27.47% | 1.1925 | 1.8528 | 713.2M | 136 |
| Clean mixed-entry baseline | 76.66% | 982.30% | 43.30% | 27.47% | 1.1847 | 1.8393 | 705.8M | 131 |
| KODEX200 | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| All Weather | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

Daily delta versus the previous best:

| comparison | value |
| --- | ---: |
| final delta | +9.3M |
| positive days | 21.47% |
| min daily delta | -3.1M |
| max daily delta | +9.5M |

Trade reason comparison:

| account | rebalance_buy | rebalance_sell | retained_cap_trim | trailing_profit_trim |
| --- | ---: | ---: | ---: | ---: |
| Current `TrailTrim25Cap20` | 69 | 59 | 3 | 5 |
| Blanket same-day redeploy | 76 | 64 | 3 | 2 |
| Cash-gated redeploy 15% | 74 | 61 | 3 | 4 |

Path inspection:

- 2023 `007660.KS` trims did not redeploy because cash stayed near 12%.
- 2025-02-24 `PLTR` trim did not redeploy because cash was just under 15%.
- 2025-03-21 `PLTR` trim did redeploy after cash rose above 15%.
- The cash-gated path was briefly worse by about 3.1M KRW, then recovered and finished 9.3M KRW ahead.

## Retrospective

Accepted as the new branch best, pending robustness checks.

The 15% cash gate fixes the main flaw from Iteration 058. It avoids the weaker 2023 same-day redeployment windows while still allowing the larger 2025 PLTR cash event to re-enter the PIT book before the next scheduled quarter. It improves MWR, TWR, CAGR, Sharpe, Sortino, and final equity without raising MDD.

This is a better rule shape than blanket redeployment because it has a real operational interpretation: small trim proceeds can wait; a large cash reserve after a major winner drawdown can be redeployed if the same PIT selection rules still find candidates.

The result is path-sensitive. It should not be promoted as final until tested for cash-gate thresholds and friction.

## Next mutation

Run robustness checks around the accepted 15% gate:

- cash gate neighborhood: 13%, 15%, 17%, 20%
- slippage 25/50 bps
- contribution timing
- Top3/Top7 under the same cash-gated redeploy rule

If the 15% gate survives, promote it as the current implementation candidate and surface the rule in the portfolio method copy.
