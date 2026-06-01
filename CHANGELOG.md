# Changelog

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
