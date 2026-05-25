# 053 TrailTrim25Cap25 Retention Rank Band

## Idea

Iteration 052 rejected more exposure tuning. This iteration tests whether the current leader's edge depends on the retained-holding rank band.

The canonical rule keeps existing holdings if their `board_score` rank is inside Top20, subject to minimum holding days. Test Top15, Top25, and Top30 around the current Top20 setting.

## Point-in-time contract

- Retention ranking uses only PIT `board_score`.
- New-entry ranking uses only PIT `candidate_score`.
- No realized future return, target-hit outcome, or expiry classification is used.
- This is a parameter-only mutation of the existing retention threshold.

## Buy rule

Same as TrailTrim25Cap25:

- quarterly rebalance,
- `top_n=5`,
- report age <= 540 calendar days,
- require MA stack,
- require distance from 52-week high >= -20%,
- fill new slots by `candidate_score`.

## Sell/rebalance rule

Only this field changes:

- Rank15: sell retained holdings once they fall outside Top15 by `board_score`.
- Rank20: canonical leader.
- Rank25: allow retained holdings to drift to Top25.
- Rank30: allow retained holdings to drift to Top30.

All other sell logic is unchanged:

- weekly retained-winner cap,
- trailing profit trim after +100% peak and 25% drawdown,
- minimum holding days,
- no equal-weight sell-down of still-valid winners.

## Result

Generated report: [053-trailtrim25cap25-retention-rank-band-generated.md](053-trailtrim25cap25-retention-rank-band-generated.md)

| account | MWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Rank15 | 77.10% | 43.57% | 27.47% | 1.1925 | 1.8528 | 713.2M | 136 |
| Rank20 canonical | 77.10% | 43.57% | 27.47% | 1.1925 | 1.8528 | 713.2M | 136 |
| Rank25 | 77.10% | 43.57% | 27.47% | 1.1925 | 1.8528 | 713.2M | 136 |
| Rank30 | 77.10% | 43.57% | 27.47% | 1.1925 | 1.8528 | 713.2M | 136 |
| Clean Mixed Entry | 76.66% | 43.30% | 27.47% | 1.1847 | 1.8393 | 705.8M | 131 |

Daily equity delta versus the canonical TrailTrim25Cap25 account is exactly zero for Rank15, Rank25, and Rank30.

## Retrospective

Rejected as a strategy mutation, accepted as boundary evidence.

The rank-band parameter is not active on this path. The live held names either remain comfortably inside Top15 or exit through another mechanism before the rank threshold matters. This means the current leader's edge is not a fragile Top20-retention artifact.

It also means further rank-band tuning is wasted effort. The simulator is telling us that current performance is controlled by:

1. entry-slot ordering,
2. letting winners run,
3. retained-winner concentration trims,
4. trailing partial profit trims.

The next branch should not test Rank10/12/18/35. That would be parameter theater.

## Next mutation

Inspect whether the existing trailing partial trim should have a cooldown after firing. The hypothesis:

- If a trim fires, the strategy already realized profit and redeployed capital.
- Repeated trims on the same symbol may be useful, but they may also overfit a single volatile winner.
- A cooldown can be tested as a real path change only if it alters the five existing trim fills.

Implement only one small rule if the audit justifies it:

- after `trailing_profit_trim`, do not trim the same symbol again for 20 trading days.

If that does not change fills or worsens performance, reject immediately.

## Verification

```powershell
uv run --locked ruff format src/snusmic_pipeline/sim/contracts.py tests/sim/test_contracts.py
uv run --locked pytest tests/sim/test_contracts.py -q
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline research-report --sim data/sim --accounts pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_rank15_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_rank25_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_rank30_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5,benchmark_kodex200,all_weather --baseline pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5 --title "053 TrailTrim25Cap25 Retention Rank Band" --out docs/research/iterations/053-trailtrim25cap25-retention-rank-band-generated.md
```
