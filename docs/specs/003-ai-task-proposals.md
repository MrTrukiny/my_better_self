# 003: AI task proposals

- **Status**: Approved
- **Owner**: @mrtrukiny
- **Created**: 2026-10-25

## Goal

Turn the home inventory (spec 002) into a reviewed list of cleaning tasks without the owner having to work out what to clean, how long it takes, or how often. Gemini proposes tasks at three levels:

- **Item tasks**: "Clean the kitchen windows".
- **Room tasks**: a quick "Bathroom surface clean" and a less frequent "Bathroom deep clean".
- **Home-wide routines**: "Make the bed", "Wash the dishes", "Do the laundry".

The proposals take the home's helpers into account. With a robot vacuum, for example, floor tasks cover only the corners and edges it can't reach. The owner reviews every proposal; nothing becomes a task without approval. See "AI task proposals" in [`PRODUCT.md`](../PRODUCT.md#mvp-phase-1) and the principle "AI proposes, the user decides, code schedules".

## User stories

- As the owner, I want to tell the app which cleaning helpers I have (robot vacuum, dishwasher...) and anything else about my home, so that proposals fit how I actually clean.
- As the owner, I want the AI to propose tasks for my items, my rooms, and my home as a whole, with minutes and a frequency, so that I don't have to plan them myself.
- As the owner, I want a mix of small, specific tasks and broader ones (surface clean vs deep clean), so that work fits into short daily sessions.
- As the owner, I want to accept, edit, or discard each proposal, so that I stay in control of what ends up in my routine.
- As the owner, I want daily chores like making the bed kept as routines, separate from the 30-minute cleaning budget, so that they don't crowd out actual cleaning.
- As the owner, I want to propose again after changing my inventory without getting duplicates of tasks I already have.

## Acceptance criteria

Each criterion is testable and maps to at least one test.

- [ ] AC1: Given I open the home profile, when I mark helpers from a fixed list (robot vacuum, dishwasher, washing machine, dryer, other) and write an optional note of up to 500 characters, then they are saved and shown the next time I open it; a longer note shows a field message and is not saved.
- [ ] AC2: Given I have at least one room with items, when I choose "Propose tasks", then I see a busy state that can't be triggered twice, followed by a proposal list grouped by room, with a "Whole home" group. Each proposal shows a name, what it belongs to (an item, a room, or the whole home), estimated minutes, a frequency, and whether it is a cleaning task or a routine. Given I have no rooms, the action is unavailable and explains that the inventory comes first.
- [ ] AC3: Given the proposals are shown, then:
  - Every cleaning task takes 1 to 30 minutes, so it fits in one daily session. Bigger jobs come as several smaller tasks.
  - Every frequency is a whole number of days from 1 to 365.
  - Proposals that the response doesn't link to one of my rooms or items are not shown.
- [ ] AC4: Given I marked helpers or wrote a note, when proposals are generated, then they reflect it. For example, with a robot vacuum marked, floor tasks cover only the spots it can't reach instead of full vacuuming. With a dishwasher, dish tasks are about loading and unloading it.
- [ ] AC5: Given a proposal list, when I accept, edit (name, minutes, frequency, cleaning task or routine), or discard each proposal, or choose "Accept all", then accepted proposals become tasks and discarded ones disappear. Nothing is accepted by default, and leaving the page keeps the pending proposals for later.
- [ ] AC6: Given I already have tasks, when I propose again, for the whole home or for a single room, then the new proposals don't repeat existing tasks, and the existing tasks are unchanged.
- [ ] AC7: Given I have tasks, when I open the task list, then I see the cleaning tasks grouped by room and "Whole home", and the routines in their own section, each with minutes and frequency. I can edit or delete each task, and deleting asks for confirmation.
- [ ] AC8: Given the AI request fails, times out, or returns something invalid, then I see a message with "Try again" and nothing is saved. Given I am offline, "Propose tasks" and all edits are disabled with a visible reason, and the task list and pending proposals stay readable.
- [ ] AC9: The home profile, the proposal review, and the task list work at 360px wide and on desktop, in light and dark mode, and with the keyboard only. Every control and list has an accessible name, and completion of a generation is announced to screen readers.

## UX notes

- **Entry points:** the room list and each room page offer "Propose tasks", for the whole home or for that room. A "Tasks" link in the header opens the task list. The home profile is reachable from the task list and from the proposal screen ("Tell us about your home").
- **Review screen:** proposals are grouped like the task list. Each one is a compact card with accept and discard buttons, plus an edit action that opens the same sheet or dialog pattern as the inventory forms. A sticky "Accept all" bar sits at the bottom on mobile.
- **Granularity:** the prompt asks for a mix of tasks:
  - Small, specific item tasks ("Wipe the bathroom mirror", 3 min, every 7 days).
  - Room-level passes at two depths ("Bathroom surface clean", 10 min, every 3 days; "Bathroom deep clean", 30 min, every 30 days).
  - Home-wide routines.
- **Routines** are chores with their own frequency, from daily ("Make the bed") to every few days ("Do the laundry"). They are tracked outside the daily cleaning budget. This spec only proposes and stores them; showing and checking them off daily belongs to the Today view (spec 006).
- **Loading:** generating can take several seconds. Show progress text ("Reading your inventory...", then "Proposing tasks...") rather than a bare spinner.
- **Errors:** keep the user's context (selected scope, profile) and offer "Try again".
- **Offline:** online-only for generating and editing, read-only otherwise, consistent with spec 002.

## Out of scope

- Scheduling tasks into daily sessions (spec 004) or the calendar (spec 005).
- Showing or checking off routines and tasks day to day (spec 006).
- Calibrating minutes from actual completion times, and natural-language adjustments (later phases).
- Re-proposing or changing tasks automatically when the inventory changes; proposing again is always the owner's action.
- Size, material, or dirtiness attributes of items (phase 2), and photos or video (phase 3).
- Choosing the AI model or provider from the UI (ADR 0003 sets it by configuration).
- A deterministic task catalog (rules per item type, room type, and helper) that could replace most AI calls. It will be revisited once real proposals show which patterns are stable.

## Open questions

- None.

---

## Technical plan

### Approach

Builds on specs 001 and 002 and on ADR 0003 (Gemini through the AI SDK).

- **Dependencies:** `ai` (v7) and `@ai-sdk/google`, as decided in ADR 0003. No other new packages.
- **Data model** (`src/db/schema/tasks.ts`). An ADR records the task scope and routine decision:
  - `home_profile`: one row per user, with `helpers` (a text array validated against a fixed list in code) and `note`.
  - `task`: `userId`, optional `roomId`, optional `itemId`, `kind` (`cleaning` or `routine`), `name`, `minutes`, `frequencyDays`, and timestamps.
    - The scope is derived from the links: an item task has an `itemId`, a room task only a `roomId`, and a home task neither.
    - Deleting a room or an item cascades to its tasks.
    - Scheduling fields such as `lastDoneAt` arrive with specs 004 and 006.
  - `task_proposal`: pending proposals, with the same shape as `task` plus the scope it was generated for.
    - Accepting one inserts a `task` and deletes the proposal; discarding deletes it.
    - Generating again for a scope replaces the pending proposals of that scope.
- **AI module** (`src/lib/ai/`):
  - `model.ts` picks the model from `AI_MODEL`, with a Flash-tier default confirmed against the live model list during T4.
  - `task-proposals.ts`:
    - Builds the input: rooms and items under short references such as `r1` and `r1.i2`, plus the helpers, the note, and the existing tasks.
    - Calls `generateText` with `Output.object()`, a 45-second timeout, and one retry.
    - Post-validates in code. It drops unknown references and out-of-range minutes or frequencies (cleaning tasks 1 to 30 minutes, frequencies 1 to 365 days). It also drops duplicates of existing tasks or other proposals, by normalized name and target.
  - The prompt asks for small, specific item tasks, room passes at two depths, and home-wide routines, and explains how each helper changes the work (AC4).
  - When `AI_FAKE=1` (only in e2e and CI), a deterministic fake builds proposals from the same input, so no live calls happen in tests. A note containing `[fail]` makes the fake fail, to test AC8.
  - `pnpm ai:try` runs the live prompt against a sample home and prints the proposals, for tuning.
- **Mutations** (`src/app/(app)/tasks/actions.ts`): `saveHomeProfile`, `generateProposals(scope)`, `updateProposal`, `acceptProposal`, `acceptAllProposals`, `discardProposal`, `updateTask`, and `deleteTask`. Each resolves the user, validates with Zod, scopes queries by `userId`, and updates the `tasks:<userId>` tag.
- **Reads** (`src/lib/tasks/queries.ts`): `"use cache"` functions keyed and tagged by user, the same pattern as the inventory.
- **Routes:**
  - `/tasks` is the task list, with a banner when proposals are pending.
  - `/tasks/review` shows the scope picker ("Whole home" or a room), "Propose tasks", and the pending proposals.
  - `/home-profile` is the helpers and note form.
  - The room list and room pages link to `/tasks/review?room=<id>`, and the header gets a "Tasks" link.
  - Pages are Server Components with Suspense around per-user data. The proposal cards, the edit forms, the generate button, and the "Accept all" bar are client leaves.
- **Generation UX:** the generate button runs the Server Action in a transition. While it runs, the button shows timed progress text. When it finishes, a polite live region announces "N tasks proposed" or the error with "Try again".
- **Offline (AC8):** the ADR 0005 pattern is generalized. `InventoryLink` becomes `OfflineAwareLink`. The service worker's `NetworkOnly` RSC rule and the document warmer cover `/tasks`, `/tasks/review`, and `/home-profile`. `useEditsDisabled()` guards generation and every edit.

### Tasks

- [ ] T1: Foundations: add the AI dependencies, make `GOOGLE_GENERATIVE_AI_API_KEY`, `AI_MODEL`, and `AI_FAKE` optional in env validation, write an ADR for task scopes and routines, and update the glossary (Task scope, Routine, Helper, Home profile, Proposal). Files: `package.json`, `pnpm-lock.yaml`, `src/lib/env.ts`, `src/lib/env.test.ts`, `.env.example`, `docs/decisions/0006-task-scopes-and-routines.md`, `docs/PRODUCT.md`. Covers: groundwork for AC2 and AC3.
- [ ] T2: Schema and migration for `home_profile`, `task`, and `task_proposal`, plus the helper list. Files: `src/db/schema/tasks.ts`, `src/db/schema/index.ts`, `drizzle/0002_tasks.sql`, `src/lib/tasks/helpers.ts`, `src/lib/tasks/helpers.test.ts`. Covers: AC1, AC5, AC7.
- [ ] T3: Home profile: Zod schema, query, the `saveHomeProfile` action, and the `/home-profile` page and form. Files: `src/lib/tasks/schemas.ts`, `src/lib/tasks/schemas.test.ts`, `src/lib/tasks/queries.ts`, `src/app/(app)/tasks/actions.ts`, `src/app/(app)/home-profile/page.tsx`, `src/components/tasks/home-profile-form.tsx`, `src/components/tasks/home-profile-form.test.tsx`. Covers: AC1, AC9.
- [ ] T4: AI proposal module: input with references, prompt, output schema, post-validation and deduplication, model selection, the fake provider, and `pnpm ai:try`. Files: `src/lib/ai/model.ts`, `src/lib/ai/task-proposals.ts`, `src/lib/ai/task-proposals.test.ts`, `src/lib/ai/fake-proposals.ts`, `scripts/ai-try.ts`, `package.json`. Covers: AC2, AC3, AC4, AC6, AC8.
- [ ] T5: Proposal and task actions and queries: generate per scope (replacing pending proposals of that scope), update, accept, accept all, and discard proposals; update and delete tasks. Files: `src/app/(app)/tasks/actions.ts`, `src/lib/tasks/queries.ts`, `src/lib/tasks/schemas.ts`, `src/lib/tasks/schemas.test.ts`. Covers: AC2, AC5, AC6, AC7, AC8.
- [ ] T6: Review screen: `/tasks/review` with the scope picker, the generate button with progress and live announcements, grouped proposal cards, the edit sheet, and the "Accept all" bar. Also the entry points from the room list and room pages. Files: `src/app/(app)/tasks/review/page.tsx`, `src/components/tasks/generate-button.tsx`, `src/components/tasks/generate-button.test.tsx`, `src/components/tasks/proposal-list.tsx`, `src/components/tasks/proposal-card.tsx`, `src/components/tasks/task-form.tsx`, `src/components/tasks/task-form.test.tsx`, `src/components/inventory/room-list.tsx`, `src/app/(app)/rooms/[roomId]/page.tsx`. Covers: AC2, AC5, AC8, AC9.
- [ ] T7: Task list: `/tasks` grouped by room and "Whole home", a routines section, edit and delete with confirmation, the pending-proposals banner, and the header "Tasks" link. Files: `src/app/(app)/tasks/page.tsx`, `src/components/tasks/task-list.tsx`, `src/components/app-shell.tsx`. Covers: AC7, AC9.
- [ ] T8: Offline: generalize `InventoryLink` into `OfflineAwareLink`, extend the service worker rule and the document warmer to the task routes, and amend ADR 0005. Files: `src/components/offline-aware-link.tsx` (moved from `src/components/inventory/inventory-link.tsx`), `src/app/sw.ts`, `src/components/inventory/offline-cache-warmer.tsx` (moved to `src/components/offline-cache-warmer.tsx`), the pages above, `docs/decisions/0005-offline-inventory-reading.md`. Covers: AC8.
- [ ] T9: E2E flows with the fake AI, and docs (domain model and AI flow in `ARCHITECTURE.md`, AI variables in the README). Files: `e2e/tasks.spec.ts`, `e2e/tasks-offline.spec.ts`, `playwright.config.ts` (`AI_FAKE=1`), `.github/workflows/ci.yml`, `docs/ARCHITECTURE.md`, `README.md`. Covers: AC1 to AC9.

### Test plan

- Unit (Vitest):
  - Helper list and home profile schema: known helpers only, note of 500 characters accepted and 501 rejected (AC1).
  - AI module with `MockLanguageModelV4` and recorded fixtures:
    - The input maps rooms and items to references and back (AC2).
    - Proposals with unknown references, minutes outside 1 to 30 for cleaning tasks, or frequencies outside 1 to 365 are dropped (AC3).
    - Duplicates of existing tasks are dropped (AC6).
    - Invalid output and timeouts become a typed failure (AC8).
    - The prompt includes the helper guidance and the note (AC4).
  - Task and proposal edit schemas, at the boundaries (AC5, AC7).
- Component (Testing Library):
  - Home profile form (AC1).
  - Generate button: busy state, no double submit, progress text, live announcement, and error with "Try again" (AC2, AC8).
  - Task form: field messages linked to their inputs (AC5, AC9).
- E2E (Playwright, desktop and mobile, `AI_FAKE=1`):
  - AC1: save helpers and a note, then reload to see them.
  - AC2 and AC3: the empty inventory blocks generation; with rooms, proposals appear grouped with every field.
  - AC4: with a robot vacuum marked, the fake proposes the "corners and edges" floor task. This checks that the profile reaches the generator. Prompt quality itself is checked with `pnpm ai:try`.
  - AC5: accept, edit, discard, and "Accept all"; pending proposals survive a reload.
  - AC6: proposing again for a room doesn't duplicate accepted tasks.
  - AC7: the task list groups and routines; edit and delete with confirmation.
  - AC8: the `[fail]` note shows the error with "Try again" and saves nothing. Offline, generation and edits are disabled and the lists stay readable.
  - AC9: the review flow with the keyboard only, in dark mode.
