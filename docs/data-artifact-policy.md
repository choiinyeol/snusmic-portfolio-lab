# Data Artifact Policy

## 한국어

이 저장소는 PIT 데이터 제품이지, 계좌 생성 factory가 아닙니다. 커밋되는 artifact는 source evidence, 정규화된 PIT input, 고정 계좌 output, 정적 web deploy input 중 하나여야 합니다.

| Path | Owner | Commit policy |
| --- | --- | --- |
| `data/reports/**` | Report ingestion | report extraction이 의존하는 동안 source evidence로 유지합니다. |
| `data/warehouse/*.csv` | PIT warehouse | 정규화된 report, price, FX, benchmark input을 커밋합니다. |
| `data/sim/account-configs.json` | Simulation contract | 선언된 fixed account 목록을 커밋합니다. |
| `data/sim/accounts.json` | Simulation export manifest | compact manifest만 커밋합니다. full ledger dump는 GitHub 제한을 넘기 쉬우므로 CSV artifact, local cache, release asset, LFS에 둡니다. |
| `data/sim/pit-research-board.csv` | PIT research export | 수동 research board를 커밋합니다. |
| `data/sim/*.csv` except checkpoint/cache paths | Simulation export | web export가 소비하는 현재 fixed-account output을 커밋합니다. full exploratory dump는 browser payload가 아니며 local cache, release asset, LFS에 둡니다. |
| `data/web/**` | Web artifact exporter | web app이 검증하는 static deploy artifact를 커밋합니다. 큰 account time series는 account별 shard로 나누고 curated web account로 제한합니다. |
| `data/web/pages/**` | Web artifact exporter | frontend view model이 쓰는 page-shaped bundle을 커밋합니다. |
| `data/web/report-board/**` | Web artifact exporter | report board가 소비하는 동안 report-board payload를 커밋합니다. |
| `apps/web/public/downloads/*.csv` | Web artifact exporter | 현재 web table의 다운로드 mirror를 커밋합니다. |
| `data/sim/checkpoints/**` | Daily-forward runner | 커밋하지 않습니다. replay cache입니다. |
| `data/sim/.cache/**` | Local tooling | 커밋하지 않습니다. |

큰 artifact를 줄일 때는 deploy input을 삭제하기 전에 producer와 consumer contract를 함께 갱신해야 합니다. Portfolio equity와 daily-decision data는 `data/web/portfolio/equity/{index,ACCOUNT_ID}.json` 및 `data/web/portfolio/daily-decisions/{index,ACCOUNT_ID}.json`로 export합니다. Aggregate `equity-daily.json`과 `daily-decisions.json`은 web deploy input이 아닙니다. Per-symbol `data/web/prices/*.json`은 frontend reader와 artifact validator가 compact price store를 받을 때까지 커밋 상태를 유지합니다.

Frontend code는 가능한 한 page-shaped artifact 또는 view model을 소비해야 합니다. 화면에 새 metric이 필요하면 table/chart component 내부에서 product semantics를 다시 계산하지 말고 Python exporter 또는 typed page view model에 추가합니다.

## English

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
