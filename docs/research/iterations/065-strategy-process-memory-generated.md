# Strategy Process Memory

AlphaMemo-style research-only memory over `PitSignalRuleConfig` diffs. Positive residuals are guidance only; high-confidence repeated failure motifs can veto future search branches.

## Coverage

- curated edges: 22
- extracted from current sim artifacts: 2
- extracted single-motif stats rows: 1
- skipped because the current `data/sim` shortlist lacks required parent/child config or summary rows: 20
- `mixed_config_change` edges remain visible in Extracted Edges but are excluded from motif/veto statistics to avoid false precision.
- this report is research-only and must not be used for product promotion or automatic branch admission.

## Context/Motif Statistics

| context | motif | n | mean residual | confidence | failure p | veto |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `retained_cap|medium|medium_dd|low_turnover` | `switch_score_field` | 1 | -0.0703 | 0.250 | 0.333 | no |

## Extracted Edges

| parent | child | motif | status | residual | changed fields | evidence |
| --- | --- | --- | --- | ---: | --- | --- |
| `pit_score_top5` | `pit_trend_top5` | `mixed_config_change` | accepted | 0.1903 | `allow_rebalance_sell_down, entry_confirmation_rebalances, exit_below_50ma, market_gate, market_gate_symbol, min_distance_from_52w_high, min_holding_days, min_report_age_days, quarter_offset_months, rank_mode, redeploy_after_trailing_trim, redeploy_after_trailing_trim_buy_fraction, replacement_delay_rebalances, require_above_150ma, require_above_200ma, require_above_50ma, require_ma_stack, require_macd_bullish, require_mtt_template, retained_weight_cap_cadence, rotate_on_exit, score_field, target_gross_exposure, trail_trim_cooldown_days, volatility_lookback_days, weighting` | 001 trend ranking beat score ranking. |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5` | `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5` | `switch_score_field` | accepted | -0.0703 | `score_field` | 032 candidate score improved Profit60 shell. |

## Skipped Curated Edges

| parent | child | reason |
| --- | --- | --- |
| `pit_trend_top5` | `pit_trend_top7` | missing child config in sim artifact |
| `pit_trend_top5` | `pit_trend_persist20_top5` | missing child config in sim artifact |
| `pit_trend_persist20_top5` | `pit_trend_persist20_top3` | missing parent config in sim artifact |
| `pit_trend_persist20_quarterly_top5` | `pit_trend_quarterly_fresh540_top5` | missing parent config in sim artifact |
| `pit_trend_quarterly_fresh540_top5` | `pit_trend_quarterly_fresh540_top3` | missing parent config in sim artifact |
| `pit_trend_quarterly_fresh540_top5` | `pit_trend_quarterly_fresh540_top7` | missing parent config in sim artifact |
| `pit_trend_quarterly_fresh540_top5` | `pit_trend_quarterly_fresh540_runwinners_top5` | missing parent config in sim artifact |
| `pit_trend_quarterly_fresh540_runwinners_top5` | `pit_trend_quarterly_fresh540_runwinners_top3` | missing parent config in sim artifact |
| `pit_trend_quarterly_fresh540_runwinners_top5` | `pit_trend_quarterly_fresh540_runwinners_top7` | missing parent config in sim artifact |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5` | `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top3` | missing child config in sim artifact |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5` | `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top7` | missing child config in sim artifact |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5` | `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_delay1_top5` | missing child config in sim artifact |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5` | `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_confirm10_top5` | missing child config in sim artifact |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5` | `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5` | missing child config in sim artifact |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5` | `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top3` | missing parent config in sim artifact |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5` | `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top7` | missing parent config in sim artifact |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5` | `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5` | missing parent config in sim artifact |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5` | `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploy_top5` | missing child config in sim artifact |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5` | `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5` | missing child config in sim artifact |
| `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5` | `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5` | missing parent config in sim artifact |
