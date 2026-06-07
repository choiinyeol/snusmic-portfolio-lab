# Changelog

## v0.30.23 - Hide internal diagnostics from public pages

- Removes report-health warnings and exception queues from public `/reports`; users now see public candidates and the visible report table only.
- Simplifies shell/home health language so public UI shows service availability and dates, not internal missing-price repair actions.
- Keeps `health.json` and `report-health.json` as release-gate/admin diagnostics artifacts in the active docs instead of public page content.
- Bumps Python and web package versions to `0.30.23`.

Verification:

- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web format:check`
- `pnpm --dir apps/web build`
- `pnpm --dir apps/web smoke:static`
- Browser inspection of `/` and `/reports` on `http://127.0.0.1:3000`

## v0.30.22 - Rebalance the report board review queue

- Moves `/reports` into a clearer review queue: priority candidates stay on the left, report-health diagnostics move into a compact side queue.
- Replaces the wide diagnostics table with per-report diagnostic cards so excluded/transcription-review rows do not dominate the main workflow.
- Keeps the full report table as the canonical detailed comparison below the triage queue.
- Bumps Python and web package versions to `0.30.22`.

Verification:

- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web format:check`
- `pnpm --dir apps/web build`
- `pnpm --dir apps/web smoke:static`
- Browser inspection of `/reports` on `http://127.0.0.1:3000`

## v0.30.21 - Reset the home route hierarchy

- Reframes `/` as a compact operating hub for data status, representative account state, and route-level next actions instead of a duplicate signal-ledger detail page.
- Renames the sidebar home entry to `운영 허브` and keeps report verification, portfolio, statistics, and calendar responsibilities separated.
- Updates active product and architecture docs so the route inventory matches the current page tree.
- Bumps Python and web package versions to `0.30.21`.

Verification:

- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web format:check`
- `pnpm --dir apps/web build`
- `pnpm --dir apps/web smoke:static`
- Browser inspection of `/` on `http://127.0.0.1:3000`

## v0.30.20 - Polish frontend decision surfaces

- Adds a report-table scan bar that shows visible range, filtered total, active page, current sort, and applied filters.
- Adds a statistics reading guide near the top of `/statistics` using existing sample, target-hit, median, flat-share, concentration, and expiry metrics.
- Keeps the new report detail source/audit section and portfolio shortlist explanations in the release surface.
- Bumps Python and web package versions to `0.30.20`.

Verification:

- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web format:check`
- `pnpm --dir apps/web build`
- `pnpm --dir apps/web smoke:static`
- `pnpm --dir apps/web artifact:check`
- `uv run --locked pytest tests/test_web_artifacts.py -q -k "manifest_records_snapshot_lineage_counts_and_checksums"`
- `uv run --locked ruff check src/snusmic_pipeline/web/artifacts.py tests/test_web_artifacts.py`
- `uv run --locked ruff format --check src/snusmic_pipeline/web/artifacts.py tests/test_web_artifacts.py`
- Browser text inspection of `/reports`, `/statistics`, `/portfolio`, and one report detail page on `http://127.0.0.1:3000`
- `git diff --check`

## v0.30.19 - Clarify audit and shortlist decisions

- Adds explicit `decision` and `release_status` policy fields for missing-price symbols, including accepted exclusions versus action-required price/mapping work.
- Surfaces missing-price status/category counts in `health.json`, `data-quality-download.csv`, and artifact validation.
- Adds report detail source/audit metadata so PDF, Markdown, report id, title, and caveat flags are visible on each report detail page.
- Makes the portfolio shortlist explain why each curated account is shown and what comparison question it answers.
- Records Discord execution slicing in `AGENTS.md` and bumps Python/web package versions to `0.30.19`.

Verification:

