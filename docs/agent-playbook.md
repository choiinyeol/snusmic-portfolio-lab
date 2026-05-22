# Agent Playbook

Last updated: 2026-05-23
Status: canonical agent guidance

## Read First

| Need | Source |
| --- | --- |
| Product intent | `docs/product-spec.md` |
| Simulation rules | `docs/backtest-contract.md` |
| Pipeline and artifacts | `docs/technical-architecture.md` |
| UI style | `DESIGN.md` |
| Test strategy | `docs/testing-performance-strategy.md` |

## Working Rules

- Prefer deletion, consolidation, and existing abstractions before new surfaces.
- Do not add script wrappers for package commands.
- Keep exploratory lanes opt-in. Expensive stock/PIT strategy search belongs inside `generate-strategies`, not as standalone public CLI.
- Treat generated artifacts separately from code changes.
- Preserve point-in-time behavior before optimizing performance.
- Use Pydantic for config/artifact boundaries, not for inner numeric loops.
- Prefer NumPy/vectorized operations in calculation hot paths; use pandas for IO, alignment, grouping, and tabular export.

## Strategy Work Checklist

Before adding or changing a strategy, identify:

1. Hypothesis.
2. Universe.
3. Buy rule.
4. Sell rule.
5. Sizing and cash rule.
6. Signal timestamp and execution timestamp.
7. Benchmark.
8. Verification command.

If those are not clear, the strategy is not ready for implementation.

## Verification Levels

| Change | Minimum evidence |
| --- | --- |
| Docs only | Link/path scan and affected references. |
| Python sim | `ruff`, `mypy src`, targeted pytest. |
| Artifacts | `export-web --check` or artifact-specific tests. |
| Frontend | `artifact:check`, typecheck, Biome, build, and browser smoke when visual. |
| Full pipeline | Refresh or rebuild artifacts plus web build. |

## Stop Condition

Finish only when the changed code path is verified, stale references are removed, and remaining risk is explicit.
