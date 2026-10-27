# 008: Incremental task proposals

- **Status**: In progress
- **Owner**: @mrtrukiny
- **Created**: 2026-10-27

## Goal

When the owner adds a room or an item and asks for proposals again, only the new things should get proposals. Today the whole inventory goes back to the AI and pending proposals of that scope are replaced, so a request after a small change can reshuffle work the owner already reviewed. With this spec, proposing again leaves accepted tasks and pending proposals exactly as they are and asks the AI only about rooms and items that have neither. Amends AC6 of [spec 003](003-ai-task-proposals.md); see "AI task proposals" in [`PRODUCT.md`](../PRODUCT.md#mvp-phase-1).

## User stories

- As the owner, I want to add a room or an item and get proposals only for it, so that what I already reviewed stays the same.
- As the owner, I want to know when there's nothing new to propose for, so that I don't wait for an AI request that can't help.
- As the owner, I want to get fresh proposals for something by discarding its pending ones, so that I can redo a single item without touching the rest.

## Acceptance criteria

Each criterion is testable and maps to at least one test.

- [ ] AC1: Given some rooms and items already have tasks or pending proposals, when I propose for the whole home, then proposals appear only for rooms and items that have neither. Accepted tasks are unchanged, and every pending proposal from before is still there, unchanged.
- [ ] AC2: Given I added an item to a room that already has room tasks (its quick and deep passes), when I propose, then I get proposals for the new item and none for the room itself. Given I added a new room with items, then I get room tasks for it and tasks for each of its items.
- [ ] AC3: Given the whole home already has home-wide routines (tasks or pending proposals targeting "Whole home"), when I propose for the whole home, then no new home-wide routines are proposed.
- [ ] AC4: Given I propose for a single room, then the same rule applies within that room: only its items, or the room itself, that have no tasks and no pending proposals get proposals.
- [ ] AC5: Given every room and item already has tasks or pending proposals, when I open the proposals page, then "Propose tasks" explains "Everything already has tasks. Add a room or an item, or discard proposals to get new ones." and no AI request is made.
- [ ] AC6: Given I discard all pending proposals of an item (or delete all its tasks), when I propose again, then that item gets new proposals, and nothing else changes.
- [ ] AC7: Given the AI request fails, then I see "Try again", and the pending proposals from before are untouched. The busy, empty, and offline states, and keyboard and screen reader access, stay as in spec 003, at 360px and on desktop.

## UX notes

- The proposals page says what will be covered before the request: "Proposes tasks for 2 new items and 1 new room." when there is something new, or the AC5 message when there isn't.
- New proposals join the list alongside the pending ones, in the same room groups.

## Out of scope

- Detecting edits to an existing item (a renamed item or a changed count or note) and re-proposing for it. Discarding its proposals or deleting its tasks, as in AC6, covers that.
- Suggesting missing tasks for rooms and items that already have some.
- Proposing automatically when the inventory changes.

## Open questions

- None. Decided with the owner: only rooms and items with no tasks and no pending proposals go to the AI.

---

## Technical plan

### Approach

Builds on spec 003 (proposal flow, fake AI) and ADR 0006 (task scopes). No new dependencies, tables, or migrations, so no ADR.

- **Coverage** (`src/lib/tasks/coverage.ts`, pure and unit-tested). `findUncovered({ rooms, existing, scopeRoomId })` takes rooms with their item ids and the targets of every task and pending proposal (`roomId`, `itemId`). It returns what has nothing yet, within the scope:
  - An item is covered when any task or proposal has its `itemId`.
  - A room is covered when any task or proposal has its `roomId` and no `itemId` (its quick and deep passes, or a room routine).
  - The home is covered when any task or proposal has neither. Home-wide routines only count for the whole-home scope; a single room never proposes them (AC3, AC4).
  - `describeUncovered()` turns the counts into the page copy: "Proposes tasks for 2 new items and 1 new room.", adding "home-wide routines" as a last part when the home is uncovered. `NOTHING_NEW` holds the AC5 message.
  - `ProposalInput` already matches the input shape, so the action, the prompt, the fake AI, and the page share one rule.
- **Prompt** (`src/lib/ai/task-proposals.ts`). `buildProposalRequest` keeps positional references over every room and item in scope (`r2.i3` means the same thing with or without coverage), but:
  - Lists only uncovered items. A covered room appears only as the heading of its new items and is marked "room tasks already planned"; a covered room with no new items is left out.
  - Puts only uncovered targets into `refs`, so `toProposals` drops anything aimed at a covered room, item, or `home` as an unknown target. This enforces AC1 to AC4 in code, whatever the model returns.
  - States in the scope line whether home-wide routines are needed. `INSTRUCTIONS` change from "every item gets a task, every room gets passes, always take out the trash" to: propose item tasks for every listed item, room passes only for rooms not marked as planned, and home routines only when the scope says they're needed.
  - "Already planned (don't repeat)" lists the tasks and proposals of the rooms in scope and of the whole home by name (`Kitchen / Fridge: "Clean the fridge"`, `Whole home: "Take out the trash"`), so a new bed doesn't get "Make the bed" when the home already has it.
- **Fake AI** (`src/lib/ai/fake-proposals.ts`) calls `findUncovered` and skips covered targets with the same references, so the e2e flows exercise AC1 to AC6.
- **Reads** (`src/lib/tasks/queries.ts`):
  - `readProposalInput` reads every pending proposal, of any scope, as `existing`. Nothing gets replaced anymore, so the scope filter goes away.
  - A new `getProposalTargets()` getter (`"use cache"`, keyed by user, tagged `tasks` and `inventory`) returns rooms with their item ids and all task and proposal targets for the page.
- **Mutation** (`generateProposals` in `src/app/(app)/tasks/actions.ts`):
  - After reading the input, it runs `findUncovered`. When nothing is uncovered, it returns `{ status: "success", count: 0 }` without calling the AI or writing anything. This is a defensive check for a stale page (AC5).
  - Otherwise it inserts the new proposals, with `scopeRoomId` still recording the scope they were generated for, and deletes nothing (AC1, AC6). A failed request writes nothing (AC7).
- **Page** (`src/app/(app)/tasks/review/page.tsx`, Server Component). `ReviewSection` also awaits `getProposalTargets()` and computes coverage for the selected scope:
  - When something is uncovered, it renders the summary line above "Propose tasks".
  - Otherwise it passes the AC5 message as `GenerateButton`'s existing `unavailableReason`, which disables the button and links the reason with `aria-describedby`. No client changes.
  - After a successful run, `updateTag` refreshes the summary. The status line keeps announcing "N tasks proposed".
- **Offline:** unchanged. The summary is part of the cached RSC payload, and `useEditsDisabled()` still disables the button offline (AC7).

### Tasks

- [x] T1: Coverage module: `findUncovered` for the whole home and for one room, `describeUncovered` with singular and plural parts, and the `NOTHING_NEW` copy. Files: `src/lib/tasks/coverage.ts`, `src/lib/tasks/coverage.test.ts`. Covers: AC1, AC2, AC3, AC4, AC5, AC6.
- [x] T2: Incremental prompt: list only uncovered targets with stable positional references, mark covered rooms, keep only uncovered targets in `refs`, state whether home routines are needed, list already-planned work by name, and adjust `INSTRUCTIONS`. Files: `src/lib/ai/task-proposals.ts`, `src/lib/ai/task-proposals.test.ts`. Covers: AC1, AC2, AC3, AC4.
- [x] T3: Fake AI follows coverage: skip covered items and rooms, and propose home routines only when the home is uncovered. Files: `src/lib/ai/fake-proposals.ts`, `src/lib/ai/task-proposals.test.ts` ("fake proposals" block). Covers: AC1, AC2, AC3, AC4, AC6.
- [x] T4: Reads and action: `readProposalInput` counts every pending proposal as existing; `generateProposals` short-circuits when nothing is uncovered, inserts without deleting, and drops the transaction; update its doc comment. Files: `src/lib/tasks/queries.ts`, `src/app/(app)/tasks/actions.ts`. Covers: AC1, AC5, AC6, AC7.
- [x] T5: Review page summary: add the cached `getProposalTargets()` getter; render the summary line, or pass the AC5 message to `GenerateButton` as `unavailableReason`. Check it at 360px and on desktop, in light and dark mode. Files: `src/lib/tasks/queries.ts`, `src/app/(app)/tasks/review/page.tsx`. Covers: AC5, AC7.
- [ ] T6: E2E with the fake AI:
  - A new spec for AC1 to AC7.
  - In `e2e/tasks.spec.ts`, the spec 003 flow now expects the AC5 message after "Accept all" instead of "2 tasks proposed".
  - In `e2e/tasks-offline.spec.ts`, add a second room before going offline so "Propose tasks" is enabled again once back online.

  Files: `e2e/tasks-incremental.spec.ts`, `e2e/tasks.spec.ts`, `e2e/tasks-offline.spec.ts`, `e2e/support/tasks.ts` (a `discardProposal` helper if needed). Covers: AC1, AC2, AC3, AC4, AC5, AC6, AC7.
- [ ] T7: Docs: mark AC6 and the "Generating again for a scope replaces…" note in spec 003 as amended by spec 008, and update the proposal flow and the "Writes" row in `ARCHITECTURE.md`. Files: `docs/specs/003-ai-task-proposals.md`, `docs/ARCHITECTURE.md`. Covers: documentation for AC1.

### Test plan

- Unit (Vitest):
  - `coverage.test.ts`:
    - A covered item and room are skipped. A new item in a covered room is uncovered while the room isn't (AC1, AC2).
    - A new room with items is uncovered along with its items (AC2).
    - A home task or proposal covers home routines, and room scope never reports home routines (AC3, AC4).
    - Room scope ignores other rooms (AC4).
    - Everything covered gives an empty result (AC5).
    - Removing an item's last task or proposal uncovers it (AC6).
    - `describeUncovered` returns "Proposes tasks for 2 new items and 1 new room." and the singular forms.
  - `task-proposals.test.ts`:
    - The prompt omits covered items, marks covered rooms, and omits `home` when the home is covered (AC1 to AC4).
    - `refs` holds only uncovered targets, and `toProposals` drops output aimed at covered targets (AC1 to AC3).
    - Already-planned work is listed by name (AC1).
    - Room scope says no home routines (AC4).
    - The fake proposes only for uncovered targets (AC1 to AC4, AC6).
  - The existing `GenerateButton` tests still cover the unavailable reason and the "Try again" path (AC5, AC7).
- E2E (Playwright, desktop and mobile, `AI_FAKE=1`), in `e2e/tasks-incremental.spec.ts`:
  - AC1, AC2, AC3:
    - Propose for a Kitchen with a Floor, accept "Clean Floor", and rename a pending proposal.
    - Add a Window to the Kitchen and a Bathroom with a Mirror. The page says "Proposes tasks for 2 new items and 1 new room."
    - Proposing adds exactly Clean Window, Clean Mirror, and the two Bathroom passes. The renamed proposal, the Kitchen passes, the single "Take out the trash", and the accepted task are unchanged.
  - AC4: in an Office with a Desk, proposals for the Office, then add a Shelf and propose for the Office. Only the new item gets a proposal, an uncovered second room gets none, and no home routine appears.
  - AC5: with everything covered, the AC5 message shows and "Propose tasks" is disabled. A `[fail]` home note ensures no hidden AI call surfaces an error.
  - AC6: discard every proposal of one item. The page says "Proposes tasks for 1 new item.", and proposing adds only that item's task.
  - AC7: with pending proposals and a `[fail]` note, add an item and propose. "Try again" shows and the "Accept all (N)" count is unchanged. Offline and keyboard coverage stays in `tasks-offline.spec.ts` and the spec 003 AC9 test.
