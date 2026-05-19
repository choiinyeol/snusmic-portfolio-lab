# Worker 6 Verification / Anti-Overfit Metrics

## Scope and data
- Team task: `11` / worker-6 verification reassignment.
- Local-only inputs audited: `data/warehouse/daily_prices.csv`, `data/warehouse/reports.csv`, existing leader outputs under `data/sim`, and candidate directory `/Users/qraft_inyeolchoi/Desktop/inyeol/code/smic-portfolio/.omx/quant/team-candidates`.
- Candidate files present at verification time: `worker-3-search.py`, `worker-3.json`, `worker-4-generate.py`, `worker-4.json`, `worker-5-search.py`, `worker-6-verification.md`.

## Metric formula used for independent sanity check
For existing `data/sim/equity_daily.csv`, I recomputed daily return as:

```text
flow_adjusted_return_t = (equity_t - equity_(t-1) - Δcontributed_capital_t) / equity_(t-1)
annualized_sharpe = mean(flow_adjusted_return) / sample_std(flow_adjusted_return) * sqrt(252)
annualized_sortino = mean(flow_adjusted_return) / sqrt(mean(min(return, 0)^2)) * sqrt(252)
```

This avoids treating monthly deposits as investment alpha.

## Existing leader-output sanity results
- Excluding `weak_oracle` because it is explicitly a forward-looking 3-month oracle benchmark, **no existing persona reaches annualized Sharpe >= 2.0 or Sortino >= 2.0** under the flow-adjusted return check.
- `weak_oracle` does exceed the threshold (Sharpe 4.8476 / Sortino 4.8180), but it should not count as a valid deployable strategy because it uses lookahead by design.

| persona | label | annualized_sharpe | annualized_sortino | cagr | max_drawdown | money_weighted_return | trade_count | open_positions | days |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| weak_oracle | Weak Prophet (3M oracle) | 4.8476 | 4.8180 | 1.0253 | 0.2163 | 1.6815 | 2504 | 0 | 1398 |
| all_weather | All-Weather (25/25/25/25) | 1.5058 | 1.4955 | 0.1635 | 0.0946 | 0.3133 | 186 | 4 | 1398 |
| smic_mtt_strategy_top4 | Global Report Trend Broad #4 | 1.2645 | 1.2972 | 0.2878 | 0.4211 | 0.5288 | 161 | 9 | 1398 |
| smic_mtt_strategy_top2 | Global Report Trend Broad #2 | 1.2543 | 1.2792 | 0.2838 | 0.4211 | 0.5219 | 160 | 8 | 1398 |
| smic_mtt_strategy_top5 | Global Report Trend Broad #5 | 1.2465 | 1.2700 | 0.2823 | 0.4209 | 0.5195 | 160 | 9 | 1398 |
| smic_mtt_strategy_top1 | Global Report Trend Broad #1 | 1.2447 | 1.2764 | 0.2769 | 0.4211 | 0.5104 | 159 | 9 | 1398 |
| smic_mtt_strategy_top7 | Overseas Report Trend Broad #7 | 1.2075 | 1.1401 | 0.2699 | 0.4334 | 0.4985 | 76 | 4 | 1398 |
| smic_mtt_strategy_top6 | Overseas Report Trend Broad #6 | 1.2075 | 1.1389 | 0.2708 | 0.4337 | 0.5000 | 76 | 4 | 1398 |
| smic_mtt_strategy_top8 | Global Report Trend Broad #8 | 1.1982 | 1.1177 | 0.2495 | 0.2716 | 0.4637 | 143 | 8 | 1398 |
| smic_mtt_strategy_top3 | Global Report Trend Broad #3 | 1.1970 | 1.2268 | 0.2509 | 0.4206 | 0.4661 | 158 | 7 | 1398 |
| smic_mtt_strategy_top15 | Global Report Trend Broad #15 | 1.1947 | 1.1154 | 0.2653 | 0.2866 | 0.4908 | 120 | 4 | 1398 |
| smic_mtt_strategy_top13 | Global Report Trend Balanced #13 | 1.1557 | 1.1174 | 0.2506 | 0.2323 | 0.4657 | 125 | 8 | 1398 |
| benchmark_gld | GLD (Gold ETF) | 1.1387 | 1.1008 | 0.1634 | 0.1483 | 0.3131 | 65 | 1 | 1398 |
| smic_mtt_strategy_top14 | Global Report Trend Broad #14 | 1.1151 | 1.1355 | 0.2331 | 0.4123 | 0.4356 | 167 | 8 | 1398 |

## Split-window anti-overfit check
The strongest valid MTT candidates are materially below the target in both train/test windows; they also show high drawdowns (~42%).

