# RALPLAN Planner Artifact - SNUSMIC Action Queue Workstation

## Summary
Plan for pending approval release that turns the current verification first web app into an Action Queue centered workstation. Inspected evidence: .gjc/specs/deep-interview-snusmic-action-queue-workstation.md requires real first release queue generation from trades plus holdings plus reports and prices only as validation. apps/web/app/(app)/layout.tsx currently wraps all app routes in AppShell and builds command targets from APP_NAV. apps/web/components/ui/app-shell-nav.ts currently defines Verification, Alpha, Portfolio Proof, Calendar, Statistics. apps/web/components/ui/AppShell.tsx owns the collapsible sidebar, status rail, mobile drawer, and CommandPalette. apps/web/package.json has Next 16, React 19, Tailwind 4, lightweight-charts, lucide, radix, d3, zod, and no gsap, motion/react, three, or ogl. apps/web/components/ui/AGENTS.md requires reuse of local primitives and forbids one-off hero/stat/custom CSS patterns.

## In scope
- Minimal Action Queue model and generation from existing trades, holdings, and reports.
- Price series as auxiliary validation only: current price, target gap, entry or exit zone, confidence adjustment.
- Default app surface and IA replacement around Action Queue, Strategy, Portfolio, Report Pool.
- Dense calm fintech UI, Korean plain language, desktop first responsive behavior.
- React Bits inspired internal primitives limited to low dependency glow, counters, and micro motion.

## Out of scope
- Broker integration, order submission, or real position mutation.
- Static showcase without real queue rows.
- Data heavy regeneration unless an approved switch to exported action queue data is chosen.
- New heavy animation or WebGL dependencies.

## RALPLAN-DR

### Principles
1. Action Queue is the center of the product and home screen.
2. Real minimum beats fake polish: release 1 computes rows from current artifacts.
3. Prices validate and annotate; they never create candidate symbols.
4. Dense and calm: high information density with readable Korean operator language.
5. Effects are internal primitives, not package or page specific experiments.

### Top decision drivers
1. Spec compliance: AppShell and APP_NAV cannot remain the first screen structural basis.
2. Artifact boundary: current web app is a static artifact reader, so first release must not hide missing data or mutate artifacts casually.
3. Maintainability: local shared primitives and typed view models are safer than one-off CSS and ad hoc visual code.

### Options

#### Option A - TypeScript view model over existing artifacts, recommended
- Shape: add an action queue model or view model in apps/web/lib, using getTrades, getCurrentHoldings, getReportRows, hasPriceArtifact, and getPriceSeries. Render with new workstation components.
- Pros: fastest compliant release, no data regeneration, minimal surface, fits existing view-model pattern.
- Cons: puts minimal product heuristic in TypeScript, which slightly stretches the old DESIGN.md boundary.
- Bound: acceptable only while heuristic is deterministic, simple, visible, and not treated as canonical backtest logic.

#### Option B - Python exporter emits data/web/action-queue.json
- Shape: implement queue generation in Python export, add zod schema and TS reader, then display validated rows.
- Pros: strongest long term data boundary, reproducible snapshots, easier Python regression coverage.
- Cons: larger release, requires generated artifact work, slows IA and design iteration.
- Bound: prefer when queue becomes canonical product truth or needs historical snapshot testing.

#### Option C - Static workstation mock first, rejected
- Pros: fastest visual exploration.
- Cons: violates the resolved deep-interview requirement that release 1 includes real minimal queue generation.
- Invalidation rationale: Round 14 and acceptance criteria require fully real minimum queue data, so this option is invalid unless the spec changes.

#### Option D - Keep AppShell and only rename nav, rejected
- Pros: smallest code delta.
- Cons: fails the explicit instruction to replace AppShell and NAV as the app spine, and preserves the old Verification to Alpha to Portfolio Proof mental model.
- Invalidation rationale: the spec says the current spine is disposal target, not a styling base.

## Implementation plan

### 1. Define Action Queue row contract
Create a typed row model with the mandatory display fields: ticker, action Buy/Sell/Watch, planned price, current price, strategy reason, report evidence, portfolio impact, confidence. Add supporting fields for company, symbol, report href, portfolio account, native and KRW prices, latest price date, validation tags, confidence reasons, and sort key. Keep labels Korean and plain.

