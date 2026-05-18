# Persona simulation contract

**Status:** accepted; keep this document synchronized with the code.
**Code source of truth:** `src/snusmic_pipeline/sim/contracts.py`,
`src/snusmic_pipeline/sim/runner.py`, and `scripts/run_persona_sim.py`.
**Scope:** share-based account-level simulation for benchmark, oracle, SMIC
follower, and broker-ledger strategy personas on the SNUSMIC report universe.

## Why this exists

The simulation surface models what a Korean retail brokerage account shows:
KRW cash, integer-share holdings, weighted-average cost, fees/tax/slippage,
monthly savings-plan deposits, position episodes, and mark-to-market equity.
It is not a weight-only portfolio comparison layer and it is not a live trading
engine.

The Python pipeline builds the report/price warehouse, `snusmic_pipeline.sim`
runs the share-ledger experiment, and `snusmic_pipeline.web_artifacts` exports
the page-owned `data/web/**` artifacts consumed by the Next.js app.

## Account scenario defaults

| Field | Default | Code contract |
| --- | ---: | --- |
| `initial_capital_krw` | 10,000,000 | One-shot deposit on day 0 |
| `monthly_contribution_krw` | 1,000,000 | First trading day of each later month |
| `escalation_step_krw` | 500,000 | Step-up amount per escalation tick |
| `escalation_period_years` | 2 | Month 25 adds one step, month 49 adds two, etc. |
| `max_escalations` | 10 | Upper bound on contribution step-ups |
| `commission_bps` | 1.5 | 0.015% per fill |
| `sell_tax_bps` | 18.0 | 0.18% sell-side tax |
| `slippage_bps` | 5.0 | 0.05% adverse modeled slippage |
| `report_expiry_days` | 730 | Report validation and follower holdings expire after this window |

These values live on frozen Pydantic models (`SavingsPlan`, `BrokerageFees`,
`SimulationConfig`) with `extra="forbid"` so shape drift fails at the boundary.

## Persona and benchmark taxonomy

`SimulationConfig.personas` currently ships these defaults:

| ID | Label | Product role |
| --- | --- | --- |
| `all_weather` | All-Weather (25/25/25/25) | benchmark basket |
| `benchmark_qqq` | QQQ (NASDAQ-100) | benchmark |
| `benchmark_spy` | SPY (S&P 500) | benchmark |
| `benchmark_kodex200` | KODEX 200 (069500.KS) | benchmark |
| `benchmark_gld` | GLD (Gold ETF) | benchmark |
| `smic_follower` | SMIC Follower (1/N) | SMIC baseline |
| `smic_follower_v2` | SMIC Follower (SL) | stop-loss SMIC baseline |
| `weak_oracle` | Weak Prophet (3M oracle) | future-information oracle baseline |

`scripts/run_persona_sim.py` may append promoted `smic_mtt_strategy(_topN)`
configs after broker-ledger strategy search. The web strategy catalog then marks
rows as `benchmark`, `strategy`, or `oracle`; the frontend must read that
classification from `data/web/strategies/catalog.json` instead of inferring it
from string prefixes.

### `oracle` — Prophet

`ProphetConfig` is an SMIC-constrained oracle. It only chooses among published
SMIC reports, can look ahead up to `lookahead_months` (default 6), and keeps the
upper-bound interpretation explicit. It is not executable.

### `weak_oracle` — Weak Prophet (3M oracle)

`WeakProphetConfig` is a forward-looking max-Sharpe oracle benchmark over a
future window (`lookahead_months` default 3). It is intentionally stronger than
realistic strategies and must be labelled as future-information/oracle-only in
product surfaces.

### `smic_follower` — 1/N true believer

Buys active SMIC report names with available price data, reacts on daily
rebalance events by reallocating across active names, sells on target hit, and
otherwise keeps holdings until simulation end or report-expiry behavior applies.

### `smic_follower_v2` — 1/N with stop-loss exits

Adds three sell gates to the follower baseline:

