# CLAUDE.md

This repo uses the same operating contract as `AGENTS.md`.

For frontend work, read these first:

- `docs/frontend/design-system.md`
- `docs/frontend/ui-rubric.md`
- `docs/frontend/page-patterns.md`
- `docs/frontend/chart-rules.md`
- `docs/frontend/table-rules.md`
- `docs/frontend/prompt-recipes.md`

Default frontend posture:

- Next.js App Router, TypeScript, Tailwind CSS, local shadcn-style components, Radix primitives, lucide-react.
- Server Components by default; Client Components only for charts, local state, browser APIs, event handlers, drag interactions, or interactive tables/forms.
- Calm, dense, data-first fintech UI. Prefer subtle borders, compact metric cards, tabular numbers, and restrained color.
- Do not use public copy that leads with internal jargon such as "PIT"; explain the value in normal language.
- Reuse existing components and data contracts before creating new ones.
- After coding, run focused checks and review screenshots against the rubric.
