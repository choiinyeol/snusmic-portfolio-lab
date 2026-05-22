# Testing and Performance Strategy

Last updated: 2026-05-23
Status: canonical verification guidance

## Test Shape

Keep tests that protect contracts and delete tests that only freeze implementation trivia.

| Keep | Reason |
| --- | --- |
| Pydantic contract tests | Boundary stability for configs and artifacts. |
| Ledger/accounting tests | Prevent silent backtest corruption. |
| No-lookahead tests | Preserve the product's credibility. |
| Artifact schema/check tests | Keep frontend and pipeline aligned. |
| Small regression tests for known bugs | Cheap protection against repeated mistakes. |

| Avoid | Reason |
| --- | --- |
| Full replay in ordinary unit tests | Too slow for local development. |
| Snapshotting huge generated files | Creates churn without proving behavior. |
| Testing private formatting details | Blocks cleanup. |

## Local Loops

Fast Python loop:

```bash
uv run ruff check src tests
uv run mypy src
uv run pytest -q -m "not slow"
```

GitHub `ci.yml` uses the same fast lane. Slow replay and full artifact contract tests are intentionally excluded from default CI; run them manually when changing checkpoint replay, benchmark cache behavior, or full artifact export.

Targeted strategy loop:

```bash
uv run pytest -q tests/sim/test_pit_research_board.py
```

Frontend loop:

```bash
pnpm --dir apps/web artifact:check
pnpm --dir apps/web typecheck
pnpm --dir apps/web exec biome check .
```

## Performance Rules

- Measure before claiming speedup.
- Keep pandas at data boundaries and use NumPy/vectorized arrays in hot calculations.
- Cache only with explicit invalidation inputs.
- Do not keep legacy fallback paths just because they make a benchmark pass.
- Slow end-to-end replays should be explicit, not hidden inside the default test lane.
