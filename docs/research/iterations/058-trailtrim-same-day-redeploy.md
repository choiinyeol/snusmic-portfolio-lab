# 058 TrailTrim Same-Day Redeploy

## Idea

Iteration 055 accepted `TrailTrim25Cap20` as the current absolute-return leader. It trims very large winners only after they have doubled and then fallen 25% from the observed holding-period high, bringing the position down toward a 20% account weight.

One possible weak point is cash drag after a trailing trim. In the current path, a trim can happen on a non-rebalance day, and the released cash waits until the next scheduled rebalance. This iteration tests whether the account should immediately redeploy that cash into the same point-in-time Top5 construction.

## Point-in-time contract

The redeploy variant does not use future prices, future report outcomes, target-hit labels, or realized post-entry returns. On each decision date, it can only use:

- reports already published by that date
- prices observed up to that date
- the account's own holdings, cost basis, cash, and observed holding-period highs
- the same candidate ranking fields already available to the canonical mixed-entry rule

The only new mechanic is operational: if a `trailing_profit_trim` fires, the day is allowed to rebalance immediately under the existing PIT candidate universe.

## Buy rule

Use the same buy rule as the current best account:

- quarterly Top5 account
- maximum report age: 540 days
- require MA stack and 52-week-high proximity gate
- retain still-valid winners by `board_score`
- fill newly opened slots by `candidate_score`
- equal-weight new entries subject to the existing retained-winner and cap mechanics

For the redeploy variant, a same-day rebalance is additionally allowed immediately after a trailing-profit trim.

## Sell/rebalance rule

Base rule:

- quarterly scheduled rebalance
- retain valid winners instead of mechanically selling down to equal weight
- weekly retained-position cap monitor
- retained cap trim when weight exceeds 45%, profit cushion is at least +60%, and the trim target is 40%
- trailing-profit trim after at least +100% unrealized return and a 25% drawdown from the observed holding-period high
- trim target after trailing-profit trigger: 20% account weight

New variant:

- if a trailing-profit trim fires, trigger same-day redeployment of released cash into eligible PIT candidates

## Result

Generated comparison: [058-trailtrim-same-day-redeploy-generated.md](058-trailtrim-same-day-redeploy-generated.md)

| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Current `TrailTrim25Cap20` | 77.22% | 1001.09% | 43.64% | 27.47% | 1.1956 | 1.8570 | 715.1M | 136 |
| Same-day redeploy | 77.20% | 990.18% | 43.63% | 27.47% | 1.1977 | 1.8552 | 714.8M | 145 |
| Prior `TrailTrim25Cap25` | 77.10% | 996.50% | 43.57% | 27.47% | 1.1925 | 1.8528 | 713.2M | 136 |
| Clean mixed-entry baseline | 76.66% | 982.30% | 43.30% | 27.47% | 1.1847 | 1.8393 | 705.8M | 131 |
| KODEX200 | 44.62% | 203.93% | 23.95% | 19.90% | 1.0046 | 1.3062 | 323.7M | 65 |
| All Weather | 32.30% | 215.48% | 16.91% | 9.46% | 1.1374 | 1.6634 | 236.3M | 186 |

Daily delta versus the current best:

| account | final delta | positive days | min daily delta | max daily delta |
| --- | ---: | ---: | ---: | ---: |
| Same-day redeploy | -0.3M | 1.93% | -6.5M | 6.9M |

Trade reason comparison:

| account | rebalance_buy | rebalance_sell | retained_cap_trim | trailing_profit_trim |
| --- | ---: | ---: | ---: | ---: |
| Current `TrailTrim25Cap20` | 69 | 59 | 3 | 5 |
| Same-day redeploy | 76 | 64 | 3 | 2 |

## Retrospective

Rejected as a replacement. Same-day redeployment does not repair a real bottleneck. It increases trades from 136 to 145, slightly reduces final equity by about 0.3M KRW, and does not improve MDD. Sharpe ticks up narrowly, but Sortino slips and the absolute-return leader remains unchanged.

The path also changes the later trim sequence: the redeploy variant records only two `trailing_profit_trim` fills versus five in the current best. That suggests immediate redeployment changes subsequent account state enough to alter later trim eligibility, but not in a profitable way.

The lesson is useful: post-trim cash drag is not obviously the reason this branch wins or loses. Forced immediate buying adds churn; the better next question is whether trim-day cash actually waits long enough to matter, and whether only selected trim events deserve redeployment.

## Next mutation

Run a cash-lag audit around `trailing_profit_trim` fills:

- how much cash was created by each trim
- how many trading days it remained idle
- what the next scheduled rebalance bought
- whether the forgone candidate subsequently beat the held cash window

Only after that audit should a selective redeploy rule be tested. A blanket same-day redeploy is rejected.
