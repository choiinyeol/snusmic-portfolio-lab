# Prompt Recipes

## Fintech Redesign

Use this prompt for substantial UI work:

```txt
Redesign this page as a dense but calm fintech research interface.

Constraints:
- Use existing local shadcn-style components first.
- No fake business logic.
- No arbitrary colors, random gradients, blobs, glassmorphism, or heavy shadows.
- Prefer subtle borders, compact sections, and tabular financial values.
- Primary user is a trader or researcher scanning data quickly.
- Server Components by default; Client Components only for charts and interactivity.
- After coding, run typecheck/lint and review desktop/mobile screenshots against docs/frontend/ui-rubric.md.
```

## Before Coding Checklist

1. Current page structure
2. Visual problems
3. Components to reuse
4. Primary information
5. Secondary information
6. Visually quiet information
7. Target layout grid
8. Responsive behavior
9. Empty/error states
10. Verification plan

## Screenshot Review Checklist

Review:

- Alignment
- Spacing
- Information hierarchy
- Visual noise
- Number formatting
- Responsive behavior
- Empty or partial data states
