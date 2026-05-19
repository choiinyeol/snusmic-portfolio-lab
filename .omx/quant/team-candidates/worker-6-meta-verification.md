# Worker 6 Meta-Strategy Verification

## Scope
- Team task: `12` / verify leader meta-strategy Sharpe/Sortino hit.
- Audited artifacts:
  - `.omx/quant/leader-meta-search.json`
  - `.omx/quant/team-candidates/leader-meta-search.py`
  - `data/sim/equity_daily.csv`
- Best claimed hit: `smic_mtt_strategy_top21_mom_vol0.08_lb63`.

## Verdict
**Metric hit is reproducible and non-oracle by source inspection, but it is exploratory/in-sample and carries high overfit risk.**

- Valid threshold check: **PASS** — recomputed full-period annualized Sharpe `6.436096` and Sortino `12.471594` both exceed `2.0`.
- Weak oracle exclusion: **PASS** — script drops columns containing `weak_oracle` before search.
- No-lookahead overlay: **PASS** — base returns are flow-adjusted from realized equity; the selected single-persona momentum signal uses `.shift(1)` and volatility sizing uses rolling volatility `.shift(1)` before multiplying current returns.
- Split robustness: **PASS mathematically** — both chronological splits exceed threshold.
- Production validity: **CAUTION** — the hit was selected from `2781` meta candidates on the same full sample, all top-20 hits cluster on `smic_mtt_strategy_top21`, and that base strategy itself came from prior strategy search. Treat as a promising research candidate, not an untouched out-of-sample proof.

## Recomputed best-hit metrics

| Window | Days | Sharpe | Sortino | CAGR | Max drawdown | Total return | Ann vol |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Full | 1399 | 6.436096 | 12.471594 | 0.693603 | -0.048298 | 17.632346 | 0.082473 |
| 2021-2023 | 780 | 5.024445 | 9.343858 | 0.476347 | -0.042245 | 2.339479 | n/a |
| 2024-2026 | 619 | 8.161788 | 16.311030 | 1.013457 | -0.048298 | 4.579416 | n/a |

## Independent reproduction evidence
I recomputed `smic_mtt_strategy_top21_mom_vol0.08_lb63` from `data/sim/equity_daily.csv` using the same flow-adjusted persona-return definition:

```text
ret_t = (equity_t - equity_(t-1) - (contributed_t - contributed_(t-1))) / equity_(t-1)
base = ret[smic_mtt_strategy_top21]
signal_t = ((cum_equity_t / cum_equity_(t-63) - 1) > 0).shift(1)
vol_t = rolling_std_63(base).shift(1) * sqrt(252)
leverage_t = clip(0.08 / vol_t, 0, 1.0)
strategy_ret_t = base_t * signal_t * leverage_t
```

The recomputed full and split metrics matched `leader-meta-search.json` with zero numerical difference for all reported fields (`days`, Sharpe, Sortino, CAGR, max drawdown, total return, annual volatility where present).

## Script rerun evidence
To avoid overwriting the enriched leader JSON, I ran a temp-patched copy of `.omx/quant/team-candidates/leader-meta-search.py` that writes to `/tmp/leader-meta-search-rerun.json`.

- Rerun candidate count: `2781` (matches artifact).
- Rerun goal hits: `20` (matches artifact).
- Rerun top candidate: `smic_mtt_strategy_top21_mom_vol0.08_lb63` (matches artifact).
- Rerun top Sharpe difference vs artifact: `0.0`.
- Warnings: pandas `FutureWarning` for `groupby.apply` grouping behavior and silent downcasting on `fillna`; these are reproducibility hygiene risks but did not change current output.

## Static no-lookahead checks
`leader-meta-search.py` contains the following guards:

- Flow-adjusted returns: `eq-eq.shift(1)-(cc-cc.shift(1))`.
- Weak oracle exclusion: `drop(columns=[c for c in mat.columns if 'weak_oracle' in c])`.
- Rotational scores shifted before returns: `sc=score.shift(1)`.
- Selected best trend signal shifted before returns: `sig=((eq/eq.shift(look)-1)>0).shift(1)`.
- Volatility estimate shifted before returns: rolling std `.shift(1)*sqrt(252)`.
- No leverage above 1x: `.clip(0,1.0)`.

## Overfit / leakage risk assessment
- **No direct lookahead found in the overlay mechanics.** The selected signal and volatility scaler are lagged one row before application.
- **Selection overfit risk is high.** The search evaluates thousands of overlays on the same 2021-2026 window and ranks by full-period Sharpe/Sortino.
- **Family concentration risk is high.** The top-20 hits all come from `smic_mtt_strategy_top21` variants, so they are parameter neighbors, not independent confirmations.
- **Nested optimization risk is high.** `smic_mtt_strategy_top21` was already an optimized/generated strategy, then optimized again by a meta overlay.
- **Split test is supportive but not definitive.** Both chronological splits pass, but the split boundaries and candidate choice were still observed during exploration.

## Recommended next validation
Before promotion beyond research, freeze `smic_mtt_strategy_top21_mom_vol0.08_lb63` parameters and test on one of:
1. a truly untouched future period,
2. walk-forward selection where the meta overlay is chosen only on past data and evaluated on next-period data,
3. a symbol/report bootstrap or block bootstrap that preserves clustered market regimes.

## Final task-12 result
Task-12 verification result: **PASS for reproducible non-oracle Sharpe/Sortino hit; CAUTION for overfit.**
