# Worker 6 Meta-Strategy Verification — Corrected Artifact

## Scope
- Team task: `12` amendment.
- Corrected artifacts audited:
  - `.omx/quant/leader-meta-search-fixed.json`
  - `.omx/quant/team-candidates/leader-meta-search-fixed.py`
  - `data/sim/equity_daily.csv`
- Superseded/flagged artifact:
  - `.omx/quant/leader-meta-search.json`
  - `.omx/quant/team-candidates/leader-meta-search.py`

## Final verdict
**PASS for a corrected full-period Sortino hit; CAUTION for train/test robustness and selection overfit.**

- Corrected robust candidate: `rotate_trail_sharpe_lb189_top4_none`.
- Full-period threshold: **PASS** by Sortino, not Sharpe.
  - Sharpe `1.714893` (< 2.0)
  - Sortino LPM0 `2.649323` (>= 2.0)
  - Sortino downside-std `2.195939` (>= 2.0)
- Chronological split robustness: **mixed**.
  - 2021-2023 Sharpe `1.401686` and downside-std Sortino `1.862727` are below 2.0, but LPM0 Sortino `2.200674` is above 2.0.
  - 2024-2026 Sharpe `2.079009`, LPM0 Sortino `3.157876`, and downside-std Sortino `2.572879` all exceed 2.0.
- Weak oracle exclusion: **PASS** — corrected script skips `persona == 'weak_oracle'` before pivoting returns.
- No-lookahead guard: **PASS** by source inspection and recomputation — trailing rotation scores are shifted one trading day before same-day returns.
- Old artifact status: **INVALID/SUPERSEDED** — the first `leader-meta-search.json` overstated the hit; its best `smic_mtt_strategy_top21_mom_vol0.08_lb63` is not present in the corrected top-50.

## Corrected candidate metrics

| Window | Days | Sharpe | Sortino LPM0 | Sortino downside-std | CAGR | Max drawdown | Total return | Ann vol |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Full | 1399 | 1.714893 | 2.649323 | 2.195939 | 0.560821 | -0.166634 | 10.841754 | 0.283212 |
| 2021-2023 | 780 | 1.401686 | 2.200674 | 1.862727 | 0.408854 | -0.166634 | 1.889190 | 0.270748 |
| 2024-2026 | 619 | 2.079009 | 3.157876 | 2.572879 | 0.775868 | -0.152056 | 3.098642 | 0.297964 |

## Independent recomputation formula
For the corrected target, I recomputed from `data/sim/equity_daily.csv`:

```text
flow_adjusted_ret(persona,t) = (equity_t - equity_(t-1) - Δcontributed_capital_t) / equity_(t-1)
mat = all non-weak_oracle persona return series with >=1000 observations, missing returns filled with 0
score_t = trailing_mean_189(mat) / trailing_std_189(mat)
selected_t = top 4 personas by score_(t-1)
strategy_ret_t = average current-day returns of selected_t
```

This exactly matched `leader-meta-search-fixed.json` for full and split metrics; all numeric diffs were `0.0` for reported fields.

## Corrected script rerun/source checks
- `leader-meta-search-fixed.py` generated `candidate_count=2772` and `goal_hit_count=255` in the checked artifact.
- Source guards confirmed:
  - weak oracle skipped before pivot: `if persona=='weak_oracle': continue`
  - flow-adjusted returns: `eq-eq.shift(1)-(cc-cc.shift(1))`
  - rotation score shifted: `sc=score.shift(1)`
  - rotation momentum gate shifted: `mom_s=mom.shift(1)`
  - persona momentum overlays shifted: `sig=((eq/eq.shift(look)-1)>0).shift(1)`
  - vol-cap overlays shifted: rolling std `.shift(1)*sqrt(252)`
- The specific target `rotate_trail_sharpe_lb189_top4_none` is a rotation ensemble using the shifted trailing-Sharpe score, `lookback=189`, `top_k=4`, `gate=none`.

## Old artifact invalidation
The previous worker-6 meta verification committed before the amendment treated `smic_mtt_strategy_top21_mom_vol0.08_lb63` from `.omx/quant/leader-meta-search.json` as reproducible. The leader amendment identified return-alignment overstatement. Under the corrected artifact:

- Corrected top candidate is `all_weather_momfilter_lb504` by LPM0 Sortino, not the old MTT vol target.
- Requested robust candidate `rotate_trail_sharpe_lb189_top4_none` has downside-std Sortino `2.195939`.
- Old `smic_mtt_strategy_top21_mom_vol0.08_lb63` is absent from corrected top-50.

Therefore, `.omx/quant/leader-meta-search.json` should be treated as **superseded/invalid for promotion decisions**.

## Overfit / validity flags
1. **Valid non-oracle Sortino hit** under the corrected full-period math.
2. **Not a Sharpe hit** for the robust candidate (`1.714893`).
3. **Sortino-definition sensitivity**: downside-std Sortino passes full-period but misses the 2021-2023 split; LPM0 Sortino passes both splits.
4. **Selection overfit remains material**: 2772 candidates were searched on the same sample.
5. **Split evidence is supportive but not final**: 2024-2026 is strong, while 2021-2023 is weaker by Sharpe/downside-std Sortino.

## Recommended next validation
Freeze `rotate_trail_sharpe_lb189_top4_none` and validate with walk-forward selection or a future untouched period before productizing. If the project uses Sortino, explicitly choose and document the denominator (`downside_std` vs `LPM0`) because pass/fail differs on the train split.

## Final task-12 result
Task-12 amended verification result: **PASS corrected full-period Sortino>=2 hit; old artifact invalid; CAUTION overfit and split sensitivity.**
