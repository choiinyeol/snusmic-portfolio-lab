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
### Current shortlisted accounts

| account_id | Label | Role |
| --- | --- | --- |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5` | Partial 75 | Current local-return candidate with trailing trim, 12.5% cash gate, and 75% redeploy. |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5` | CashGate 12.5 | Robustness baseline immediately below Partial 75. |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5` | TrailTrim 20 | Simpler trailing-trim baseline without cash redeploy. |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5` | Candidate Profit60 | Candidate-score entry-order comparison account. |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5` | Profit60 | Board-score weekly-cap/profit-cushion baseline. |
| `pit_trend_top5` | Trend Top5 | Simple PIT trend baseline. |
| `pit_score_top5` | Score Top5 | Simple PIT score baseline. |
| `smic_follower` | SMIC Follower | Report-follower baseline. |
| `pit_momentum_1m3m_top5`, `pit_momentum_3m6m_top5`, `pit_momentum_6m12m_top5`, `pit_mtt_rs70_top5`, `pit_mtt_rs80_top5`, `pit_mtt_rs90_top5`, `pit_mtt_low100_top5`, `pit_mtt_low300_top5` | Momentum / MTT variants | Product-visible momentum/MTT representative comparison set. |

The shortlist is curated. Research-only branches may stay in notes and generated artifacts, but they do not automatically become product-visible accounts.
