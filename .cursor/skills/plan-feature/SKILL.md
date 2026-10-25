---

name: plan-feature
description: Turns an approved spec in docs/specs/ into a technical plan with an approach, ordered tasks mapped to acceptance criteria and files, and a test plan. Use after a spec is approved, or when the user asks to plan, break down, or estimate a feature.
---

# Plan a feature

Step 2 of the workflow: write-spec -> **plan-feature** -> implement-feature -> review-changes.

The output is the "Technical plan" section of the spec. Do not write code in this step.

## Steps

1. **Read the spec** and confirm its status is `Approved`. If it isn't, stop and run `write-spec` or ask the user.
2. **Research the codebase** before designing:
   - Find existing components, utilities, and patterns to reuse (`src/components/`, `src/lib/`, `src/components/ui/`).
   - Read the relevant Next.js guide in `node_modules/next/dist/docs/` for any Next API you will use.
   - Check the scoped rules in `.cursor/rules/` that apply to the files you will touch.
   - For third-party libraries, get current docs (Context7 MCP) instead of relying on memory.
3. **Write the approach**: a few sentences on the design, including:
   - Server vs client component split.
   - Where data comes from and how it is cached (`"use cache"`, Suspense boundaries).
   - Mutations (Server Actions).
   - Offline behavior.

   If you make a significant or hard-to-reverse decision (new dependency, data model, auth, storage), write an ADR in `docs/decisions/` using the template and link it.
4. **Break it into tasks**, each of which:
   - Is completable and verifiable on its own (ideally under ~200 changed lines).
   - Lists the files it creates or modifies.
   - States which acceptance criteria it covers.
   - Is ordered so the app builds and tests pass after every task. Put foundations first: types, data, then UI.
5. **Write the test plan**: which acceptance criteria get unit tests and which get e2e tests. Every acceptance criterion must appear at least once.
6. **Check the plan**: every acceptance criterion is covered by a task and a test, and no task does work outside the spec.
7. **Stop at the checkpoint**: summarize the plan for the user (in Spanish) and ask for approval before implementing. Then set the spec status to `In progress`.

## Task format

```markdown
- [ ] T1: Add `Habit` type and in-memory repository. Files: `src/lib/habits/types.ts`, `src/lib/habits/repository.ts`, `src/lib/habits/repository.test.ts`. Covers: AC1, AC2.
```
