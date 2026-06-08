# Product Spec

SNUSMIC Portfolio Lab is being reset as a **verification-first PIT research product**. Instead of treating generated accounts or ledgers as product truth, the product should accumulate evidence in the order: report claim validation -> repeated-rule promotion -> portfolio proof.

### Current Product Objective

- Ingest SMIC report metadata, PDFs, markdown, and structured extraction results.
- Build `VerificationCase` objects with publication date, price path, target/thesis evidence, drawdown, and failure-tail quality.
- Promote repeated evidence-backed rules into `AlphaHypothesis` candidates.
- Connect those candidates to one or more `PortfolioStrategy` proofs against all-weather or index benchmarks.
- Keep the first product surface focused on verification cases, then alpha, then portfolio proof.
- Expose historical daily buy/sell trace visibility (reason, quantity, price, PnL) as proof, not as broker execution scope.

### Non Goals

- No live broker integration or order entry.
- No future-looking signals in PIT rules.
- No automatic admission of every generated research account.
- No treating account ledgers or fills as the core product object.

### Objective

The product objective has two layers:
1. **Verification-engine success**: `VerificationCase` objects are scored with downside-aware quality, including drawdown and failure-tail hard veto.
2. **Product completion**: at least one explicit strategy family proves benchmark outperformance versus all-weather or an index.

Alpha is not a single report pick. It is a repeated rule that survives minimum support, quality-distribution stability, and regime/time spread requirements.

### Product Surfaces

- `/` — VerificationCase board
- `/reports` and `/reports/[symbol]/[reportId]` — source/evidence drilldown
- `/calendar` — PIT observation-date diagnostics
- `/statistics` — validation-case distribution diagnostics
- `/portfolio` — portfolio proof catalogue
- `/portfolio/[account]` — selected strategy proof
- `/portfolio/[account]/holdings` — proof holdings view
- `/portfolio/[account]/trades` — historical execution trace
