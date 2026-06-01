<!-- AUTONOMY DIRECTIVE - DO NOT REMOVE -->
YOU ARE AN AUTONOMOUS CODING AGENT. EXECUTE CLEAR, LOCAL, REVERSIBLE TASKS TO COMPLETION WITHOUT ASKING FOR PERMISSION.
DO NOT STOP TO ASK "SHOULD I PROCEED?" ON OBVIOUS NEXT STEPS.
IF BLOCKED, TRY A SMALLER OR MORE DIRECT APPROACH FIRST. ASK ONLY WHEN THE NEXT STEP IS DESTRUCTIVE, CREDENTIAL-GATED, EXTERNAL-PRODUCTION, OR MATERIALLY AMBIGUOUS.
<!-- END AUTONOMY DIRECTIVE -->

# AGENTS.md

This repository defaults to a fast local engineering loop. Prefer direct reading, editing, and targeted verification over heavyweight orchestration.

## Default Mode

- Work directly in this repo unless the user explicitly invokes a workflow such as `$ralph`, `$ralplan`, `$team`, or `$ultragoal`.
- Do not create `.omx` plans, audits, session state, or continuation artifacts during ordinary coding tasks.
- Do not spawn subagents for routine cleanup, small refactors, formatting, documentation edits, or targeted fixes.
- The user has explicitly requested a standing release finish policy for this repo: after completing work, use the project-local `release-finish` skill to update docs/README and CHANGELOG or release notes, commit, tag, and push.
- Do not watch GitHub Actions, create GitHub Release objects, or delete branches unless the user explicitly asks for those external actions.
- Favor local evidence: file inspection, focused lint, focused tests, typecheck, and build smoke checks.

## Fast Local Verification

Use the smallest check that proves the change.

- For Python-only edits, prefer targeted `uv run ruff check ...` and the smallest relevant `uv run pytest ...` selection.
- For formatting-only Python edits, `uv run ruff format ...` is enough unless behavior changed.
- For web-only edits, prefer `pnpm --dir apps/web check` or `pnpm --dir apps/web typecheck`; run a full build only when routing, generated pages, artifacts, or rendering behavior changed.
- For static-export route smoke, do not start a web server. After `pnpm --dir apps/web build`, use `pnpm --dir apps/web smoke:static` to check expected exported routes.
- Treat full `uv run pytest -q`, `uv run pre-commit run --all-files`, `uv run pytest tests/test_web_artifacts.py -q -x`, `uv run python -m snusmic_pipeline export-web --check`, release builds, and CI watching as release-gate checks, not the default inner loop.
- If a check takes too long for the scope, stop using it as a default and replace it with a narrower smoke check.

## Test Policy

Tests should support human review, not replace judgment.

- Keep tests that protect money-facing calculations, PIT data integrity, artifact contracts, CLI behavior, and web artifact validity.
- Prefer a small positive smoke test over many brittle absence checks.
- Delete or avoid tests that only assert discarded names, old implementation details, duplicated contracts, or historical AI-generated scaffolding.
- Before keeping broad tests, classify them mentally as `product-critical`, `useful-smoke`, `duplicate`, or `AI-slop`; only the first two deserve to stay by default.
- Do not add broad regression suites just to lock in cleanup work unless the behavior is truly product-critical.

## Cleanup Policy

- Active docs describe only current surfaces and contracts. Do not keep historical name inventories or "do not bring this back" sections in active docs.
- Prefer deletion over wrappers, alternate execution paths, aliases, and "just in case" branches.
- Do not preserve unused code as archived variants under new names.
- Remove scripts, docs, tests, and code paths that no current workflow uses.
- Keep boundaries simple: PIT data generation and reporting are current product concerns; strategy search/backtest exploration is not a default concern unless the user asks for it.
- Rename misleading concepts when they distort the model. In particular, avoid treating account/report variants as investor "personas" unless the domain really requires that abstraction.

## Engineering Style

- Use existing repo patterns before adding new abstractions.
- Avoid new dependencies unless explicitly requested.
- Keep diffs small, but do not keep bad structure alive just to minimize line count.
- Use structured Python models such as Pydantic where they clarify IO/config/contracts.
- Use NumPy/vectorized operations for calculation-heavy paths when it reduces loops and pandas overhead.
- Avoid Python `for` loops in hot calculation paths when vectorization or dynamic programming gives a clearer and faster implementation.

## Frontend Design Operating System

- Before substantial frontend edits, read `docs/frontend/design-system.md`, `docs/frontend/ui-rubric.md`, and `docs/frontend/page-patterns.md`.
- Use the repo's Next.js App Router, TypeScript, Tailwind CSS, local shadcn-style components, Radix primitives, lucide-react, TanStack Table, and lightweight-charts patterns.
- Reuse existing UI components before creating one-off JSX. Do not invent fake business logic to make a screen look better.
- Design for a dense, calm fintech research workspace: fast scanning, subtle borders, tabular numbers, restrained color, desktop-first density with responsive mobile behavior.
- Avoid random gradients, decorative blobs, glassmorphism, heavy shadows, arbitrary hex colors in components, and generic SaaS landing-page filler.
- Default to Server Components. Use Client Components only for charts, state, browser APIs, event handlers, drag interactions, and interactive tables/forms.
- For public-facing UI copy, explain the value in ordinary language. Do not lead with internal jargon such as "PIT".
- Frontend work is not complete until typecheck/lint pass and a screenshot or equivalent visual inspection has been reviewed against `docs/frontend/ui-rubric.md`.

## Git And Release

- Use `.codex/skills/release-finish/SKILL.md` before every final completion report.
- Commit, create an annotated tag, and push the branch plus tag after each completed task in this repository.
- Keep README and active docs Korean-first by default, with English content included for user-facing docs.
- Update `CHANGELOG.md` or equivalent release notes for every release-finish commit.
- When committing, use the repository's lore-style commit message: intent first, then useful trailers such as `Tested:`, `Not-tested:`, `Rejected:`, `Confidence:`, and `Scope-risk:`.
- Version bumps and tags are covered by the standing release-finish instruction. GitHub Release objects, branch deletion, and CI monitoring still require explicit user instruction.

## Completion Report

Final reports should be short and evidence-based:

- What changed.
- What was deleted or simplified.
- What verification ran.
- Any known gap, only if real.
