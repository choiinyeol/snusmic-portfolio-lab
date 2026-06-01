# Replay Contract

## 한국어

현재 저장소는 새 전략을 무제한으로 개발하는 곳이 아닙니다. PIT data와 fixed account report를 생성합니다. 이 contract는 향후 rule 작업이 data boundary를 오염시키지 않도록 유지됩니다.

### PIT Boundary

- 리포트는 publication date 당일 또는 그 이후에만 관측 가능합니다.
- close `t`로 계산한 signal은 earliest close `t + 1`에만 거래할 수 있습니다.
- same-day execution은 별도 observability note가 있어야 합니다.
- price adjustment, currency conversion, report target alignment는 결정론적이어야 합니다.

### Account Rule Declaration

새 account rule을 추가하기 전에는 다음을 선언합니다.

- eligible universe.
- buy trigger.
- sell trigger.
- stop-loss 및 take-profit behavior.
- sizing 및 cash policy.
- rebalance cadence.
- fees 및 slippage.
- benchmark 및 objective.

### 기존 계좌

| Account | Kind | Purpose |
| --- | --- | --- |
| `all_weather` | benchmark | allocation baseline. |
| `benchmark_kodex200` | benchmark | domestic equity objective benchmark. |
| `benchmark_qqq` | benchmark | NASDAQ-100 market baseline. |
| `benchmark_spy` | benchmark | S&P 500 market baseline. |
| `benchmark_gld` | benchmark | gold market baseline. |
| `smic_follower` | account | fixed report-follower account. |
| `smic_follower_v2` | account | declared stop rule이 있는 fixed report-follower account. |

Forward-looking oracle implementation은 test 또는 notebook에서 diagnostic으로 사용할 수 있지만 product account가 아니며 web account catalog에 export하면 안 됩니다.

### 검증

구조적 변경은 먼저 영향받은 narrow test를 실행하고, 이후 repo quality gate를 확인합니다.

- `uv run ruff check src tests scripts`
- `uv run mypy src`
- `uv run pytest -q -m "not slow" -x`
- `pnpm --dir apps/web artifact:check`
- `pnpm --dir apps/web typecheck`

## English

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
