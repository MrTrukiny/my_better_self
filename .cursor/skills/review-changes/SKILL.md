---

name: review-changes
description: Reviews the current branch against its spec, code conventions, accessibility, responsive layout, and PWA behavior, fixes what it finds, then opens a pull request. Use after implementing a feature, or when the user asks to review changes, self-review, or open a PR.
---

# Review changes and open the PR

Step 4 of the workflow: write-spec -> plan-feature -> implement-feature -> **review-changes**.

## Steps

1. **Collect the diff**: `git diff main...HEAD` and `git log main..HEAD --oneline`. Identify the spec from the branch name or the commits.
2. **Review against the checklist below.** Fix issues directly when they are clear. List anything that needs a decision for the user.
3. **Run the gate**: `pnpm check`. It must pass.
4. **Check in a browser** (Playwright MCP against `pnpm build && pnpm start`) for UI changes: 360px and desktop, light and dark, keyboard-only navigation, no console errors.
5. **Update docs**: mark the spec `Done` and tick its acceptance criteria. Update `docs/ARCHITECTURE.md` if the structure changed, and add an ADR if a decision was made during implementation.
6. **Open the PR** with `gh pr create`, titled with a Conventional Commit and using the body template below.
7. **Report to the user** in Spanish: the PR link, what was verified, and any open items.

## Checklist

**Spec**
- [ ] Every acceptance criterion is implemented and covered by a test.
- [ ] Nothing out of scope was added.

**Code**
- [ ] Server Components by default; `"use client"` only where needed.
- [ ] No route segment config (`dynamic`, `revalidate`); Suspense and `"use cache"` used correctly.
- [ ] Server Actions validate input. No secrets in client code.
- [ ] No dead code, leftover logs, or commented-out blocks.
- [ ] Names follow the glossary in `docs/PRODUCT.md`.

**UI and accessibility**
- [ ] Works at 360px and on desktop, in light and dark mode.
- [ ] Semantic HTML, accessible names, visible focus, contrast of at least 4.5:1.
- [ ] Empty, loading, error, and offline states exist.

**PWA**
- [ ] New pages behave sensibly offline (cached shell, fallback, or a clear message).
- [ ] The service worker and manifest still pass the e2e tests.

## PR body template

```markdown
## Summary

What changed and why, in 2-4 sentences. Spec: docs/specs/NNN-slug.md

## Acceptance criteria

- [x] AC1 ...

## Verification

- `pnpm check` passes
- Manually checked: 360px / desktop, light / dark, keyboard, offline

## Notes

New dependencies, ADRs, follow-ups.
```
