# Product Spec

SNUSMIC Portfolio Lab builds point-in-time SMIC report data and static account-report artifacts. It does not search for trading rules, generate candidate accounts, or admit automated accounts.

## Current Product

- Ingest SMIC report metadata, PDFs, extracted targets, ratings, and caveats.
- Normalize the data into a PIT warehouse with report publication dates, price windows, target-hit evidence, and report-level outcome factors.
- Export fixed account baselines and follower accounts so the web app can compare actual account paths.
- Export a PIT research board for manual rule design outside the pipeline.

## Non Goals

- No broker-style rule search.
- No generated account admission.
- No MTT account.
- No hidden migration, rollback, or safety-net path.
- No UI route that presents accounts as personas.

## Objective

The account objective is still simple: compare final equity, money-weighted return, and maximum drawdown against `benchmark_kodex200`. Report-level factor views are diagnostic inputs for human research; they are not deployable rules by themselves.

## Future Rule Work

Future rules must be explicit before implementation:

- Buy condition and execution timing.
- Sell condition, stop loss, take profit, and expiry handling.
- Position sizing and cash policy.
- Rebalancing cadence.
- PIT observability proof for every signal.
