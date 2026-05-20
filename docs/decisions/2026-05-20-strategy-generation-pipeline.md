# Strategy generation pipeline approval gate

## Decision

Generated personas are approved only after the final broker-ledger portfolio simulation beats the strongest non-oracle benchmark.  Search replay metrics are candidate-generation diagnostics, not product approval.

## Findings

- Strongest benchmark for the current 2021-01-04..2026-05-19 simulation is `benchmark_kodex200` with money-weighted return 41.73%.
- Previously exported stock-rule personas had high vector-replay returns, but failed the final portfolio ledger benchmark gate. They were removed from `stock-rule-personas.json` and no longer appear in the portfolio catalog.
- The default hand-written `smic_mtt_strategy` was not removed because of a confirmed future-reference bug; it disappeared when prior runs used `--disable-broker-strategy-search`. Its default config underperformed KODEX200, so it is not promoted as-is.
- Broker-ledger MTT search found two benchmark-beating rule personas: `smic_mtt_strategy_top1` (52.84% MWR) and `smic_mtt_strategy_top2` (46.15% MWR). Their daily equity-return correlation is ~0.16, so both survive the 0.90 correlation compression gate.
- KRAFTON (`259960.KQ`) was shown as above each individual SMA but not truly “정배열”: latest close 282,000 >= SMA20 275,075 and SMA50 253,300, but SMA50 < SMA200 272,580. The screener now separates individual SMA checks from the strict stack `price >= SMA20 >= SMA50 >= SMA200`.

## Pipeline contract

1. Compute the strongest non-oracle benchmark from the baseline portfolio run.
2. Generate stock-rule candidates with IS search and full-sample replay only as a cheap candidate filter.
3. Run candidate personas through the final portfolio simulation ledger.
4. Reject every generated persona whose final money-weighted return is not above the benchmark.
5. Compress highly correlated generated strategies by keeping the higher-return survivor.
6. Export only survivors into `persona-configs.json`, web artifacts, and portfolio routes.

## Rejected alternatives

- Keep vector-replay stock rules if they have Sharpe/Sortino/return targets: rejected because user approval is portfolio-level benchmark outperformance.
- Keep `/strategies` as legacy fallback: rejected by explicit product direction; strategy details live under `/portfolio`.
- Treat individual `price > SMA` columns as “정배열”: rejected because strict stack ordering is different.
