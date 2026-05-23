# Changelog

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
