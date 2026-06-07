# Data Artifact Policy

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
`export-web --check`와 `apps/web`의 `artifact:check`는 `reports.json`, `missing-symbols.json`, `manifest.json`, `data/web/prices/*.json`의 cross-reference를 검증해야 합니다. 모든 report/missing symbol은 대응 price artifact를 가져야 하고, report symbol의 `missing_price=true` artifact는 `missing-symbols.json`에 기록된 symbol에만 허용됩니다. 동일한 6자리 KRX ticker가 `.KS`와 `.KQ` 양쪽 price artifact로 동시에 export되면 segment resolver 오류로 보고 실패해야 합니다.
대량 data refresh workflow는 `refresh-web-artifacts`/`rebuild-web-artifacts` 단계에서 checked exporter를 호출해야 하며, 이 검증이 실패한 artifact는 commit/push 단계로 넘어가면 안 됩니다.
`data/web/health.json`은 현재 artifact snapshot의 report/price/simulation 기준일 정렬과 missing-price coverage 상태를 공개하는 운영 health artifact입니다. 각 check는 `ok | review | stale | fail` severity, observed/expected/action을 포함해야 합니다. `review`는 UI 경고로 통과하지만, `stale`/`fail`은 `artifact:check`에서 배포 차단으로 처리합니다. 이 파일은 `manifest.json`에 포함되어 checksum 검증을 받아야 하며, web shell의 Data Status는 이 값을 그대로 표시해야 합니다.
`data/web/report-health.json`은 240개 원천 리포트 전체의 전사/추출 상태, 웹 노출 여부, 제외 사유, 다음 조치를 보존합니다. 리포트가 `reports.json`에 없을 때는 이 artifact에서 `web_exclusion_reason`을 먼저 확인해야 합니다. `missing-symbols.json`은 symbol뿐 아니라 company/report_id/category/action을 함께 보존해 상장폐지, provider gap, mapping 보정 대기 상태를 구분해야 합니다.

Frontend code는 가능한 한 page-shaped artifact 또는 view model을 소비해야 합니다. 화면에 새 metric이 필요하면 table/chart component 내부에서 product semantics를 다시 계산하지 말고 Python exporter 또는 typed page view model에 추가합니다.
