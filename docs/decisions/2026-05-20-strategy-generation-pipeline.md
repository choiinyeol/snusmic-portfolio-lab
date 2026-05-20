# Strategy generation pipeline approval gate

## Decision

Generated personas are approved after final broker-ledger portfolio simulation evidence and high-correlation compression. Benchmark-relative return is kept for comparison, but lagging the strongest non-oracle benchmark is no longer a hard product rejection because a strategy can still be useful when it is similar in return profile, lower risk, or diversifying.

## Findings

- Strongest benchmark for the current 2021-01-04..2026-05-19 simulation is `benchmark_kodex200` with money-weighted return 41.73%.
- Previously exported stock-rule personas had high vector-replay returns, but the old final portfolio ledger benchmark gate removed them. That benchmark gate is now deprecated in favor of validation goals plus correlation compression.
- The default hand-written `smic_mtt_strategy` was not removed because of a confirmed future-reference bug; it disappeared when prior runs used `--disable-broker-strategy-search`. Its default config underperformed KODEX200, so it is not promoted as-is.
- Broker-ledger MTT search now promotes three rule personas because benchmark lag is no longer a hard rejection reason: `smic_mtt_strategy_top1`, `smic_mtt_strategy_top2`, and `smic_mtt_strategy_top3`.
- KRAFTON (`259960.KQ`) was shown as above each individual SMA but not truly “정배열”: latest close 282,000 >= SMA20 275,075 and SMA50 253,300, but SMA50 < SMA200 272,580. The screener now separates individual SMA checks from the strict stack `price >= SMA20 >= SMA50 >= SMA200`.
- Re-running the same historical simulation is wasteful when only admission policy changes. Strategy generation now reuses existing stock-rule validation rows with `SNUSMIC_REUSE_STOCK_RULE_ADMISSION=1`, reuses broker trial ledgers by default, and caches deterministic simulation stages under `data/sim/.cache/strategy-generation/` keyed by warehouse mtimes, dates, and persona config.

## Pipeline contract

1. Compute the strongest non-oracle benchmark from the baseline portfolio run.
2. Generate stock-rule candidates with IS search and full-sample replay only as a cheap candidate filter.
3. Run candidate personas through the final portfolio simulation ledger.
4. Keep benchmark excess return as audit metadata rather than a hard rejection status.
5. Compress strategies with return-path correlation ≥ 0.95 by keeping the higher-return survivor.
6. Export only survivors into `persona-configs.json`, web artifacts, and portfolio routes.

## Rejected alternatives

- Require every generated strategy to beat the benchmark: rejected because a validation window can favor the benchmark while the strategy remains useful by absolute return, risk, or diversification.
- Keep `/strategies` as legacy fallback: rejected by explicit product direction; strategy details live under `/portfolio`.
- Treat individual `price > SMA` columns as “정배열”: rejected because strict stack ordering is different.