| persona | label | annualized_sharpe_2021-2023 | annualized_sortino_2021-2023 | annualized_sharpe_2024-2026 | annualized_sortino_2024-2026 | days_2021-2023 | days_2024-2026 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| all_weather | All-Weather (25/25/25/25) | 0.6784 | 0.6801 | 2.4154 | 2.3390 | 779.0000 | 618.0000 |
| smic_mtt_strategy_top1 | Global Report Trend Broad #1 | 1.4144 | 1.4571 | 1.0206 | 1.0390 | 779.0000 | 618.0000 |
| smic_mtt_strategy_top2 | Global Report Trend Broad #2 | 1.4144 | 1.4571 | 1.0454 | 1.0506 | 779.0000 | 618.0000 |
| smic_mtt_strategy_top4 | Global Report Trend Broad #4 | 1.4144 | 1.4571 | 1.0690 | 1.0894 | 779.0000 | 618.0000 |
| smic_mtt_strategy_top5 | Global Report Trend Broad #5 | 1.4015 | 1.4395 | 1.0447 | 1.0517 | 779.0000 | 618.0000 |

## Candidate file audit
- `worker-3.json`: PASS parse; rows=40, reported_highlight_count=0, recomputed_goal_hits_in_file=0, min_sample_or_active_days=1773, best_metrics={'sample_days': 1773, 'annualized_sharpe': 0.397184, 'annualized_sortino': 0.070374, 'cagr': 0.011054, 'max_drawdown': 0.052569, 'cumulative_return': 0.080416, 'daily_volatility': 0.00180887}.
- `worker-4.json`: PASS parse; rows=24, reported_highlight_count=n/a, recomputed_goal_hits_in_file=0, min_sample_or_active_days=0, best_metrics={'active_days': 1437, 'annualized_return': 0.25897714238637715, 'annualized_volatility': 0.27860694472851577, 'avg_positions': 8.027835768963117, 'max_drawdown': 0.3063957563335037, 'max_positions': 10, 'sharpe': 0.929543025708614, 'signal_count': 113, 'sortino': 1.201486485476688, 'total_return': 5.375417355928335}.
- `worker-3-search.py`: PASS no-lookahead source check: trailing close momentum/MA signals are converted to weights, then `weights.shift(1)` is applied before returns; warmup is dropped and output requires `sample_days >= 252`.
- `worker-4-generate.py`: PASS no-lookahead source check: breakout high uses `.rolling(...).max().shift(1)`, signals start on/after report publication, and portfolio returns use `weights.shift(1)`; output reports `active_days` and signal_count.
- `worker-5-search.py`: PASS no-lookahead source check: reports are filtered with `publication_date <= day`, rebalance-day signals start at `get_loc(day)+1`, and returns are earned only from the next trading day; output reports observations/active_days.

## Overfit / validity flags
1. **No verified non-oracle threshold hit yet**: current leader outputs and candidate directory do not contain a deployable Sharpe/Sortino >= 2 result verified by worker-6.
2. **Weak oracle is invalid for goal success**: it intentionally uses future 3-month information; keep it benchmark-only.
3. **MTT family concentration**: top existing candidates are close variants of the same report-trend family with similar drawdowns and return paths; treat multiple hits in that family as parameter-neighbor evidence, not independent discoveries.
4. **Drawdown risk**: best MTT candidates have ~0.42 max drawdown despite good CAGR/MWR; high absolute return does not translate to Sharpe >= 2.
5. **Candidate generator audit gap**: `worker-5-search.py` was auditable, but not all candidate JSON from workers 3/4/5 was present when this report was generated. Re-run this verification after workers 3/4/5 emit JSON artifacts.

## Rerun commands
```bash
# Existing leader-output metric sanity
python3 - <<'PY_METRICS'
import pandas as pd, numpy as np
E=pd.read_csv('data/sim/equity_daily.csv', parse_dates=['date'])
for persona,g in E.groupby('persona'):
    g=g.sort_values('date')
    r=(g.equity_krw-g.equity_krw.shift(1)-g.contributed_capital_krw.diff().fillna(0))/g.equity_krw.shift(1)
    r=r.replace([np.inf,-np.inf],np.nan).dropna()
    if len(r)>1:
        down=r[r<0]
        sharpe=r.mean()/r.std(ddof=1)*np.sqrt(252)
        sortino=r.mean()/np.sqrt((down**2).mean())*np.sqrt(252) if len(down) else np.nan
        print(persona, round(float(sharpe),4), round(float(sortino),4), len(r))
PY_METRICS

# Audit available candidate files
ls -la /Users/qraft_inyeolchoi/Desktop/inyeol/code/smic-portfolio/.omx/quant/team-candidates
```

## Verdict
PASS for verification artifact generation and metric sanity. FAIL/NOT MET for deployable goal threshold from currently available non-oracle outputs: no verified candidate reaches annualized Sharpe >= 2.0 or Sortino >= 2.0 as of this report.
