# Stock-rule persona search: IS ranking → Full Sample validation

Date: 2026-05-20

## Decision

Use the in-sample window only to rank/freeze candidate stock-level rules, then validate those frozen rules on the full available sample before promoting portfolio-native personas.

The goal is a set of universal, recognizable rule families rather than a strict robustness/OOS research paper gate. The current promoted set is generated from stock-level price/rule personas and written into the same portfolio ledger artifacts as hand-written personas.

## Current gate

- IS ranking: 2021-01-04 → 2022-12-31.
- Full Sample validation: 2021-01-04 → 2026-05-19.
- Promotion: validation Sharpe ≥ 1.5, Sortino ≥ 1.5, or total return ≥ 500%.
- Diversity: greedy return-path correlation gate, default `max_correlation=0.995`; if a candidate is too correlated with a previously selected higher-scoring rule, only the higher-scoring rule is kept.
- Stop condition: at least 10 stock-rule personas, all integrated into `/portfolio` with holdings/trades/equity/methodology routes.

## Useful result from this run

Price-only MA crossover and price momentum families dominated the full-sample gate. Report-upside families still run, but did not dominate the final 10 under the current score/correlation ordering.

This is a product-facing strategy discovery mode, not a claim of OOS robustness. Future sessions should either:

1. add more universal rule families (RSI variants, Supertrend, ATR breakout, volatility targeting), or
2. tune the diversity gate to cluster by both return path and holdings overlap if the selected MA variants feel too similar.

## Artifact contract

- `data/sim/stock-rule-personas.json`: promoted personas consumed by simulation.
- `data/sim/stock-admission.json`: audit trail; `window.validation_mode` is `full_sample`.
- `data/web/portfolio/*`: portfolio-native UI artifacts.
- `/strategies/` remains removed; strategy discovery is surfaced through `/portfolio`.
