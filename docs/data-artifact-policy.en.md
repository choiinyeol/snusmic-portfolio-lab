# Data Artifact Policy

The repository is a PIT data product, not an account-generation factory. Committed artifacts must be source evidence, normalized PIT inputs, fixed account outputs, or static web deploy inputs.

| Path | Owner | Commit policy |
| --- | --- | --- |
| `data/reports/**` | Report ingestion | Source evidence; keep while report extraction depends on it. |
| `data/warehouse/*.csv` | PIT warehouse | Commit normalized report, price, FX, and benchmark inputs. |
| `data/sim/account-configs.json` | Simulation contract | Commit the declared fixed accounts. |
| `data/sim/accounts.json` | Simulation export manifest | Commit a compact manifest only; full ledger dumps belong in CSV artifacts, local cache, release assets, or LFS. |
| `data/sim/pit-research-board.csv` | PIT research export | Commit the manual research board. |
| `data/sim/*.csv` except checkpoint/cache paths | Simulation export | Commit current fixed-account outputs consumed by web exports. |
| `data/web/**` | Web artifact exporter | Commit static deploy artifacts validated by the web app. Large account time series must be sharded by account and limited to curated web accounts. |
| `data/sim/checkpoints/**` | Daily-forward runner | Do not commit. This is a replay cache. |
| `data/sim/.cache/**` | Local tooling | Do not commit. |

Large artifact reductions must update both producer and consumer contracts before deleting deploy inputs. Portfolio equity and daily-decision data are exported as account shards; aggregate `equity-daily.json` and `daily-decisions.json` files are not web deploy inputs.
`export-web --check` and the web app `artifact:check` must validate cross-references across `reports.json`, `missing-symbols.json`, `manifest.json`, and `data/web/prices/*.json`. Every report/missing symbol needs a matching price artifact. A report symbol may only have a `missing_price=true` artifact when it is also listed in `missing-symbols.json`. If one raw six-digit KRX ticker exports both `.KS` and `.KQ` price artifacts, treat it as a segment-resolution error and fail the gate.
Bulk data-refresh workflows must call the checked exporter during `refresh-web-artifacts`/`rebuild-web-artifacts`; artifacts that fail this validation must not reach the commit/push step.
`data/web/health.json` is the operational health artifact for the current snapshot's report/price/simulation date alignment and missing-price coverage. It must be listed in `manifest.json`, covered by checksum validation, and displayed directly by the web shell Data Status panel.