| Rule | Default | Reason code |
| --- | ---: | --- |
| held while red | `time_loss_days = 365` | `stop_loss_time` |
| averaged-down loss | `averaged_down_stop_pct = 0.20` | `stop_loss_average_down` |
| report too old | `report_age_stop_days = 730` | `stop_loss_report_age` |

### `smic_mtt_strategy(_topN)` — promoted report-trend strategy family

This is the practical strategy family promoted by the Optuna search in
`scripts/run_persona_sim.py`. The internal id keeps `smic_mtt_strategy_topN`
for compatibility, but user-facing names should describe the actual behavior
(`Global/Overseas/Korea Report Trend …`) rather than treating MTT as the
strategy name. MTT is one trend-template filter inside the family. The family
trades integer shares, keeps cash, pays costs, uses report-day signals and local
trend filters, limits positions, supports universe/top-up cadence controls, and
exits on target, stop-loss, report age, or simulation end.

Broker search arguments:

- `--disable-broker-strategy-search`
- `--broker-strategy-trials`
- `--broker-strategy-top` (`0` promotes every qualifying strategy)
- `--broker-strategy-seed`
- `--broker-strategy-train-start`
- `--broker-strategy-train-end`

Admission compares candidate money-weighted return against the best tradable
benchmark; `weak_oracle` is excluded from that benchmark choice because it uses
future information.

The search now writes `data/sim/broker_strategy_trials.csv` when it runs. The
web exporter turns that file into `strategy-admission.json` so the product can
explain accepted, below-benchmark, and duplicate-behavior candidates without
pinning stale labels such as a historical top-22 run.

## Realistic profit calculation

Every persona shares the same ledger semantics:

```text
cash_krw
holdings[symbol] = integer qty + weighted-average cost + accumulated buy cost
realized_pnl_krw
mark-to-market equity = cash + Σ(qty × close_price)
net_profit = equity - contributed_capital
```

A buy fill subtracts gross value plus commission from cash. A sell fill adds
proceeds net of commission and sell tax, then recognizes PnL against the moving
average cost basis. This intentionally matches a brokerage-like account view,
not a fractional-weight backtest.

## Data contracts

Everything crossing module boundaries is a Pydantic v2 model with
`extra="forbid"` and frozen config where appropriate. Current boundary models
include:

- configs: `SavingsPlan`, `BrokerageFees`, `BenchmarkAsset`,
  `AllWeatherConfig`, `ProphetConfig`, `WeakProphetConfig`,
  `SmicFollowerConfig`, `SmicFollowerV2Config`, `SmicMttStrategyConfig`,
  `SimulationConfig`
- event/result rows: `Trade`, `EquityPoint`, `PositionEpisode`,
  `CurrentHolding`, `ReportPerformance`, `ReportStats`, `MonthlyHolding`,
  `SymbolStat`, `PersonaSummary`, `SimulationResult`

New simulation knobs belong in the relevant contract model first; the runner
reads `SimulationConfig` and must not rely on hidden globals.

## Outputs

`scripts/run_persona_sim.py` writes to `data/sim`:

- `personas.json` — full rounded `SimulationResult` dump; intentionally large
- `persona-configs.json` — compact persona/method config artifact for web export
- `summary.csv` — persona-level final performance rows
- `equity_daily.csv` — daily mark-to-market equity and cash
- `trades.csv` — fill ledger
- `position_episodes.csv` — open/closed holding episodes
- `current_holdings.csv` — current open holdings
- `symbol_stats.csv` — lifetime symbol aggregates per persona
- `monthly_holdings.csv` — month-end holding weights
- `report_performance.csv` — report-level validation rows
- `report_stats.json` — aggregate report statistics when available
- `equity_curves.png`, `net_profit_bar.png`, `drawdowns.png`
- `portfolio_composition.png` when monthly holdings exist

The frontend does not read these raw simulation files directly. The canonical
web boundary is the exported `data/web/**` artifact set.