- `uv run --locked python -m snusmic_pipeline export-web --check`
- `uv run --locked ruff check src/snusmic_pipeline/web/artifacts.py`
- `uv run --locked ruff format --check src/snusmic_pipeline/web/artifacts.py`
- `pnpm --dir apps/web artifact:check`
- `pnpm --dir apps/web typecheck`
- `uv run --locked pytest tests/test_web_artifacts.py -q -k "manifest_records_snapshot_lineage_counts_and_checksums"`
- `uv run --locked ruff check src/snusmic_pipeline/web/artifacts.py tests/test_web_artifacts.py`
- `uv run --locked ruff format --check src/snusmic_pipeline/web/artifacts.py tests/test_web_artifacts.py`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web format:check`
- `pnpm --dir apps/web build`
- `pnpm --dir apps/web smoke:static`
- `git diff --check`

## v0.30.18 - Tighten diagnostics and release gates

- Fixes extraction of fair-value ranges and approval-price targets, removing the remaining `needs_review` report rows from the committed extraction audit.
- Corrects Soitec's Yahoo symbol mapping to `SOI.PA` and classifies every missing-price symbol with company, report id, category, and action.
- Adds a compact Report Board diagnostics table, artifact reader caching, shared portfolio label helper, stricter report-health/missing-symbol validation, CI job timeouts, and aligned mypy invocation.
- Updates README command examples to the locked local/CI commands and bumps Python/web package versions to `0.30.18`.

Verification:

- `uv run pytest tests/test_extract_pdf.py tests/test_symbol_registry.py -q`
- `uv run --locked python -m snusmic_pipeline ocr-reextract --data-dir data --audit --audit-output data/extraction_quality.json`
- `uv run --locked python -m snusmic_pipeline build-warehouse`
- `uv run --locked python -m snusmic_pipeline export-web --check`
- `uv run --locked python -m snusmic_pipeline rebuild-web-artifacts`
- `uv run --locked pytest tests/test_extract_pdf.py tests/test_symbol_registry.py tests/test_web_artifacts.py -q -k "not export_web_artifacts_matches_baseline_counts and not daily_decision_artifacts_expose_checkpoint_metadata"`
- `uv run --locked ruff check src/snusmic_pipeline/ingest/extract_pdf.py src/snusmic_pipeline/market_data/symbols.py src/snusmic_pipeline/web/artifacts.py tests/test_extract_pdf.py tests/test_symbol_registry.py tests/test_web_artifacts.py`
- `uv run --locked ruff format --check src/snusmic_pipeline/ingest/extract_pdf.py src/snusmic_pipeline/market_data/symbols.py src/snusmic_pipeline/web/artifacts.py tests/test_extract_pdf.py tests/test_symbol_registry.py tests/test_web_artifacts.py`
- `uv run --locked mypy`
- `pnpm --dir apps/web artifact:check`
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web format:check`
- `pnpm --dir apps/web build`
- `pnpm --dir apps/web smoke:static`
- Browser inspection of `http://127.0.0.1:3000/reports/`
- `git diff --check`

## v0.30.17 - Expose report visibility diagnostics

- Adds `data/web/report-health.json` to explain every source report's extraction status, web visibility, exclusion reason, and next action.
- Validates report-health row counts and visible/excluded totals in `apps/web artifact:check`.
- Surfaces extraction and web-exclusion diagnostics on the report board so missing transcriptions, missing prices, and intentional filters are visible in the UI.
- Bumps Python and web package versions to `0.30.17`.

Verification:

- `uv run pytest tests/test_web_artifacts.py -q -k "manifest_records_snapshot_lineage_counts_and_checksums or check_web_artifacts_requires_deterministic_json"`
- `uv run ruff check src/snusmic_pipeline/web/artifacts.py tests/test_web_artifacts.py`
- `uv run ruff format --check src/snusmic_pipeline/web/artifacts.py tests/test_web_artifacts.py`
- `pnpm --dir apps/web artifact:check`
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web format:check`
- `uv run python -m snusmic_pipeline export-web --check`
- `pnpm --dir apps/web build`
- `pnpm --dir apps/web smoke:static`
- `git diff --check`

## v0.30.16 - Add actionable health severity

- Extends `data/web/health.json` checks with `ok | review | stale | fail` severity, observed/expected/action fields, and missing-price previews.
- Makes `apps/web artifact:check` allow `review` health warnings while blocking `stale`/`fail` checks and current-date stale report/price ranges.
- Shows the primary health action in the shell Data Status panel and supports stale/fail visual states.
- Documents the severity contract and bumps Python/web package versions to `0.30.16`.

Verification:

- `uv run pytest tests/test_web_artifacts.py -q -k "manifest_records_snapshot_lineage_counts_and_checksums or web_artifact_ci_validator_rejects_stale_price_range or check_web_artifacts_requires_deterministic_json"`
- `uv run ruff check src/snusmic_pipeline/web/artifacts.py tests/test_web_artifacts.py`
- `uv run ruff format --check src/snusmic_pipeline/web/artifacts.py tests/test_web_artifacts.py`
- `pnpm --dir apps/web artifact:check`
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web format:check`
- `uv run python -m snusmic_pipeline export-web --check`
- `pnpm --dir apps/web build`
- `pnpm --dir apps/web smoke:static`
- `git diff --check`

