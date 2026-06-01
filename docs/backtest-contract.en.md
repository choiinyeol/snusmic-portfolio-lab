# Replay Contract

The current repository does not develop unlimited new strategies. It produces PIT data and fixed account reports. This contract exists so future rule work does not corrupt the data boundary.

### PIT Boundary

- A report is observable only on or after its publication date.
- A signal computed with close `t` may trade no earlier than close `t + 1`.
- Same-day execution requires an explicit observability note.
- Price adjustment, currency conversion, and report target alignment must be deterministic.

### Account Rule Declaration

Before adding a new account rule, declare the eligible universe, buy trigger, sell trigger, stop-loss and take-profit behavior, sizing and cash policy, rebalance cadence, fees and slippage, benchmark, and objective.

Forward-looking oracle implementations may be used in tests or notebooks as diagnostics, but they are not product accounts and must not be exported in the web account catalog.

### Verification

Every structural change must run the narrow affected tests first, then the repo quality gate listed in the Korean section above.
