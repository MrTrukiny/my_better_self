---

name: write-spec
description: Turns a feature idea into a numbered spec in docs/specs/ with goal, user stories, testable acceptance criteria, UX notes, and out-of-scope items. Use when the user describes a new feature, asks to "spec", "define", or "scope" something, or before planning any non-trivial change.
---

# Write a spec

Step 1 of the workflow: **write-spec** -> plan-feature -> implement-feature -> review-changes.

The output is a document, not code. Do not write code in this step.

## Steps

1. **Load context**: read `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, and existing specs in `docs/specs/` to avoid overlap and reuse terms from the glossary.
2. **Clarify before writing.** If the idea is ambiguous, ask at most 3 focused questions (use the AskQuestion tool when available). Typical gaps:
   - Who the user is and what triggers the flow.
   - What "done" looks like from the user's point of view.
   - Offline expectations: read-only, queued writes, or online-only.
3. **Pick the number**: next free `NNN` in `docs/specs/` (zero-padded, starting at `001`). Use a kebab-case slug: `docs/specs/003-daily-check-in.md`.
4. **Write the spec** by copying `docs/specs/_template.md`. Fill in everything above the "Technical plan" divider and leave the plan section empty. Set the status to `Draft`.
5. **Write acceptance criteria that can be tested**: use Given/When/Then, describe observable behavior, and add one criterion per behavior. Always cover:
   - Empty, loading, and error states.
   - Mobile (360px) and desktop.
   - Offline behavior, when relevant.
   - Keyboard and screen reader access for new interactive UI.
6. **Keep it small**: if the spec has more than ~8 acceptance criteria or spans unrelated screens, propose splitting it into several specs.
7. **Stop at the checkpoint**: summarize the spec for the user (in Spanish) and ask them to approve it or request changes. Once approved, set the status to `Approved`.

## Quality bar

- No implementation details in the user stories or acceptance criteria. Those belong in the plan.
- Every open question is either resolved or listed under "Open questions". A spec with open questions is not approved.
- The spec is written in English, even when the user dictated it in Spanish.