## v0.30.15 - Add artifact health status

- Adds deterministic `data/web/health.json` with report/price/simulation date alignment, missing-price coverage, and snapshot review status.
- Validates the health artifact in `apps/web artifact:check` and includes it in manifest checksum coverage.
- Shows the health status in the web shell Data Status panel instead of hard-coding a green state.
- Documents the health artifact contract and bumps Python/web package versions to `0.30.15`.

Verification:

- `uv run pytest tests/test_web_artifacts.py -q -k "manifest_records_snapshot_lineage_counts_and_checksums or check_web_artifacts_requires_deterministic_json"`
- `uv run ruff check src/snusmic_pipeline/web/artifacts.py tests/test_web_artifacts.py`
- `uv run ruff format --check src/snusmic_pipeline/web/artifacts.py tests/test_web_artifacts.py`
- `pnpm --dir apps/web artifact:check`
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web format:check`
- `uv run python -m snusmic_pipeline export-web --check`
- `git diff --check`

## v0.30.14 - Complete deterministic PIT ultragoal

- Marks the durable ultragoal complete after auditing direct-origin ingest diagnostics, centralized symbol resolution, web artifact cross-reference gates, data-refresh pre-commit checks, and release evidence.
- Records final completion evidence in `.gjc/ultragoal/ledger.jsonl` and updates `.gjc/ultragoal/goals.json` to `complete`.
- Bumps Python and web package versions to `0.30.14`.

Verification:

- `uv run pytest tests/test_change_detection.py tests/test_fetch_index.py tests/test_symbol_registry.py tests/test_web_artifacts.py -q -k "price_cross_reference or ci_validator_rejects_dual_krx_segment_artifacts or refresh_web_artifacts_runs_checked_export or check_web_artifacts_requires_deterministic_json"`
- `pnpm --dir apps/web artifact:check`
- `uv run python -m snusmic_pipeline export-web --check`
- `git restore data/web`
- `git diff --check`
- `gjc ultragoal status --json`

## v0.30.13 - Check refreshed web artifacts before commit

- Runs `refresh-web-artifacts` and `rebuild-web-artifacts` through `check_web_artifacts()` so data-refresh workflows fail before committing invalid web artifacts.
- Adds a focused CLI test proving `refresh-web-artifacts` uses the checked exporter rather than the unchecked export path.
- Documents that bulk data refresh must pass deterministic/cross-reference validation before commit/push.
- Bumps Python and web package versions to `0.30.13`.

Verification:

- `uv run pytest tests/test_web_artifacts.py -q -k "refresh_web_artifacts_runs_checked_export"`
- `uv run ruff check src/snusmic_pipeline/cli.py tests/test_web_artifacts.py`
- `uv run ruff format --check src/snusmic_pipeline/cli.py tests/test_web_artifacts.py`
- `uv run python -m snusmic_pipeline export-web --check`
- `git diff --check`

## v0.30.12 - Mirror price artifact gates in web CI

- Extends `apps/web` artifact validation to reject missing-symbol price gaps, price artifact symbol mismatches, unlisted `missing_price=true` report artifacts, and `.KS/.KQ` dual artifacts.
- Adds a focused test proving the web CI validator fails when a raw KRX ticker has both KOSPI and KOSDAQ price artifacts.
- Documents that both `export-web --check` and web `artifact:check` enforce the price cross-reference contract.
- Bumps Python and web package versions to `0.30.12`.

Verification:

- `pnpm --dir apps/web artifact:check`
- `uv run pytest tests/test_web_artifacts.py -q -k "ci_validator_rejects_dual_krx_segment_artifacts or price_cross_reference_validator_rejects_dual_krx_segment_artifacts"`
- `uv run ruff check tests/test_web_artifacts.py`
- `uv run ruff format --check tests/test_web_artifacts.py`
- `pnpm --dir apps/web format:check`

## v0.30.11 - Gate web price artifact references

- Adds web artifact cross-reference validation for `reports.json`, `missing-symbols.json`, `manifest.json`, and `data/web/prices/*.json`.
- Fails `export-web --check` when report or missing symbols lack price artifacts, manifest price counts drift, report symbols are marked missing without a missing-symbol entry, or one KRX raw ticker exports both `.KS` and `.KQ`.
- Documents the symbol registry and web price artifact invariants in active architecture and data artifact policy docs.
- Persists the ultragoal brief and M1 ledger entry under `.gjc/ultragoal/`.
- Bumps Python and web package versions to `0.30.11`.

Verification:

- `uv run pytest tests/test_web_artifacts.py -q -k "price_cross_reference or check_web_artifacts_requires_deterministic_json"`
- `uv run ruff check src/snusmic_pipeline/web/artifacts.py tests/test_web_artifacts.py`
- `uv run ruff format --check src/snusmic_pipeline/web/artifacts.py tests/test_web_artifacts.py`
- `uv run python -m snusmic_pipeline export-web --check`
- `git diff --check`

## v0.30.10 - Centralize symbol resolution

- Moves company ticker, exchange, yfinance symbol, currency, KOSDAQ segment, and yfinance suffix rules into `src/snusmic_pipeline/market_data/symbols.py`.
- Wires PDF extraction, warehouse report loading, and currency yfinance formatting to the shared symbol registry instead of duplicated constants.
- Keeps PDF exchange evidence ahead of the generic 4-digit Tokyo fallback when a numeric ticker appears with explicit venue text.
- Adds focused symbol-registry tests for recent overseas reports and the `샘씨엔에스 -> 252990.KQ` KOSDAQ case.
- Bumps Python and web package versions to `0.30.10`.

Verification:

- `uv run pytest tests/test_symbol_registry.py tests/test_currency.py tests/test_leading_zero_preservation.py tests/test_extract_pdf.py -q`
- `uv run ruff check src/snusmic_pipeline/market_data/symbols.py src/snusmic_pipeline/market_data/currency.py src/snusmic_pipeline/ingest/extract_pdf.py src/snusmic_pipeline/sim/warehouse.py tests/test_symbol_registry.py tests/test_currency.py tests/test_leading_zero_preservation.py tests/test_extract_pdf.py`
- `uv run ruff format --check src/snusmic_pipeline/market_data/symbols.py src/snusmic_pipeline/market_data/currency.py src/snusmic_pipeline/ingest/extract_pdf.py src/snusmic_pipeline/sim/warehouse.py tests/test_symbol_registry.py tests/test_currency.py tests/test_leading_zero_preservation.py tests/test_extract_pdf.py`
- `uv run python -m snusmic_pipeline build-warehouse --warehouse-dir .tmp-symbol-warehouse`
- Python warehouse smoke for `샘씨엔에스`, `Aixtron SE`, `Soitec SA`, `Global Unichip Corp.`
- `git diff --check`

## v0.30.9 - Remove hosted sync mirror fallback

- Removes the `r.jina.ai` reader fallback from SNUSMIC report detection and index fetching so the pipeline only trusts the source WordPress REST API.
- Adds direct-origin HTTP diagnostics with status, final URL, content type, and body prefix for REST failures.
- Shares ingest headers/timeouts through a direct HTTP helper and keeps PDF downloads on the same source policy.
- Adds workflow timeouts, uv cache, pnpm cache, and `--prefer-offline` installs for sync, market refresh, and web deployment lanes.
- Bumps Python and web package versions to `0.30.9`.

Verification:

- `uv run pytest tests/test_change_detection.py tests/test_fetch_index.py -q`
- `uv run ruff check src/snusmic_pipeline/ingest/http_client.py src/snusmic_pipeline/ingest/change_detection.py src/snusmic_pipeline/ingest/download_pdfs.py src/snusmic_pipeline/ingest/fetch_index.py tests/test_change_detection.py tests/test_fetch_index.py`
- `uv run ruff format --check src/snusmic_pipeline/ingest/http_client.py src/snusmic_pipeline/ingest/change_detection.py src/snusmic_pipeline/ingest/download_pdfs.py src/snusmic_pipeline/ingest/fetch_index.py tests/test_change_detection.py tests/test_fetch_index.py`
- `uv sync --locked --group dev --dry-run`
- `uv run python -m snusmic_pipeline check-new --manifest data/manifest.json`
- `pnpm --dir apps/web typecheck`
- `git diff --check`

## v0.30.8 - Refresh reports and split docs languages

- Syncs the SNUSMIC archive to 240 reports, including the 2026-05-07 and 2026-05-29 report batches, and regenerates PDF Markdown extracts.
- Extends ticker/exchange parsing for Xetra, Taiwan, and the latest overseas reports so warehouse/web exports can resolve AIXA.DE, FIX, SOIT.PA, STRL, and 3443.TW.
- Refreshes warehouse prices and web artifacts through the latest available close date, 2026-06-01.
- Emits `docs/research/iterations/064-report-web-refresh-generated.md` from the refreshed simulation artifacts.
- Splits README and active docs into Korean `*.md` and English `*.en.md` files.
- Bumps Python and web package versions to `0.30.8`.

Verification:

- `uv run python -m snusmic_pipeline check-new`
- `uv run python -m snusmic_pipeline sync --pages auto --markdown` (initial Markdown step required local portable JRE retry)
- `uv run python -m snusmic_pipeline export-markdown --data-dir data`
- `uv run python -m snusmic_pipeline ocr-reextract --data-dir data --audit`
- `uv run python -m snusmic_pipeline build-warehouse`
- `uv run python -m snusmic_pipeline refresh-prices`
- `uv run python -m snusmic_pipeline refresh-web-artifacts`
- `uv run python -m snusmic_pipeline export-web --check`
- `uv run ruff check src tests scripts`

## v0.30.7 - Fix sync dependency install

- Removes the stale `--extra ocr` flag from `sync.yml`; OCR support is already installed through the project dependencies.
- Keeps the scheduled sync job aligned with the same locked dependency install used by CI, web, and price-refresh workflows.
- Bumps Python and web package versions to `0.30.7`.

Verification:

- `uv run pytest tests/test_change_detection.py tests/test_fetch_index.py -q`
- `uv run python -m snusmic_pipeline check-new --manifest data/manifest.json`
- `uv run ruff check src\snusmic_pipeline\__init__.py src\snusmic_pipeline\ingest\change_detection.py src\snusmic_pipeline\ingest\fetch_index.py src\snusmic_pipeline\ingest\reader_fallback.py tests\test_change_detection.py tests\test_fetch_index.py`
- `git diff --check`

## v0.30.6 - Add SNUSMIC REST reader fallback

- Keeps the direct SNUSMIC WordPress REST request as the primary fetch path.
- Falls back to a read-only Reader mirror only when hosted runners receive non-JSON or HTTP-error responses from the REST endpoint.
- Applies the fallback to both page-one new-report detection and full report index fetching so scheduled sync can get past runner-specific REST blocking.
- Bumps Python and web package versions to `0.30.6`.

Verification:

- `uv run pytest tests/test_change_detection.py tests/test_fetch_index.py -q`
- `uv run python -m snusmic_pipeline check-new --manifest data/manifest.json`
- `uv run ruff check src\snusmic_pipeline\ingest\change_detection.py src\snusmic_pipeline\ingest\fetch_index.py src\snusmic_pipeline\ingest\reader_fallback.py tests\test_change_detection.py tests\test_fetch_index.py`
- `git diff --check`

## v0.30.5 - Harden SNUSMIC fetch headers

- Sends browser-like `User-Agent` and `Accept` headers for SNUSMIC REST/PDF requests so hosted runners are less likely to receive an HTML fallback instead of JSON/PDF content.
- Keeps live new-report detection returning `has_new=true` for the current 2026-05-29 page-one reports.
- Bumps Python and web package versions to `0.30.5`.

Verification:

- `uv run python -m snusmic_pipeline check-new --manifest data/manifest.json`
- inline workflow detection script with `PYTHONPATH=src`
- `git diff --check`
- `uv run ruff check src\snusmic_pipeline\__init__.py src\snusmic_pipeline\ingest\change_detection.py src\snusmic_pipeline\ingest\fetch_index.py src\snusmic_pipeline\ingest\download_pdfs.py`

## v0.30.4 - Restore scheduled report sync

- Restores the scheduled `sync.yml` trigger so new SNUSMIC page-one reports are checked every day again.
- Fixes the GitHub Actions detection import to use the current `snusmic_pipeline.ingest.change_detection` module path.
- Confirms the live SNUSMIC REST API currently reports new 2026-05-29 reports and local detection returns `has_new=true`.
- Bumps Python and web package versions to `0.30.4`.

Verification:

- `uv run python -m snusmic_pipeline check-new --manifest data/manifest.json`
- inline workflow detection script with `PYTHONPATH=src`
- `git diff --check`
- `uv run ruff check src\snusmic_pipeline\__init__.py src\snusmic_pipeline\ingest\change_detection.py`

## v0.30.3 - Local generated-file hygiene

- Ignores local OMX home-check screenshots and common coverage artifacts so temporary diagnostics do not reappear in `git status`.
- Cleans local regenerateable build/cache outputs from this workspace: Python caches, Vercel cache, Next `.next`, static `out`, TypeScript build info, and old OMX home-check screenshots.
- Keeps `.venv` and `apps/web/node_modules` in place because they are already ignored and expensive to recreate during normal local work.
- Bumps Python and web package versions to `0.30.3`.

Verification:

- `git diff --check`
- `uv run ruff check src\snusmic_pipeline\__init__.py`

## v0.30.2 - Korean-first docs and release finish policy

- Makes README and active docs Korean-first by default while keeping English sections for bilingual review.
- Adds a docs index that states the Korean-first documentation policy and links the main product, data, architecture, and backtest contracts.
- Adds the project-local `release-finish` Codex skill so future work ends with docs/README cleanup, CHANGELOG or release notes, a lore commit, an annotated tag, and branch/tag push.
- Updates repository agent guidance so the release-finish workflow is the standing completion policy for this repo.
- Bumps Python and web package versions to `0.30.2`.

Verification:

- `python C:\Users\FELAB\.codex\skills\.system\skill-creator\scripts\quick_validate.py .\.codex\skills\release-finish`
- `git diff --check`
- `uv run ruff check src\snusmic_pipeline\__init__.py`

## v0.30.1 - Sharded portfolio artifacts and CI recovery

- Splits portfolio equity and daily-decision web payloads into curated account shards so the static app no longer commits or deploys the full aggregate simulation time series.
- Updates artifact readers, schemas, validators, docs, and tests to treat `portfolio/equity/index.json` and `portfolio/daily-decisions/index.json` as the web contract.
- Preserves curated portfolio routes, account charts, trades, and downloads while reducing the largest committed web artifact surface.
- Fixes the GitHub Actions `web` failure by making the committed artifact validator understand sharded row counts.
- Fixes the GitHub Actions `ci` type job by narrowing pandas typing in report/audit/export paths without changing runtime behavior.
- Bumps Python and web package versions to `0.30.1`.

Verification:

- `uv run ruff check .`
- `uv run ruff format --check .`
- `uv run mypy src`
- `uv run pytest -q -m "not slow" -x`
- `uv run python scripts/export_schemas.py --check`
- `uv run python scripts/check_schema_compat.py --base-ref origin/main`
- `pnpm --dir apps/web artifact:check`
- `pnpm --dir apps/web check`
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web build`
- `pnpm --dir apps/web smoke:static`

## v0.30.0 - PIT strategy research ledger and portfolio curation

- Closes the PIT strategy research sprint with a durable idea/result/retrospective ledger under `docs/research`.
- Adds generated account families for PIT score/trend portfolios, retained-winner construction, profit trims, cash-gated redeploy, Partial 75, and the related audit reports.
- Curates `/portfolio` so the product shows representative account ledgers instead of every parameter branch.
- Shortens product-facing account names to `Partial 75`, `CashGate 12.5`, `TrailTrim 20`, `Trend Top5`, `Score Top5`, and `SMIC Follower`.
- Adds detailed strategy explanations to the portfolio catalogue and account ledger header so long generated IDs no longer carry product meaning.
- Restores readable UTF-8 portfolio copy, KRW/foreign currency formatting, sortable holdings/trades tables, CSV downloads, realized PnL, and trade reason labels.
- Updates README and product spec to reflect the current static artifact-backed research-ledger contract.

Verification:

- `pnpm --dir apps/web artifact:check`
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web build`
- `pnpm exec biome check` on the touched portfolio/web files
- `uv run ruff check src tests`
- `uv run pytest tests/sim/test_research_report.py tests/sim/test_selection_audit.py tests/sim/test_account_path_audit.py tests/sim/test_pit_research_board.py -q`

## v0.29.4 - Report board and statistics product pass

- Merges the report table and review queue into one report-board workflow so the web app has a single source of truth for report verification.
- Adds page-shaped view models and static page bundles so route components render decision-ready props instead of raw artifact rows.
- Retouches `/statistics` into a compact decision-first statistics board with executive metrics, distribution focus, concentration insight, whole-sample map guidance, and shorter price-path panels.
- Improves report table density, sorting, row navigation, compact symbol/company display, moving-average grouping, signed progress gauge behavior, and KRW display with `₩`.
- Separates latest report close from capped two-year evaluation close so expired report details can show the real latest close while preserving the evaluation-window evidence.
- Streamlines web routing and deployment wrappers around the current cross-platform Node/Python entrypoints.
- Updates frontend design, chart, table, artifact, and architecture docs to match the current static artifact reader and page view-model contract.

Verification:

- `uv run --locked pytest tests/sim/test_report_stats.py`
- `uv run --locked ruff check src/snusmic_pipeline/sim/contracts.py src/snusmic_pipeline/sim/report_stats.py src/snusmic_pipeline/web/artifacts.py src/snusmic_pipeline/web/contracts.py tests/sim/test_report_stats.py`
- `pnpm --dir apps/web artifact:check`
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web build`

## v0.29.3 - PIT artifact boundary cleanup

- Removes the committed daily-forward checkpoint cache from Git and ignores future checkpoint files.
- Makes `weak_oracle` an explicit diagnostic implementation instead of a default/product account.
- Separates web benchmark rows from report-follower account rows and validates account `kind` in Python tests plus the web artifact checker.
- Adds a data artifact policy that defines which generated data is committed and which cache paths stay local.

Verification:

- `uv run ruff check src tests scripts`
- `uv run mypy src`
- `uv run pytest tests/sim/test_contracts.py tests/sim/test_forward_runner.py tests/test_web_artifacts.py -q -x`
- `uv run pytest -q -m "not slow" -x`
- `uv run pytest -q`
- `uv run python scripts/export_schemas.py --check`
- `uv run python -m snusmic_pipeline export-web --check`
- `pnpm --dir apps/web artifact:check`
- `pnpm --dir apps/web check`
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web build`
- `uv run pre-commit run --all-files --show-diff-on-failure`

## v0.29.2 - CI action pin

- Pins `astral-sh/setup-uv` to `v8.1.0` because the v8 major alias is not published.
- Keeps the PIT account cleanup release changes intact while unblocking GitHub Actions job setup.

Verification:

- `uv run pre-commit run --all-files --show-diff-on-failure`
- GitHub workflow YAML parse check

## v0.29.1 - PIT account cleanup

- Removed strategy-search surfaces from the current product path.
- Re-layered Python code into `ingest`, `market_data`, `sim`, and `web`.
- Renamed portfolio routing and web contracts from strategy/persona language to account language.
- Reduced docs to the current PIT research-board and fixed-account scope.
- Internalized web artifact refresh scripts into package CLI commands:
  - `python -m snusmic_pipeline refresh-web-artifacts`
  - `python -m snusmic_pipeline rebuild-web-artifacts`
- Fixed the scheduled market-data refresh failure caused by the mismatched `daily-forward` argparse attribute.

Verification:

- `uv run ruff check src tests scripts`
- `uv run mypy src`
- `uv run pytest -q -m "not slow" -x`
- `pnpm --dir apps/web artifact:check`
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web build`
- `uv run python scripts/export_schemas.py --check`
- `uv run python scripts/check_schema_compat.py --base-ref origin/main`
- `uv run python -m snusmic_pipeline export-web --check`
- `uv run pre-commit run --all-files --show-diff-on-failure`
