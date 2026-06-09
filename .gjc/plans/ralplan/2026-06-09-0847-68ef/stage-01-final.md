# Pending Approval Plan: SNUSMIC Action Queue Workstation

## Status
- Status: pending approval
- Source spec: `.gjc/specs/deep-interview-snusmic-action-queue-workstation.md`
- Ralplan run: `2026-06-09-0847-68ef`
- Planner: `.gjc/plans/ralplan/2026-06-09-0847-68ef/stage-01-planner.md`
- Architect: `.gjc/plans/ralplan/2026-06-09-0847-68ef/stage-01-architect.md` (`WATCH` / `COMMENT`; architect subagent failed twice, review was persisted through the sanctioned ralplan CLI by the main planning agent)
- Critic: `.gjc/plans/ralplan/2026-06-09-0847-68ef/stage-01-critic.md` (`OKAY` / `PASS`)
- Execution: not approved; no source changes may be made from this plan until separate explicit execution approval.

## RALPLAN-DR Summary

### Principles
1. Action Queue is the center of the product and home screen.
2. Real minimum beats fake polish: release 1 computes rows from current artifacts.
3. Prices validate and annotate; they never create candidate symbols.
4. Dense and calm: high information density with readable Korean operator language.
5. Effects are internal primitives, not package/page-specific experiments.

### Decision Drivers
1. Spec compliance: AppShell and APP_NAV cannot remain the first-screen structural basis.
2. Artifact boundary: the web app reads static artifacts, so Action Queue generation must be deterministic and transparent.
3. Maintainability: typed view models and local primitives are safer than ad hoc visual code or heavy animation dependencies.

### Options Considered
| Option | Decision | Pros | Cons / Invalidation |
|--------|----------|------|---------------------|
| A. TypeScript view model over existing artifacts | Chosen for first release | Fastest compliant release, no generated artifact churn, small reversible surface | Must remain transparent heuristic, not canonical strategy/backtest truth |
| B. Python exporter emits `data/web/action-queue.json` | Follow-up when queue becomes canonical | Stronger reproducibility and tests | Larger release, generated artifact churn, slower IA/design iteration |
| C. Static workstation mock | Rejected | Fast visual spike | Violates Round 14: first release must include minimal real queue generation |
| D. Keep AppShell and rename nav | Rejected | Smallest code delta | Violates explicit full replacement of AppShell/NAV spine |

## ADR

### Decision
Implement the first release as an Action Queue-centered workstation using a TypeScript first-release view model that derives a minimal real queue from existing `trades`, `holdings`, and `reports`. Use `prices` only for validation and annotation. Replace `AppShell`/`APP_NAV` as the default app spine with an IA around `Action Queue`, `Strategy`, `Portfolio`, and `Report Pool`. Internalize only low-dependency React Bits-inspired primitives.

### Drivers
- Deep-interview spec explicitly rejects the old AppShell/NAV/verification-first spine.
- Release 1 requires real minimal queue generation, not a static showcase.
- Existing dependencies support dense financial UI without adding `gsap`, `motion/react`, `three`, or `ogl`.
- Generated/data-heavy artifact churn should remain separate until queue data becomes canonical.

### Alternatives
- **TypeScript view model now:** chosen for speed, small surface, and direct use of existing web readers.
- **Python `action-queue.json` artifact later:** viable when queue outputs need historical reproducibility and broader regression tests.
- **Static UI first:** rejected by the spec.
- **Keep AppShell/rename nav:** rejected because it preserves the invalid old spine.

### Why Chosen
Option A satisfies the spec with the smallest safe change: Action Queue becomes real, IA can change immediately, and implementation avoids generated artifact conflicts while keeping the heuristic bounded and inspectable.

### Consequences
- Some minimal queue logic temporarily lives in TypeScript and must remain transparent.
- Existing report/portfolio routes may remain as drilldowns, but they no longer define the product spine.
- The current docs and UI guidance will need updates after behavior exists.
- If Action Queue becomes product truth, queue generation should move into the Python/export layer.

### Follow-ups
- Promote queue generation to Python export when it needs snapshot reproducibility.
- Add fixture coverage for Buy/Sell/Watch, missing price, stale report, and conflicting trade/report evidence.
- Remove dead AppShell/APP_NAV code after workstation shell adoption is complete.

## Implementation Plan

### 1. Define the Action Queue row contract
Create a typed row model, preferably in `apps/web/lib/view-models/action-queue.ts` or `apps/web/lib/action-queue.ts`.

Mandatory display fields:
- `ticker`
- `action`: `Buy | Sell | Watch`
- `plannedPrice`
- `currentPrice`
- `strategyReason`
- `reportEvidence`
- `portfolioImpact`
- `confidence`

Supporting fields should include company/name, report href/id, portfolio account context, native/KRW price metadata where available, latest price date, validation tags, confidence reason tags, caveats, and sort key.

### 2. Generate minimal real queue rows from existing artifacts
Candidate universe must be built before any price lookup:
- holdings from the default/primary portfolio account;
- recent trades preserving side, date, fill price, reason/reason detail, and linked report id when available;
- latest usable report rows by symbol.

