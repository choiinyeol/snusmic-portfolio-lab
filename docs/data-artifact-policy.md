# Data Artifact Policy

The repository is a PIT data product, not an account-generation factory. Committed artifacts must either be source evidence, normalized PIT inputs, fixed account outputs, or static web deploy inputs.

| Path | Owner | Commit policy |
| --- | --- | --- |
| `data/reports/**` | Report ingestion | Source evidence; keep while report extraction depends on it. |
| `data/warehouse/*.csv` | PIT warehouse | Commit normalized report, price, FX, and benchmark inputs. |
| `data/sim/account-configs.json` | Simulation contract | Commit the declared fixed accounts. |
| `data/sim/pit-research-board.csv` | PIT research export | Commit the manual research board. |
| `data/sim/*.csv` except checkpoint/cache paths | Simulation export | Commit current fixed-account outputs consumed by web exports. |
| `data/web/**` | Web artifact exporter | Commit static deploy artifacts validated by the web app. |
| `data/web/pages/**` | Web artifact exporter | Commit page-shaped bundles used by frontend view models. |
| `data/web/report-board/**` | Web artifact exporter | Commit report-board payloads while they are consumed by the report board. |
| `apps/web/public/downloads/*.csv` | Web artifact exporter | Commit downloadable mirrors of the current web tables. |
| `data/sim/checkpoints/**` | Daily-forward runner | Do not commit. This is a replay cache. |
| `data/sim/.cache/**` | Local tooling | Do not commit. |

Large artifact reductions must update both producer and consumer contracts before deleting deploy inputs. In particular, per-symbol `data/web/prices/*.json` files stay committed until the frontend reader and artifact validator accept a compact price store.

Frontend code should consume page-shaped artifacts or view models where possible. If a screen needs a new metric, add it to the Python exporter or a typed page view model instead of deriving product semantics directly inside table or chart components.
