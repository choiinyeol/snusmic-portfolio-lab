# 056 TrailTrim Cap Neighborhood

## Idea

Iteration 055 found that trimming post-entry trailing winners toward a 20% account weight was better than the previous 25% cap. This iteration checks whether 20% is a real local optimum or just a coarse-grid accident by testing nearby caps: 15%, 18%, and 22%.

## Point-in-time contract

The rule uses the same PIT contract as the current leader:

- Rebalance candidates are selected only from report and price state observable on each rebalance date.
- Existing holdings are retained by `board_score`.
- Newly opened slots are filled by `candidate_score`.
- The trailing trim trigger uses only observed holding-period cost, current equity weight, and the holding's realized path-to-date high.
- No future target-hit, outcome label, post-publication return, or realized final result is used for selection.

## Buy rule

Keep the accepted mixed-entry shell:

- quarterly rebalance
- Top 5 portfolio
- maximum report age 540 days
- require moving-average stack
- require no more than 20% below the 52-week high at entry
- retain live winners unless they leave the board-score Top20 or violate existing sell logic
- fill newly opened slots by `candidate_score`

## Sell/rebalance rule

Keep the retained-winner weekly concentration monitor:

- trim retained winners above 45% account weight back toward 40%
- only apply that retained cap after at least +60% unrealized profit

Then compare the trailing-profit trim caps:

- trigger after at least +100% unrealized profit and a 25% drawdown from the observed holding-period high
- trim toward 15%, 18%, 20%, 22%, or 25% account weight

## Result

Generated report: [056-trailtrim-cap-neighborhood-generated.md](056-trailtrim-cap-neighborhood-generated.md)

| account | MWR | CAGR | MDD | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: |
| TrailTrim25Cap15 | 76.12% | 42.96% | 27.47% | 697.0M | 137 |
| TrailTrim25Cap18 | 76.76% | 43.36% | 27.47% | 707.5M | 137 |
| TrailTrim25Cap20 | 77.22% | 43.64% | 27.47% | 715.1M | 136 |
| TrailTrim25Cap22 | 77.09% | 43.57% | 27.47% | 713.0M | 136 |
| TrailTrim25Cap25 | 77.10% | 43.57% | 27.47% | 713.2M | 136 |
| Clean mixed-entry baseline | 76.66% | 43.30% | 27.47% | 705.8M | 131 |

Cap20 remains the local winner. Cap22 and Cap25 are close but trail by about 2.1M and 1.9M KRW. Cap18 trails by 7.6M KRW, and Cap15 trails by 18.1M KRW.

## Retrospective

The useful trim is not "sell more whenever the winner pulls back." Cap15 and Cap18 fire one extra `trailing_profit_trim`, increase trade count, and leave too little capital in long-term compounders. Cap22/25 are less harmful, but they leave slightly too much in the already-pulled-back winner. Cap20 is a narrow but interpretable compromise: enough realized cash to redeploy without gutting the remaining winner.

This confirms Iteration 055's improvement as a local optimum, not just an accident of comparing 20/25/30.

## Next mutation

Stop tuning the cap by one- or two-point increments. The next useful branch should test whether the trigger should require a larger realized winner before allowing the Cap20 trim, for example +120% or +150% unrealized profit, while keeping the 25% drawdown and 20% cap fixed.
