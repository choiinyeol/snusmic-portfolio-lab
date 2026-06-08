# v1.0.0 Release Criteria

SNUSMIC Portfolio Lab의 `v1.0.0`은 단순 버전 숫자가 아니라, PIT 데이터 제품과 정적 포트폴리오 리더의 **공개 계약을 동결할 준비가 됐다는 선언**입니다.

## 목적

이 문서는 다음을 고정합니다.

1. `v1.0.0`에서 무엇을 제품으로 약속하는가
2. RC1에서 어떤 artifact/reader/validator surface를 freeze 하는가
3. product shortlist를 어떤 source of truth로 다루는가
4. external shard mode를 어떤 조건에서 허용하는가
5. 최종 release gate가 무엇을 증명해야 하는가

## 1. 제품 선언

`v1.0.0`의 제품은 다음으로 한정합니다.

- point-in-time SMIC 리포트 데이터 수집/정규화
- static web artifact export
- curated shortlist 기반 portfolio/account surface
- report verification / statistics / research calendar / accounting reconciliation
- local-first static deploy, optional external shard support

비제품/비목표:

- live broker integration
- live market API
- 자동 research branch promotion
- future-looking signal
- backend query service를 전제로 한 화면 동작

## 2. RC1 freeze scope

RC1에서는 **현재 실제 reader/validator/exporter가 사용하는 전체 공개 surface**를 freeze 합니다.

### Core release metadata

- `data/web/manifest.json`
- `data/web/health.json`
- `data/web/report-health.json`
- `data/web/missing-symbols.json`

### Product account taxonomy and summary surfaces

- `data/web/accounts/catalog.json`
- `data/web/accounts/leaderboard.json`
- `data/web/accounts/curves.json`
- `data/web/accounts.json`
- `data/web/overview.json`
- `data/web/overview/snapshot.json`
- `data/web/overview/data-quality.json`
- `data/web/overview/research-pulse.json`
- `data/web/pages/portfolio-dashboard.json`
- `data/web/portfolio/accounts.json`
- `data/web/portfolio/holdings.json`
- `data/web/portfolio/monthly-holdings.json`
- `data/web/portfolio/trades.json`
- `data/web/portfolio/episodes.json`
- `data/web/portfolio/accounting-reconciliation.json`

### Portfolio shard contracts

- `data/web/portfolio/equity/index.json`
- `data/web/portfolio/daily-decisions/index.json`
- local shard files under those indexes
- external pointer contract when offload mode is enabled

### Report / statistics / calendar surfaces

- `data/web/reports.json`
- `data/web/reports/table.json`
- `data/web/reports/rankings.json`
- `data/web/reports/detail-metrics.json`
- `data/web/reports/return-windows.json`
- `data/web/reports/target-hit-distribution.json`
- `data/web/report-board/candidates.json`
- `data/web/report-statistics-lab.json`
- `data/web/pages/report-board.json`
- `data/web/pages/report-verification.json`
- `data/web/pages/report-statistics.json`
- `data/web/research-calendar/calendar.json`
- `data/web/pages/research-calendar.json`

### Download contracts

- `data/web/table-download-reports.csv`
- `data/web/table-download-accounts.csv`
- `data/web/data-quality-download.csv`

### Price contracts

- `data/web/prices/*.json`

## 3. Freeze를 따라야 하는 코드 surface

RC1에서 다음 reader/validator/exporter는 위 artifact와 정확히 맞아야 합니다.

- `src/snusmic_pipeline/web/contracts.py`
- `src/snusmic_pipeline/web/artifacts.py`
- `src/snusmic_pipeline/cli.py`
- `apps/web/lib/schemas.ts`
- `apps/web/lib/artifacts.ts`
- `apps/web/lib/product-model.ts`
- `apps/web/lib/dashboard-view-model.ts`
- `apps/web/app/(app)/layout.tsx`
- `apps/web/app/(app)/portfolio/portfolio-view-model.ts`
- `apps/web/scripts/validate-artifacts.mjs`
- `apps/web/scripts/hydrate-external-artifacts.mjs`

## 4. Shortlist governance

`v1.0.0`에서 product shortlist는 **문서 + 생성물 + 코드 gate가 모두 일치**해야 합니다.

### Human-facing source

- `docs/product-spec.md`

이 문서는 사람에게 현재 product-visible roster와 각 계좌의 역할을 설명합니다.

### Machine-enforced source

다음이 실제 admission/ordering/selectability source of truth입니다.

