# Backtest Contract

Last updated: 2026-05-23
Status: canonical simulation contract

## Purpose

Every strategy must be replayed as an investable account, not as a loose vector-return score. The contract below is the boundary for `snusmic_pipeline.sim`.

## Account Rules

| Item | Contract |
| --- | --- |
| Initial capital | KRW 10,000,000 unless explicitly configured. |
| Contributions | Monthly step-up contributions are part of the ledger. |
| Trades | Integer-share buy and sell orders. |
| Currency | Ledger value is KRW. Native asset prices may be preserved for display. |
| Costs | Fees and sell-side taxes are explicit Pydantic config fields. |
| Cash | Unused cash remains in the account and may earn interest only through an explicit rule. |

## Time Rules

Signals computed using close[t] may only trade at close[t+1] or later. If a same-day fill is intentionally allowed for a publication event, the strategy must document why that event was observable before execution.

Forbidden shortcuts:

- Ranking candidates by future return.
- Buying because a later target hit is already known.
- Selecting only rules that look good after replay without recording the search and validation windows.
- Hiding failed strategies from artifacts while keeping only lucky survivors.

## Strategy Declaration

Before replay, a strategy must declare:

| Field | Required answer |
| --- | --- |
| Hypothesis | What behavior should create edge? |
| Universe | Which SMIC-covered stocks are eligible? |
| Buy rule | How candidates become trades. |
| Sell rule | Stop, target, expiry, trend break, rebalance, or cash need. |
| Sizing | Position cap, cash rule, and fallback behavior. |
| Timing | Data timestamp and execution timestamp. |
| Benchmark | All-Weather and any secondary baseline. |
| Objective | Final equity and MWR first; risk metrics second. |

## Runtime Lanes

Default operation should stay fast and account-realistic.

| Lane | Default | How to enable | Reason |
| --- | --- | --- | --- |
| `daily-forward` | on | normal refresh path | Advances the current core account from checkpoints. |
| `generate-strategies` | manual | explicit command | Regenerates strategy candidates and full simulation artifacts. |
| Future-information oracle | off | `--include-oracle` | Upper-bound baseline, not an investable strategy. |
| Stock-rule search | off | `--stock-persona-top N` inside `generate-strategies` | Expensive exploratory lane; no standalone CLI. |
| PIT research-board rotation | off | `--pit-strategy-top N` | Research helper, not the product's default account. |

## Persona Taxonomy

Benchmarks and strategies must be separated in artifacts and UI.

Benchmarks include All-Weather, SMIC follower baselines, broad market proxies, and Weak Prophet when explicitly enabled. Selectable strategies are broker-ledger strategies generated from declared rules and passed through validation gates.

The frontend must read taxonomy from `data/web/strategies/catalog.json`; it must not infer business meaning from persona IDs.
