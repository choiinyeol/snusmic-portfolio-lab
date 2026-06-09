# RALPLAN Architect Review — Pass 1

## Verdict
- Architectural status: WATCH
- Recommendation: COMMENT

## Steelman antithesis
The planner's recommended TypeScript view-model option is the fastest path, but it risks making a visually ambitious home page depend on front-end-only heuristics that look like product truth without the reproducibility guarantees of the existing Python/export pipeline. Since the Action Queue is the new product center, putting even a minimal generator in `apps/web/lib` could blur the boundary between presentation and portfolio/research logic.

## Tradeoff tension
- Speed and low artifact churn favor a TypeScript view model over existing readers.
- Auditability and money-facing correctness favor a Python-generated `data/web/action-queue.json` with schema/tests.

The tension is acceptable only if release 1 clearly labels the queue confidence as heuristic, keeps the generation deterministic and simple, and avoids treating the TS output as a canonical backtest or trading signal.

## Synthesis
Keep Option A for the first approved implementation because it satisfies the deep-interview spec with the smallest reversible surface and avoids broad generated data conflicts. Constrain it as follows:

1. Put queue generation behind a typed view-model boundary such as `apps/web/lib/view-models/action-queue.ts`, not inside React components.
2. Candidate symbols must originate from `trades`, `holdings`, or `reports`; `prices` may only enrich/validate.
3. Confidence must display reason tags and caveats, not imply calibrated probability.
4. The workstation shell may replace `AppShell` as the default wrapper, but accessibility lessons from `AppShell` (keyboard command access, focusable mobile navigation, status metadata) should be preserved or intentionally redesigned.
5. React Bits-inspired effects must stay dependency-light. Do not add `gsap`, `motion/react`, `three`, or `ogl` in the first pass unless a later approval explicitly accepts that cost.

## Findings

### WATCH — Frontend heuristic can become hidden domain logic
The plan permits Action Queue generation in TypeScript. That is acceptable for release 1, but it must remain a transparent view model with documented inputs, deterministic ranking, and reason tags. Move to a Python artifact once the queue becomes canonical, historical, or regression-critical.

### WATCH — Shell replacement may regress navigation/accessibility
`apps/web/app/(app)/layout.tsx` currently uses `AppShell` for command targets and status metadata. Replacing it is correct, but the new shell must still expose core navigation (`Action Queue`, `Strategy`, `Portfolio`, `Report Pool`) and preserve keyboard/mobile access rather than removing navigation entirely.

### WATCH — Visual ambition can undermine financial density
The spec allows glow/counter/micro-motion and limited WebGL/cursor effects. The plan correctly rejects heavy dependencies, but implementation should prefer CSS/Tailwind transitions and `prefers-reduced-motion`, with financial numbers kept tabular and aligned.

## Architectural approval conditions
The plan can proceed to Critic if it preserves these constraints in the final plan:

- No broker/order execution scope.
- No generated `data/web` churn for Option A.
- Action Queue rows must be produced from real existing artifacts, not mock rows.
- Prices cannot create candidate symbols.
- The old AppShell/APP_NAV spine cannot remain the default first-screen organizing model.
- Verification includes typecheck, lint, artifact contract check, static smoke, and visual inspection of `/`.