Then enrich only those candidates with prices:
- current price;
- latest price date;
- target/current gap;
- entry/exit zone annotation;
- confidence adjustment.

A symbol with only price data must not appear.

Minimal heuristic:
- **Buy** when report evidence indicates positive upside/target gap and the primary portfolio has no/low exposure.
- **Sell** when holding exists and target progress, current return, recent sell/trim evidence, or stretched target gap indicates exit/trim attention.
- **Watch** when evidence exists but Buy/Sell thresholds are not met.

Confidence is a heuristic score, not a probability. It must expose reason tags and caveats.

### 3. Replace default IA and shell
Likely touchpoints:
- `apps/web/app/(app)/layout.tsx`: stop using `AppShell`/`APP_NAV` as the default wrapper and command spine; introduce workstation shell/navigation.
- `apps/web/components/ui/app-shell-nav.ts`: retire or replace old Verification/Alpha/Portfolio Proof/Calendar/Statistics spine.
- `apps/web/components/ui/AppShell.tsx`: stop using it as the default app surface; remove when unused or fence as legacy only if a drilldown still needs it temporarily.
- `apps/web/app/(app)/page.tsx`: replace the verification-board home with Action Queue workstation home.

The new shell must still preserve or intentionally replace command/keyboard/mobile access and status metadata lessons from `AppShell`.

### 4. Build the dense workstation UI
Likely new components under `apps/web/components/workstation/`:
- `WorkstationShell`
- `ActionQueueWorkstation`
- `ActionQueueTable`
- `QueueEvidencePanel`
- `QueueStatusStrip`
- `PortfolioImpactCell`

Reuse local primitives where they fit: `PageHero`, `Section`, `KpiTile`, `Money`, badges/buttons, table helpers, `numCellClass`, and `signedTextClass`.

Optional internal primitives only when repeated:
- `GlowPanel`
- `CountUpNumber`
- `ConfidenceBar`
- `TickerPulse`

Use CSS/Tailwind transitions and `prefers-reduced-motion`; do not add `gsap`, `motion/react`, `three`, or `ogl` in this release.

### 5. Keep generated/data-heavy work separate
Default approved path should not touch `data/web`. If implementation discovers queue generation must be exported as an artifact for static/export governance, split that into a separate data slice with Python exporter, schemas, tests, and regeneration.

### 6. Documentation cleanup after behavior exists
After implementation, update `DESIGN.md`, `docs/product-spec.md`, and release notes so docs describe the Action Queue workstation rather than a verification-first Portfolio Lab.

## Acceptance Criteria
- [ ] Home screen centers Action Queue immediately.
- [ ] Every Action Queue row displays `Ticker`, `Action(Buy/Sell/Watch)`, `Planned Price`, `Current Price`, `Strategy Reason`, `Report Evidence`, `Portfolio Impact`, and `Confidence`.
- [ ] Candidate symbols originate from trades, holdings, or reports, never prices alone.
- [ ] Prices only enrich/validate rows with current price, target gap, entry/exit zone, and confidence adjustment.
- [ ] UI top-level concepts are `Action Queue`, `Strategy`, `Portfolio`, and `Report Pool`.
- [ ] `AppShell`/`APP_NAV` are not the default first-screen organizing model.
- [ ] Visual language is dense, calm, Korean/plain, data-first, desktop-first, and responsive.
- [ ] React Bits-inspired behavior is internal and low-dependency; no new heavy animation/WebGL packages in this release.
- [ ] `data/web` remains untouched unless a separate approved artifact-generation slice is chosen.

## Verification Plan
Run only after approved implementation changes:
- `pnpm --dir apps/web typecheck`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web artifact:check`
- `pnpm --dir apps/web smoke:static`

Focused QA after build/smoke:
- Open `/` and confirm mandatory Action Queue columns are immediately visible.
- Confirm shell/navigation exposes Action Queue, Strategy, Portfolio, Report Pool rather than the old Verification spine.
- Inspect at least one Buy, one Sell, and one Watch row for report evidence and portfolio impact links.
- Confirm missing price behavior: rows can remain only if generated from trades/holdings/reports; confidence tags must show missing price validation.
- Review against `docs/frontend/ui-rubric.md`; any category below 4 should be patched or explicitly accepted.

## Risks and Mitigations
- **Frontend heuristic becomes domain truth:** keep it deterministic, bounded, and tagged; move to Python artifact when canonical.
- **Shell replacement loses accessibility:** preserve command access, focus behavior, and mobile navigation affordances.
- **Animation harms density/performance:** prefer subtle CSS transitions, respect reduced motion, avoid heavy deps.
- **Confidence overclaims precision:** display confidence as heuristic with reasons, not probability.
- **Generated JSON conflicts:** avoid generated data changes for Option A.

## Pending Approval Boundary
This plan is ready for execution review, but execution is not approved. The recommended execution path after explicit approval is `/skill:ultragoal` unless the user specifically needs tmux-backed team parallelization.