- `data/sim/account-configs.json`
- `data/web/accounts/catalog.json`
- `src/snusmic_pipeline/web/artifacts.py`
  - `WEB_PORTFOLIO_ACCOUNT_IDS`
  - `_web_portfolio_account_ids(...)`
  - `_build_account_catalog(...)`
  - `is_selectable` / `is_default_candidate`
- `apps/web/lib/product-model.ts`
  - `DEFAULT_PORTFOLIO_ACCOUNT_PRIORITY`
  - `FOLLOWER_ACCOUNT_IDS`
  - `getSelectableAccountRows()`
  - `getObjectivePassingRows()`
- `apps/web/lib/dashboard-view-model.ts`
- `apps/web/app/(app)/layout.tsx`
- `apps/web/app/(app)/portfolio/portfolio-view-model.ts`
  - `PRIMARY_PORTFOLIO_ACCOUNT_IDS`

### RC1 전까지 맞춰야 하는 것

1. `docs/product-spec.md`의 roster 설명
2. `data/sim/account-configs.json`의 declared product accounts
3. `data/web/accounts/catalog.json` generated taxonomy
4. exporter-side shortlist constants
5. UI-side priority / objective-passing / follower exception logic

### RC1 이후 규칙

- 새 계좌를 product에 추가하지 않습니다.
- research-only branch, oracle, diagnostic output은 product catalog에 넣지 않습니다.
- roster를 바꾸면 RC 상태를 다시 시작합니다.

## 5. External shard policy

기본 경로는 **local committed shard**입니다.

### RC1 default

- `external_artifacts = {}`
- local shard 기반 static deploy 검증
현재 결정:
- `v1.0.0` GA 기본 serving mode는 **local committed shard**입니다.
- external shard mode는 구현과 검증을 유지하되, RC2 또는 post-1.0에서 재승인할 때까지 기본 경로에 포함하지 않습니다.
- external mode를 켜려면 아래 optional GA contract를 다시 통과해야 합니다.

### RC2 / optional GA external mode

external mode를 쓰려면 아래 contract를 모두 만족해야 합니다.

- eligible families only:
  - `data/web/portfolio/equity/*.json`
  - `data/web/portfolio/daily-decisions/*.json`
- local에 남아야 하는 것:
  - shard `index.json`
  - page bundles
  - overview/account/report metadata
  - health/manifest/report-health
- external pointer required fields:
  - `storage_key`
  - `checksum`
  - `size_bytes`
  - `row_count`
  - `public_url`
- build path:
  1. hydrate cache
  2. `artifact:check`
  3. build / smoke
- rollback path:
  - local shard로 재export
  - `external_artifacts` 비우기
  - validators/build 재실행

## 6. Release gate

`v1.0.0` 후보는 아래를 모두 통과해야 합니다.

```bash
uv run --locked python -m snusmic_pipeline export-web --check
pnpm --dir apps/web artifact:check
uv run --locked ruff check src tests scripts
uv run --locked pytest -q -m "not slow" -x
uv run --locked pytest tests/test_web_artifacts.py -q -x
uv run --locked mypy src
pnpm --dir apps/web typecheck
pnpm --dir apps/web exec biome check .
pnpm --dir apps/web build
pnpm --dir apps/web smoke:static
```

External mode를 켠다면 추가:

```bash
pnpm --dir apps/web hydrate:external-artifacts
uv run --locked pytest tests/test_external_artifacts.py -q
```

## 7. RC sequencing

### RC1

- full public contract freeze
- shortlist/admission surface freeze
- local committed shard path 검증
- docs/generated artifacts reconciliation

### RC2

- external shard mode 필요 시 rehearsal
- hydrate / validate / build / rollback proof
- final serving path ratification

### GA

- version -> `1.0.0`
- final artifact regeneration
- changelog/release note publication
- exact snapshot gate pass

## 8. Freeze rule

RC1 이후에는 다음만 허용합니다.

- bugfix
- contract-preserving wording cleanup
- release blocker 해결

다음은 RC reset 대상입니다.

- artifact shape change
- admission/selectability/order logic change
- shortlist membership change
- external pointer semantics change

## 9. Definition of done for v1.0.0

다음 문장을 maintainer가 자신 있게 말할 수 있어야 합니다.

> SNUSMIC Portfolio Lab은 PIT-first static data product로서, 공개 artifact contract와 curated shortlist governance가 동결되어 있고, local 또는 승인된 external shard serving path에서 동일한 release gate를 통과하는 `v1.0.0` snapshot을 재현 가능하다.
