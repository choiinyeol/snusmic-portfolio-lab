# Replay Contract

The current repository does not develop new strategies. It produces PIT data and fixed account reports. This contract exists so future rule work does not corrupt the data boundary.

## PIT Boundary

- A report is observable only on or after its publication date.
- A signal computed with close `t` may trade no earlier than close `t + 1`.
- Same-day execution requires an explicit observability note.
- Price adjustment, currency conversion, and report target alignment must be deterministic.

## Account Rule Declaration

Before adding a new account rule, declare:

- Eligible universe.
- Buy trigger.
- Sell trigger.
- Stop-loss and take-profit behavior.
- Sizing and cash policy.
- Rebalance cadence.
- Fees and slippage.
- Benchmark and objective.

## Existing Accounts

| Account | Kind | Purpose |
| --- | --- | --- |
| `all_weather` | benchmark | Allocation baseline. |
| `benchmark_kodex200` | benchmark | Domestic equity objective benchmark. |
| `benchmark_qqq` | benchmark | NASDAQ-100 market baseline. |
| `benchmark_spy` | benchmark | S&P 500 market baseline. |
| `benchmark_gld` | benchmark | Gold market baseline. |
| `smic_follower` | account | Fixed report-follower account. |
| `smic_follower_v2` | account | Fixed report-follower account with declared stop rules. |

Forward-looking oracle implementations may be used in tests or notebooks as diagnostics, but they are not product accounts and must not be exported in the web account catalog.

## Verification

Every structural change must run the narrow affected tests first, then the repo quality gate:

- `uv run ruff check src tests scripts`
- `uv run mypy src`
- `uv run pytest -q -m "not slow" -x`
- `pnpm --dir apps/web artifact:check`
- `pnpm --dir apps/web typecheck`
