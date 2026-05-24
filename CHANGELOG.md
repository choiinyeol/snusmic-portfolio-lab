# Changelog

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
