# Product Spec

Last updated: 2026-05-23
Status: canonical product intent

## One Line

SNUSMIC Portfolio Lab tests whether a real account that only buys stocks covered by SMIC reports can beat All-Weather under the same cash-flow schedule.

## User

The user is an individual investor, not an institutional quant desk. They need a defensible, replayable account ledger: what could be bought, when it was bought, why it was sold, and whether the result beat a simple benchmark after costs.

## Core Questions

1. Does an investable SNUSMIC-covered-stock strategy beat All-Weather on final equity and money-weighted return?
2. Which buy, sell, sizing, and cash rules explain the result?
3. Did the strategy obey point-in-time data boundaries?
4. Which failures are useful evidence, and which are just overfit noise?

## Product Model

| Concept | Meaning |
| --- | --- |
| Report | A point-in-time SMIC coverage event for one stock. |
| Pool | Stocks currently eligible because SMIC covered them and they have not expired or failed a rule. |
| Candidate | A pool member that passes today's buy filters. |
| Strategy | Buy, sell, sizing, cash, and fallback rules declared before replay. |
| Ledger | Cash, holdings, trades, realized/unrealized PnL, fees, taxes, and monthly contributions. |
| Benchmark | A comparison account with the same cash-flow basis, especially All-Weather. |

## Success

Primary success is account-level outperformance: final equity and MWR beat All-Weather under the same deposits, dates, costs, and market data.

MDD, win rate, hit rate, and report target achievement are diagnostic metrics. They can explain a strategy, but they must not replace the account objective.

## Non-Goals

- Live trading advice or broker order entry.
- Ranking analysts or grading report authors.
- Choosing stocks with future information.
- Promoting failed experiments by hiding the ledger.
- Building a factor zoo that cannot be explained through account decisions.

## UI Contract

The UI should show the account first, then the reason trail:

1. Final equity, MWR, excess return versus All-Weather.
2. Current holdings, cash, recent buys, recent sells, and reasons.
3. Strategy rules and parameters.
4. Candidate pool and report lineage.
5. Failed experiments only when they teach something concrete.
