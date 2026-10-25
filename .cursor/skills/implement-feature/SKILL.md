---

name: implement-feature
description: Implements the tasks of a planned spec one at a time, test first, running pnpm check:fast after each task and committing in small Conventional Commits. Use when a spec has an approved technical plan and the user asks to implement, build, or start coding it.
---

# Implement a feature

Step 3 of the workflow: write-spec -> plan-feature -> **implement-feature** -> review-changes.

## Before starting

1. Read the spec, including its technical plan. If there is no approved plan, stop and run `plan-feature`.
2. Create the branch from an up-to-date `main`: `git checkout -b mrtrukiny/<spec-number>-<slug>` (for example `mrtrukiny/003-daily-check-in`).
3. Make sure the baseline is green: `pnpm check:fast`.

## Loop, once per task

1. **Test first**: write or extend the failing test for the acceptance criteria this task covers. Run it and confirm it fails for the right reason.
2. **Implement** the smallest change that makes the test pass. Follow `AGENTS.md` and the scoped rules. Reuse existing components and utilities.
3. **Verify**: `pnpm check:fast`. Fix every error; don't suppress lint rules or add `@ts-expect-error` without a written reason.
4. **For UI tasks**, check the result in a browser (Playwright MCP) at 360px wide and at desktop width, in light and dark mode.
5. **Tick the task** in the spec (`- [x] T1: ...`).
6. **Commit**: one Conventional Commit per task, for example `feat(habits): add habit repository`.

## Finishing

1. Run the full gate: `pnpm check` (includes e2e against a production build).
2. Hand off to `review-changes`.

## When things go wrong

- **The plan is wrong or incomplete**: stop, explain the gap to the user, and update the plan in the spec before continuing. Don't silently expand scope.
- **A test fails three times in a row** with different fixes: stop and summarize what you tried. Don't keep guessing.
- **You need a new dependency**: say why, prefer what is already installed, and note it for the PR description.
