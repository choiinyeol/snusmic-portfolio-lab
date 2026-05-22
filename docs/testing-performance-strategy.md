# Testing and Performance Strategy

This repo now treats tests as a tiered safety system instead of one large inner loop.

## Keep

Keep tests that protect money movement, price timing, lookahead boundaries, target scaling,
artifact contracts, schema compatibility, and release reproducibility. These tests may be slow,
but they guard mistakes that are hard to spot visually.

## Simplify or Delete Candidates

A test can be simplified, merged, or deleted when all of these are true:

- It has no unique failure signal after another contract or artifact test covers the same behavior.
- It asserts implementation shape rather than product or accounting behavior.
- It repeats a full-data export or replay only to inspect one field that can be tested with a
  smaller fixture.
- It slows the suite materially and has a clear smaller replacement.

Do not delete accounting, lookahead, benchmark coverage, target-hit, or artifact-contract tests
without adding equivalent smaller coverage first.

## Local Loops

Fast Python loop:

```powershell
uv run ruff check .
uv run ruff format --check .
uv run mypy src
uv run pytest -q -m "not slow"
```

Full Python loop:

```powershell
uv run pytest -q
```

Web loop:

```powershell
corepack pnpm --dir apps/web check
corepack pnpm --dir apps/web typecheck
corepack pnpm --dir apps/web artifact:check
```

Final gate adds:

```powershell
corepack pnpm --dir apps/web build
corepack pnpm --dir apps/web audit --prod
```

## Refactor Smoke

Use this before and after NumPy/vectorization changes:

```powershell
uv run python scripts/perf_semantic_smoke.py --json
```

The smoke output is not a strict benchmark. It gives a quick semantic fingerprint and rough
runtime signal for web export and forward simulation so regressions are visible before the full
suite runs.

## Intentional Loops

The remaining daily trading loops are stateful by design: cash deposits, position sizing,
tax/fee accounting, stop-loss exits, retained winners, and rebalance decisions all depend on the
account state produced by prior days. Those loops are not good vectorization targets unless the
simulation contract itself changes.

Calculation-heavy work should stay outside those loops where possible:

- Pydantic validates I/O and web-artifact boundaries, not every numeric row in an inner simulation pass.
- `PriceBoard` owns NumPy-backed date/symbol lookup and report-window price statistics.
- PIT research-board snapshots reuse cached target-hit, price-date, and per-symbol rolling-indicator computations.
- Pandas remains acceptable for one-time table shaping and artifact assembly, but repeated per-report
  or per-day price scans should move to `PriceBoard` or a dedicated cache.
