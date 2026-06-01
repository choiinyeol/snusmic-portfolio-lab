---
name: release-finish
description: End-of-task repository release workflow. Use when finishing work in this repository, especially when changes must be documented, README/docs cleaned up, CHANGELOG or release notes updated, committed with the lore protocol, tagged, and pushed.
---

# Release Finish

Use this skill as the final pass before reporting completion for repository work.

## Workflow

1. Inspect the worktree with `git status -sb` and targeted diffs. Keep unrelated local files out of the commit; for this repo, ignore scratch screenshots such as `.omx-home-check*.png` unless the user explicitly asks to publish them.
2. Make a documentation pass. Keep `README.md` and files under `docs/` Korean-first by default, with an English section or summary when content is user-facing. Update active docs only for current behavior.
3. Update `CHANGELOG.md` or an equivalent release note before every release-style commit. Prefer a concise top entry with the version/tag, what changed, and the verification that ran.
4. Choose a tag. Use the next semver patch tag for normal follow-up work unless the change clearly deserves a minor/major bump or the user provided a tag. Keep package versions synchronized with the tag when this repo has version files.
5. Verify with the smallest checks that prove the change. For docs-only or workflow-only changes, run at least `git diff --check`; run targeted lint/tests/build checks when code or generated artifacts changed.
6. Stage only intended files. Commit with the repository lore protocol and include the required `Co-authored-by: OmX <omx@oh-my-codex.dev>` trailer.
7. Create an annotated tag for the completed work. Do not force-update existing remote tags; choose a new tag unless correcting a same-turn local mistake.
8. Push the current branch and the new tag. Report the commit, tag, pushed branch, verification, and any real verification gaps.

## Commit Message

Use this shape:

```text
<why this change exists>

Constraint: <external constraint that shaped the work>
Rejected: <alternative> | <why>
Confidence: <low|medium|high>
Scope-risk: <narrow|moderate|broad>
Directive: <warning for future agents>
Tested: <fresh verification commands>
Not-tested: <known gaps, or "none">
Co-authored-by: OmX <omx@oh-my-codex.dev>
```

Keep the first line about intent rather than file mechanics.
