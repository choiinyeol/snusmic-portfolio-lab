# Product Spec

SNUSMIC Portfolio Lab builds point-in-time SMIC report data and static account-report artifacts. The current release includes a completed PIT strategy research sprint, but generated branches are research records first; only a curated shortlist is surfaced as portfolio ledgers.

### Current Product

- Ingest SMIC report metadata, PDFs, extracted targets, ratings, and caveats.
- Normalize the data into a PIT warehouse with report publication dates, price windows, target-hit evidence, and report-level outcome factors.
- Export benchmark, follower, and curated PIT account paths so the web app can compare actual account ledgers.
- Export a PIT research board and strategy-research notes for manual review of every promoted idea.
- Provide report verification, statistics, and portfolio ledger screens through static artifacts.

### Non Goals

- No live broker integration or order entry.
- No future-looking signals in PIT rules.
- No automatic admission of every generated research account.

### Objective

The account objective is to compare final equity, money-weighted return, maximum drawdown, and trade quality against declared benchmark accounts in the static artifacts. Report-level factor views are diagnostic inputs for human research; they are not deployable rules by themselves.
