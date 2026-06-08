# Verification-First SNUSMIC Reboot Plan

## RALPLAN-DR
### Principles
1. VerificationCase is the core product object.
2. PIT/no-lookahead guarantees are non-negotiable.
3. PDF extraction must preserve dual outputs: markdown evidence plus structured machine artifact.
4. Downside-aware quality with drawdown/failure-tail hard veto precedes alpha promotion.
5. Product flow is Verification board → Alpha board → Portfolio proof; execution trace is proof, not broker infrastructure.

### Decision Drivers
1. Correct the object model away from ledger/account framing.
2. Promote only evidence-backed alpha with downside quality, support, and stability.
3. Reuse the brownfield PIT/export pipeline instead of risking a greenfield rewrite.

### Options
- **Option A — Contract-first migration in the current pipeline (Chosen)**
  - Pros: lowest PIT regression risk; preserves existing extract/warehouse/sim/export machinery; allows rollback slice by slice.
  - Cons: temporary contract duplication during migration.
- **Option B — Parallel namespace transition**
  - Pros: safest UI cutover if migration proves noisy.
  - Cons: increases the chance of two competing product truths and should only be temporary.
- **Option C — Full greenfield rewrite**
  - Pros: clean names and surfaces from day one.
  - Cons: unacceptable risk to working PIT, symbol, benchmark, and static export machinery.

## ADR
- **Decision**: Reboot SNUSMIC with a contract-first brownfield migration centered on `ReportArtifact -> VerificationCase -> AlphaHypothesis -> PortfolioStrategy`, while demoting execution trace to a proof surface and removing ledger-first framing from the product.
- **Why chosen**: It captures the clarified product intent without discarding the deterministic PIT pipeline that already works.
- **Alternatives considered**: Temporary parallel namespaces are acceptable only as a migration tactic. A greenfield rewrite is rejected.
- **Consequences**: Contracts, artifacts, and UI copy will change materially; generated outputs must be migrated in lockstep; old report/ledger-first surfaces must be actively removed, not merely hidden.
- **Follow-ups**: Keep report-row compatibility transitional only; keep execution trace subordinate to portfolio proof; place diagnostics routes behind the main verification→alpha→proof spine.

## Scope
In scope:
- Rebuild the domain model around `VerificationCase`, `AlphaHypothesis`, and `PortfolioStrategy`
- Add explicit `ReportArtifact` and execution-trace proof contracts
- Migrate data/web artifacts and static UI to the verification→alpha→proof pipeline
- Preserve markdown + structured extraction dual artifacts
- Preserve downside-aware validation and support/stability-gated alpha promotion

Out of scope:
- Live broker execution APIs or order submission
- Realtime market dependencies
- Treating account/ledger views as the primary product again
- One-off single report recommendations masquerading as alpha

## Execution Slices
### Slice 1 — Vocabulary and documentation reset
- Update README, product spec, architecture docs, and active design notes.
- Replace ledger-first product vocabulary with verification→alpha→proof vocabulary.
- Acceptance: active docs no longer describe portfolio/account ledger as the product nucleus.

### Slice 2 — ReportArtifact contract
- Define explicit `ReportArtifact` contract with PDF/source metadata, markdown path, and structured extracted fields.
- Preserve markdown as audit evidence and structured fields as engine input.
- Acceptance: one PDF deterministically yields both artifacts.

### Slice 3 — VerificationCase builder and quality engine
- Create deterministic `VerificationCase` generation from structured artifacts + PIT price data.
- Add downside-aware quality, drawdown, failure-tail, and hard-veto rules.
- Target hit remains a submetric, not the sole quality gate.
- Acceptance: hard-veto cases cannot support alpha.

### Slice 4 — AlphaHypothesis promotion engine
- Represent alpha as repeated selection rules backed by many VerificationCases.
- Gate promotion on minimum support plus quality/regime stability.
- Support must include more than raw count: distinct symbols and time/regime spread.
- Acceptance: single-report or unstable rules are rejected with explicit rejection reasons.

### Slice 5 — PortfolioStrategy proof and execution trace
- Recast current product accounts as strategy proof outputs consuming `AlphaHypothesis` IDs.
- Keep benchmark comparisons (all-weather and index families).
- Build daily historical execution trace views from trades + decisions with when/why/what/how much/price/PnL.
- Acceptance: users can follow historical buy/sell logic without broker integration.

### Slice 6 — Web artifact and schema migration
- Add verification/alpha/proof web artifacts and page bundles.
- Add row counts, checksums, and cross-reference validation for report→case→alpha→strategy→trace.
- Acceptance: validators fail any broken chain.

### Slice 7 — ProductSurface migration
- Make `/` the verification board.
- Add alpha board and portfolio proof board.
- Demote diagnostics (`Reports/Sources`, `Calendar`, `Statistics`) behind the main pipeline.
- Acceptance: product IA clearly reads VerificationCase → Alpha → Portfolio proof.

### Slice 8 — Cleanup and legacy removal
- Remove old ledger-first copy, labels, compatibility surfaces, and stale tests once replacements are live.
- Keep only transitional compatibility required for safe migration.
- Acceptance: no first-class ledger framing remains in product navigation or primary contracts.

## Acceptance Criteria
- [ ] PDF extraction produces markdown evidence plus structured engine input.
- [ ] VerificationCase is the first-class downstream object, not raw report rows or account ledgers.
- [ ] Downside-aware validation computes drawdown/failure-tail quality and supports hard veto.
- [ ] Alpha promotion requires repeated rule support plus quality/regime stability.
- [ ] At least one strategy family can be tested against all-weather or index benchmarks.
- [ ] Product first screen is the VerificationCase board.
- [ ] Product surface exposes verification→alpha→portfolio proof in that order.
- [ ] Historical daily buy/sell trace explains why, what, how much, price, and PnL.
- [ ] Execution trace is present as proof but does not become the new core object.
- [ ] Legacy ledger-first framing is removed from primary contracts and UI.

## Verification Plan
Implementation slices should use focused checks first:
- Python/data slices: targeted `uv run --locked pytest ... -q`, `uv run --locked ruff check ...`
- Web slices: `pnpm --dir apps/web typecheck`, `pnpm --dir apps/web exec biome check .`

Release-grade gates for producer/data or routing changes:
- `uv run --locked python -m snusmic_pipeline export-web --check`
- `uv run --locked pytest tests/test_web_artifacts.py -q -x`
- `uv run --locked pytest -q -m "not slow" -x`
- `pnpm --dir apps/web artifact:check`
- `pnpm --dir apps/web build`
- `pnpm --dir apps/web smoke:static`

Manual proof checks:
- `/` starts at verification board
- alpha board rejects unsupported/unstable rules
- portfolio proof shows benchmark comparison plus historical execution trace
- no primary ledger framing remains

## Risks and Rollback
- **Temporary dual contracts**: allowed only during migration; old report-row truth must not persist as equal first-class product truth.
- **No-lookahead regressions**: enforce as-of tests before promoting cases or alpha.
- **Trace overreach**: execution trace must remain subordinate to PortfolioStrategy proof, not become OMS scope.
- **Generated artifact churn**: split contract/code commits from regeneration where practical; rollback generated outputs with their producer slice.

## Status
Pending approval.