### 2. Generate the minimal queue from real artifacts
Candidate universe must be built before any price lookup:
- Holdings from the primary or default portfolio account.
- Recent trades for that account, preserving side, reason, reason_detail, date, fill price, and linked report id.
- Latest usable reports by symbol from getReportRows, including target, upside, current return, caveats, and report href.
Then enrich only those candidates with price helpers. hasPriceArtifact and getPriceSeries should fill current price, latest price date, target gap, entry or exit zone, and confidence delta. A symbol with only price data must not appear.

Minimal action heuristic:
- Buy when report evidence has positive upside or remaining target gap and the primary portfolio has no or low exposure.
- Sell when holding exists and target progress, current return, recent sell or trim reason, or stretched target gap indicates exit or trim attention.
- Watch when holding, trade, or report evidence exists but buy and sell thresholds are not met.
Confidence starts neutral, adds for report freshness, linked trade reason, holding evidence, usable price validation, and coherent target gap, subtracts for missing or stale price, caveats, expired or no target reports, and conflicting evidence. Clamp to 0-100 and display reason tags so confidence is not mistaken for calibrated probability.

### 3. Replace default IA and shell
- apps/web/app/(app)/layout.tsx: remove AppShell and APP_NAV as the default wrapper and command spine. Introduce a workstation shell or layout that exposes Action Queue, Strategy, Portfolio, Report Pool.
- apps/web/components/ui/app-shell-nav.ts: retire old Verification, Alpha, Portfolio Proof, Calendar, Statistics spine or replace with a workstation concept map if a nav config remains useful.
- apps/web/components/ui/AppShell.tsx: stop using it as the default app surface. Remove when unused, or fence as legacy only if any drilldown still needs it temporarily.
- apps/web/app/(app)/page.tsx: replace the verification board home with Action Queue workstation home.
Existing report and portfolio pages may remain as drilldowns, but not as the first screen organizing spine.

### 4. Build dense workstation UI
Likely new components under apps/web/components/workstation:
- WorkstationShell
- ActionQueueWorkstation
- ActionQueueTable
- QueueEvidencePanel
- QueueStatusStrip
- PortfolioImpactCell
Use local ui primitives where they fit: PageHero, Section, KpiTile, Money, Badge, Button, table helpers, numCellClass, signedTextClass. Add internal primitives only if repeated: GlowPanel, CountUpNumber, ConfidenceBar, TickerPulse. Implement with React, Tailwind, CSS transitions, and prefers-reduced-motion. Do not add package dependencies.

### 5. Keep data regeneration separate
Default path is Option A and should not touch data/web. If execution discovers queue generation must be an artifact for static export or release governance, split that into an explicit Option B data task with schemas, Python tests, and regeneration. Do not mix generated/data-heavy artifact churn with the UI shell change unless required.

### 6. Documentation cleanup after implementation approval
Update DESIGN.md and docs/product-spec.md because they currently describe a verification first Portfolio Lab, which conflicts with the new Action Queue workstation. Update only after code behavior exists so docs describe reality.

