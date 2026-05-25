# 055 TrailTrim Cap and Drawdown Boundaries

## Idea

Iteration 054 showed that suppressing repeated trims slightly hurts absolute return. This iteration tests the trim mechanics more directly:

- Should the strategy trim winners down harder after the same 25% drawdown?
- Or should the drawdown trigger itself move earlier/later while keeping the 25% weight cap?

The goal is not to add a new signal. It is to tune how much profit is taken after an already-observed winner pulls back.

## Point-in-time contract

- Entry and retention rankings still use only PIT board data available on each rebalance date.
- Trailing trim uses only the account's own observed holding-period high, current price, average cost, and current account equity.
- No future return, target-hit outcome, expiry label, or ex-post winner label is used.

## Buy rule

Same as the current TrailTrim25Cap25 leader:

- quarterly rebalance,
- `top_n=5`,
- report age <= 540 calendar days,
- require MA stack,
- require distance from 52-week high >= -20%,
- retain existing holdings by `board_score`,
- fill new slots by `candidate_score`.

## Sell/rebalance rule

Same as TrailTrim25Cap25 except for one trim parameter at a time:

- Cap20: after +100% peak and 25% drawdown, trim toward 20% account weight.
- Cap25: canonical prior leader.
- Cap30: after +100% peak and 25% drawdown, trim toward 30% account weight.
- Drawdown20: trim toward 25% account weight after 20% drawdown.
- Drawdown30: trim toward 25% account weight after 30% drawdown.

## Result

Generated report: [055-trailtrim-cap-drawdown-boundaries-generated.md](055-trailtrim-cap-drawdown-boundaries-generated.md)

| account | MWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| TrailTrim25Cap20 | 77.22% | 43.64% | 27.47% | 1.1956 | 1.8570 | 715.1M | 136 |
| TrailTrim25Cap25 prior leader | 77.10% | 43.57% | 27.47% | 1.1925 | 1.8528 | 713.2M | 136 |
| TrailTrim25Cap30 | 76.74% | 43.35% | 27.47% | 1.1865 | 1.8432 | 707.2M | 135 |
| TrailTrim20Cap25 | 76.01% | 42.89% | 27.47% | 1.1861 | 1.8358 | 695.2M | 145 |
| TrailTrim30Cap25 | 76.69% | 43.31% | 27.47% | 1.1864 | 1.8439 | 706.3M | 136 |
| Clean Mixed Entry | 76.66% | 43.30% | 27.47% | 1.1847 | 1.8393 | 705.8M | 131 |

TrailTrim25Cap20 becomes the new absolute-return leader:

- +1.9M KRW final equity over TrailTrim25Cap25,
- same 27.47% MDD,
- higher Sharpe and Sortino,
- same total trade count.

## Retrospective

Accepted as the new branch best.

The important signal is asymmetric:

- Trimming to 20% after the same 25% drawdown improves the path.
- Trimming to 30% is too loose and gives back most of the partial-trim benefit.
- Triggering earlier at 20% drawdown creates too much activity: 14 trailing trims and much weaker return.
- Triggering later at 30% drawdown is also inferior.

So the useful lever is not "trim more often"; it is "when the existing trigger fires, reduce the winner a bit more aggressively."

## Next mutation

Do not test more cooldown variants. The next useful branch is a narrow cap neighborhood around the new leader:

- TrailTrim25Cap15,
- TrailTrim25Cap18,
- TrailTrim25Cap22.

If Cap15 starts cutting too much compounding, Cap18/20/22 should reveal the practical plateau.

## Verification

```powershell
uv run --locked ruff format src/snusmic_pipeline/sim/contracts.py tests/sim/test_contracts.py
uv run --locked pytest tests/sim/test_contracts.py -q
uv run --locked python -m snusmic_pipeline run-sim --warehouse data/warehouse --out data/sim --end 2026-05-22
uv run --locked python -m snusmic_pipeline research-report --sim data/sim --accounts pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap30_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim20cap25_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim30cap25_top5,pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5,benchmark_kodex200,all_weather --baseline pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5 --title "055 TrailTrim Cap and Drawdown Boundaries" --out docs/research/iterations/055-trailtrim-cap-drawdown-boundaries-generated.md
```
