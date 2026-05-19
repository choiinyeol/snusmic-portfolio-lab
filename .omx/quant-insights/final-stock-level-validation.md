# Task 6 — Final stock-level persona validation

## Verdict

**PASS after task7 materialization fix.** The earlier probe correctly found 0 `stock_rule_*` personas; the leader fix now materializes the OOS-admitted stock-rule personas into the existing portfolio artifact surface.

## Required checks

| Requirement | Evidence | Result |
| --- | ---: | --- |
| 10+ `stock_rule_*` personas in `data/web/portfolio/personas.json` | `10` | PASS |
| 10+ `stock_rule_*` rows in `data/web/strategies/catalog.json` | `10` | PASS |
| 10+ `stock_rule_*` personas with trades in `data/web/portfolio/trades.json` | `10` | PASS |
| 10+ `stock_rule_*` personas with holdings in `data/web/portfolio/holdings.json` | `10` | PASS |
| 10+ `stock_rule_*` personas with equity series in `data/web/portfolio/equity-daily.json` | `10` | PASS |
| Stock OOS admission object embedded in `data/web/strategies/admission.json` | present | PASS |
| Stock accepted count in admission artifact | `stock_accepted_count: 10` | PASS |
| Retired `/portfolio/quant` source route removed | route file missing | PASS |
| Retired quant-search product refs removed | no source refs | PASS |

## OOS gate used

- IS search window: `2021-01-04` through `2022-12-31`.
- OOS admission window: `2023-01-02` through latest warehouse price date (`2026-05-19` in this run).
- Admission to portfolio requires OOS Sharpe `>= 1.5` **or** OOS Sortino `>= 1.5` **or** OOS total return `>= 500%`.
- Search/rank occurs on IS finalists first; portfolio materialization only consumes frozen OOS-admitted rows.

## Product proof

The accepted stock-rule personas are now normal portfolio personas, so `/portfolio/[persona]` can show:

- stock-level trades (`data/web/portfolio/trades.json`),
- current holdings (`data/web/portfolio/holdings.json`),
- equity curves (`data/web/portfolio/equity-daily.json`),
- methodology/buy/sell/risk fields (`data/web/portfolio/personas.json` and `data/web/strategies/catalog.json`),
- OOS admission rationale (`data/web/strategies/admission.json`).

## Important correction

The old meta-quant `accepted_count` and `goal_hit_count` are not completion evidence. Completion evidence is only the `stock_rule_*` portfolio/admission artifacts listed above.
