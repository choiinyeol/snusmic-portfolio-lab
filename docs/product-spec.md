# Product Spec

SNUSMIC Portfolio Lab builds point-in-time SMIC report data and static account-report artifacts. The current release includes a completed PIT strategy research sprint, but generated branches are research records first; only a curated shortlist is surfaced as portfolio ledgers.

## Current Product

- Ingest SMIC report metadata, PDFs, extracted targets, ratings, and caveats.
- Normalize the data into a PIT warehouse with report publication dates, price windows, target-hit evidence, and report-level outcome factors.
- Export benchmark, follower, and curated PIT account paths so the web app can compare actual account ledgers.
- Export a PIT research board and strategy-research notes for manual review of every promoted idea.
- Provide a single report verification board for sorting, filtering, and drilling into report evidence.
- Provide report statistics that explain target-hit rate, peak return concentration, fine return buckets, outcome buckets, and representative price paths.
- Provide portfolio ledgers with selected account, benchmark curves, holdings, trades, realized/unrealized PnL, win rate, payoff ratio, and cash/RP shown as one ledger.

## Web Product Surfaces

- `/`: current report verification and report board.
- `/reports`: report table for sorting, filtering, and drilling into one report.
- `/reports/[symbol]/[reportId]`: report evidence detail.
- `/calendar`: date-based research calendar for seeing which report candidates were visible on each historical observation date and how they later audited.
- `/statistics`: outcome statistics and price-path diagnostics.
- `/portfolio`: curated account catalogue and account drilldowns.

## Non Goals

- No live broker integration or order entry.
- No future-looking signals in PIT rules.
- No automatic admission of every generated research account.
- UI account routes describe declared account rules and account taxonomy.

## Objective

The account objective is still simple: compare final equity, money-weighted return, maximum drawdown, and trade quality against declared benchmark accounts in the static artifacts. Report-level factor views are diagnostic inputs for human research; they are not deployable rules by themselves. Product screens should guide the user toward what to inspect next rather than exposing raw artifact rows without hierarchy.

## Current Curated Accounts

| Display name | Role |
| --- | --- |
| Partial 75 | Current local-return candidate; quarterly PIT Trend Top5, retained winners, trailing trim, 12.5% cash gate, 75% redeploy. |
| CashGate 12.5 | Robustness baseline for the redeploy gate. |
| TrailTrim 20 | Simpler trailing-trim baseline before cash redeploy. |
| Trend Top5 | Simple PIT trend-score Top5 reference. |
| Score Top5 | Simple PIT score Top5 reference. |
| SMIC Follower | Report-follower baseline. |

## Future Rule Work

Future rules must be explicit before implementation:

- Buy condition and execution timing.
- Sell condition, stop loss, take profit, and expiry handling.
- Position sizing and cash policy.
- Rebalancing cadence.
- PIT observability proof for every signal.
