# Entry Timing Audit: `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5`

## Scope

Candidate account: `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5`

Baseline account: `pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5`

This report starts from generated trade ledgers, finds symbols whose first buy date differs, then reconstructs the point-in-time rank board on each account's first-buy date. Rank fields use only data available on that date. Forward returns are ex-post review evidence only.

## Summary

- Rebalance cadence: `quarterly`
- Top-N: `5`
- Symbols with different first-buy timing: 5
- Candidate entered earlier: 1
- Candidate entered later: 1
- Candidate-only traded symbols: 2
- Baseline-only traded symbols: 1
- Mean candidate minus baseline days: 0
- Candidate first-buy date also board-score Top5: 3

## Timing Rows

| symbol | company | candidate first buy | baseline first buy | candidate minus baseline | candidate-date candidate rank | candidate-date board rank | baseline-date candidate rank | baseline-date board rank | audited entry next return | audited target upside | audited current return | audited target gap | age | 52w gap | MA stack |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `PLTR` | Palantir Technologies Inc. | 2024-07-01 | 2024-10-01 | -92 | 4 | 5 | 2 | 3 | 34.25% | 94.62% | 24.32% | -36.12% | 38 | 0.00% | Y |
| `196170.KQ` | 알테오젠 | 2024-10-01 | 2024-07-01 | 92 | 5 | 2 | 7 | 3 | -8.26% | 42.55% | 92.47% | 35.01% | 145 | -9.92% | Y |
| `018290.KS` | 브이티 | 2025-01-02 | - | - | 5 | 7 | - | - | -17.57% | 68.79% | 23.33% | -26.93% | 56 | -6.00% | Y |
| `472850.KQ` | 폰드그룹 | 2025-07-01 | - | - | 1 | 1 | - | - | -21.91% | 249.01% | 48.23% | -57.53% | 21 | 0.00% | Y |
| `GRND` | Grindr Inc. | - | 2025-01-02 | - | - | - | 7 | 4 | 2.95% | 63.03% | 26.76% | -22.25% | 42 | -1.49% | Y |