## File-level likely touchpoints
- apps/web/app/(app)/layout.tsx: replace AppShell wrapper and APP_NAV command target source.
- apps/web/app/(app)/page.tsx: new Action Queue home.
- apps/web/components/ui/app-shell-nav.ts: retire or replace old spine.
- apps/web/components/ui/AppShell.tsx: remove default role or fence as legacy only.
- apps/web/lib/view-models/action-queue.ts or apps/web/lib/action-queue.ts: new model and heuristic generation.
- apps/web/lib/artifacts.ts: likely reuse existing readers; add small exported helpers only if existing helpers are insufficient.
- apps/web/lib/schemas.ts: no change for Option A; add schema only if Option B is chosen later.
- apps/web/components/workstation/*: new workstation UI components.
- apps/web/components/ui/*: optional low dependency primitives following AGENTS.md.
- DESIGN.md and docs/product-spec.md: post-implementation product contract update.

## Sequencing and dependencies
1. Implement and review ActionQueueRow generation first; this de-risks data requirements before UI polish.
2. Add workstation shell and concept IA; remove APP_NAV from default layout command targets.
3. Replace home route with Action Queue table plus Strategy, Portfolio, and Report Pool evidence panels.
4. Add shared primitives for glow, counters, and confidence only when repeated.
5. Clean up or fence legacy AppShell and nav after imports are known.
6. Update docs and run focused verification after approval.

## Acceptance criteria
- Home screen centers Action Queue without navigating.
- Each rendered row has Ticker, Action Buy/Sell/Watch, Planned Price, Current Price, Strategy Reason, Report Evidence, Portfolio Impact, Confidence.
- Candidate symbols originate from trades, holdings, or reports, never from prices alone.
- Prices appear only as current price, target gap, entry or exit zone, and confidence validation.
- Top level nouns visible in UI are Strategy, Portfolio, Report Pool, Action Queue.
- AppShell and APP_NAV are not the default first screen spine.
- Visual language is dense, calm, Korean/plain, data first, desktop first, and responsive through overflow or stacking.
- React Bits inspired behavior is internal and low dependency; no new gsap, motion, three, ogl, or cursor/WebGL sprawl.
- data/web remains untouched unless the approved plan explicitly switches to exported queue artifacts.

## Verification for approved execution
Do not run these during planning. Run after code changes only:
- pnpm --dir apps/web typecheck
- pnpm --dir apps/web lint
- pnpm --dir apps/web artifact:check
- pnpm --dir apps/web smoke:static
Focused QA:
- Open / and confirm mandatory columns are visible immediately.
- Confirm command palette or shell exposes Action Queue, Strategy, Portfolio, Report Pool rather than the old Verification spine.
- Inspect one Buy, one Sell, and one Watch row for report evidence and portfolio impact links.
- Review missing price behavior: row may remain only if generated from trades, holdings, or reports, and confidence flags must show missing price validation.

## Risks and mitigations
- Boundary drift into trading strategy: keep TS heuristic minimal and documented; move to Python artifact if it becomes canonical.
- Conflicting docs: update DESIGN.md and docs/product-spec.md in the approved implementation.
- Shell replacement may lose accessibility behavior: preserve command palette, keyboard focus, and mobile drawer lessons from AppShell where still needed.
- Animation can harm density: default to static readable tables, subtle CSS only, respect prefers-reduced-motion.
- Confidence overclaim: display confidence as heuristic with reason tags, not probability.
- Generated JSON review noise: avoid data/web changes for Option A.

## ADR draft

### Decision
Implement the first release as an Action Queue centered workstation. Use a TypeScript first-release view model to derive a minimal queue from existing trades, holdings, and reports. Use prices only for validation and annotation. Replace AppShell and APP_NAV as the default app spine with an IA around Action Queue, Strategy, Portfolio, and Report Pool. Internalize only low dependency React Bits inspired primitives.

### Drivers
- Deep-interview spec explicitly rejects the old AppShell/NAV/verification-first spine.
- Release 1 requires real minimal queue generation.
- Existing dependencies support the needed UI without new heavy animation or WebGL packages.
- Data artifact regeneration should remain separate unless queue data becomes canonical.

### Alternatives
- TypeScript view model now: chosen for speed, small surface, and direct use of existing validated readers.
- Python action-queue.json artifact: viable later for canonical snapshot data and stronger tests.
- Static UI first: rejected because it violates release 1 data acceptance.
- Keep AppShell and rename nav: rejected because it preserves the invalid old spine.

### Why chosen
Option A satisfies the spec with the smallest safe change. It makes Action Queue real, avoids generated artifact churn, lets the IA change immediately, and keeps the heuristic bounded enough for first release planning.

### Consequences
- Home route and app shell intentionally break from the current verification-first contract.
- Some minimal queue logic temporarily lives in TypeScript and must remain transparent.
- Existing report and portfolio routes can remain as drilldowns, but no longer define the product spine.
- Docs and UI rules need updating after implementation to prevent regression to old terminology.

### Follow-ups
- Promote queue generation to Python export when it needs historical reproducibility or richer regression tests.
- Add fixture coverage for Buy, Sell, Watch, missing price, stale report, and conflicting trade/report evidence.
- Remove dead AppShell or APP_NAV code after the workstation shell is fully adopted.
