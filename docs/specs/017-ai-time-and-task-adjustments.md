# 017: AI time and task adjustments

- **Status**: In progress
- **Owner**: @mrtrukiny
- **Created**: 2026-10-28

## Goal

Spec 011 adjusts a task's minutes automatically from the median of its recorded times, but it can't tell why a time was off: a note like "full deep clean, took longer" (spec 016) means the task may need a separate deep variant, not more minutes every time. This spec lets the owner ask the AI to review tasks with recorded times and notes and suggest changes: new minutes, a new frequency, or an extra task (for example a monthly deep version). As with task proposals, the AI only suggests; the owner reviews, edits, and accepts each change, and nothing changes without approval. See "AI proposes, the user decides, code schedules" in [`PRODUCT.md`](../PRODUCT.md) and "Time calibration" in [`ROADMAP.md`](../ROADMAP.md#phase-2-smarter-routine).

## User stories

- As the owner, I want the AI to look at how long my tasks really took and what I noted, so that my tasks match how I actually clean.
- As the owner, I want each suggestion to say why, quoting my times and notes, so that I can judge it quickly.
- As the owner, I want to accept, edit, or discard each suggestion, so that I stay in control of my plan.

## Acceptance criteria

Each criterion is testable and maps to at least one test.

- [ ] AC1: Given at least one cleaning task has 3 or more recorded times, or at least one note, since its minutes were last set by hand, then the Tasks page offers "Suggest adjustments" with how many tasks it will review ("Reviews 4 tasks with recorded times or notes"). Given none qualifies, then it explains "Record times or add notes to get suggestions." and makes no AI request.
- [ ] AC2: When I ask for suggestions, then the AI receives each qualifying task with its estimate, frequency, place, its recorded times with dates, and its notes, and returns zero or more suggestions. Each suggestion is one of: change the minutes, change the frequency, or add a new task for the same place (with its name, minutes, and frequency). Suggestions that fail validation (minutes or frequency out of the usual limits, an unknown task) are dropped.
- [ ] AC3: Then each suggestion shows the task, the change ("10 → 15 min", "Every 7 → 14 days", or "New: Deep clean the oven, 30 min, every 30 days"), and a one or two sentence reason that refers to the times or notes it came from.
- [ ] AC4: Given a suggestion, when I accept it, then the change is applied: new minutes count as set by hand (spec 011 starts calibrating that task again from there), a new frequency applies from the next replan, and a new task joins the plan like an accepted proposal. I can edit the values before accepting, and discard a suggestion instead. Accepting or discarding one leaves the others.
- [ ] AC5: Given the AI finds nothing to change, then the page says "Your tasks match your times. Nothing to adjust." Given the request fails, then I see "Try again", and nothing changes.
- [ ] AC6: Given there are pending suggestions, when I ask again, then they are replaced by the new ones; accepted changes stay. Pending suggestions survive reloads until I accept or discard them.
- [ ] AC7: The review works at 360px and on desktop, in light and dark mode, and with the keyboard only; the busy state is announced, each action button names its task, and asking for suggestions is disabled offline.

## UX notes

- Lives next to "Propose tasks": the Tasks page header gets "Suggest adjustments", which opens its own page "Adjustments" (`/tasks/adjustments`), grouped by room like proposals. The Tasks page links to pending adjustments the way it links to pending proposals.
- The reason is shown in full under the change; times and notes it cites appear in muted text ("Last 5: 14, 16, 15, 22, 15 min · Note on Oct 20: full deep clean").
- Editing reuses the task form fields of spec 003.

## Out of scope

- Running suggestions automatically or on a schedule.
- Suggestions that delete, merge, or move tasks between places.
- Changing how automatic calibration (spec 011) works.
- Suggestions for routines.

## Open questions

- None. Decided with the owner: the AI suggests and the owner approves each change; automatic calibration stays as it is.

---

## Technical plan

### Approach

- **Page:** `/tasks/adjustments` mirrors `/tasks/review`. A Server Component reads the qualifying tasks and the pending suggestions; client leaves hold the button and the cards. The qualifying count depends on check-offs, so it is read uncached after `io()`; pending suggestions are cached under the tasks tag, like proposals. The Tasks page header gets a "Suggest adjustments" link next to "Propose tasks", and a "N adjustments waiting for review" link when there are any.
- **Qualifying tasks (AC1):** cleaning tasks with 3 or more recorded times, or at least one note, on done occurrences completed after `minutesSetAt` (the spec 011 baseline). For each one, the input carries its place, estimate, frequency, its latest 10 times with dates, and its latest 5 notes with dates. At most 40 tasks per request, with the most data first.
- **Data:** a new table `task_adjustment` (migration `0010`): owner, the source `task_id` (cascade), `change` (`minutes`, `frequency`, or `new_task`), nullable `name`, `minutes`, and `frequency_days`, the AI's `reason`, and an `evidence` line built by code at request time ("Last 5: 14, 16, 15, 22, 15 min · Note on Oct 20: full deep clean"), so a card shows what the AI saw even after more check-offs. A new task goes to the source task's room and item.
- **AI (AC2, AC3):** `src/lib/ai/task-adjustments.ts`, built like `task-proposals.ts`: tasks get references (`t1`, `t2`, ...), and Gemini returns structured suggestions with a reference, a change, nullable values, and a reason in the owner's language. Code drops unknown references, out-of-range values (spec 003 limits), changes to the same value, more than one minutes or frequency change per task, new tasks whose name repeats a task in the same place, and empty or overlong reasons. `AI_FAKE=1` uses a deterministic fake: a minutes change when the median of the times is off by the calibration threshold, and a deep-clean task when there is a note; a home note with "[fail]" makes it throw.
- **Mutations (Server Actions):** `suggestAdjustments` returns "nothing to review" without calling the AI when nothing qualifies, and on success replaces the pending suggestions in one transaction (AC6); on failure it writes nothing (AC5). `acceptAdjustment` applies the suggestion. A minutes change counts as set by hand: `minutesSetAt` is set and the calibration note is dropped, as in `updateTask`. A frequency change resets `firstDue`. A new task is inserted. The suggestion is deleted, then the plan is replanned. `acceptEditedAdjustment` does the same with the values from the spec 003 task form (AC4). `discardAdjustment` deletes the suggestion. Every action resolves the user with `getCurrentUser()` and filters by owner.
- **Offline (AC7):** the page joins the tasks offline cache warmer and is readable offline. Asking, accepting, editing, and discarding are disabled offline through `useEditsDisabled`, like proposals.
- No new dependencies and no ADR: this follows ADR 0006 (proposals) and ADR 0009 (calibration baseline).

### Tasks

- [x] T1: Data and rules: the `task_adjustment` table and migration `0010`; pure helpers for qualification, the evidence line, and change labels ("10 → 15 min", "Every 7 → 14 days", "New: ..., 30 min, every 30 days"); a query reading the qualifying tasks with their times and notes. Files: `src/db/schema/tasks.ts`, `drizzle/0010_*.sql`, `src/lib/tasks/adjustments.ts` (+ test), `src/lib/tasks/adjustment-queries.ts`. Covers: AC1, AC3.
- [ ] T2: AI request, validation, and fake. Files: `src/lib/ai/task-adjustments.ts` (+ test), `src/lib/ai/fake-adjustments.ts`. Covers: AC2, AC3.
- [ ] T3: Server Actions and pending suggestions read. Files: `src/app/(app)/tasks/adjustments/actions.ts`, `src/lib/tasks/queries.ts` (`getAdjustments`). Covers: AC4, AC5, AC6.
- [ ] T4: UI: the Adjustments page, a configurable `GenerateButton`, adjustment cards with accept, edit (task form in a dialog), and discard, links on the Tasks page, and the offline warmer. Files: `src/app/(app)/tasks/adjustments/page.tsx`, `src/app/(app)/tasks/page.tsx`, `src/components/tasks/{generate-button,adjustment-list,adjustment-card,tasks-cache-warmer}.tsx` (+ tests). Covers: AC1, AC3, AC4, AC5, AC7.
- [ ] T5: E2E and docs. Files: `e2e/adjustments.spec.ts`, `e2e/support/auth.ts` (record notes), `docs/ARCHITECTURE.md`. Covers: AC1 to AC7.

### Test plan

- Unit: qualification thresholds and the baseline, evidence line, and change labels (AC1, AC3); the prompt contents and every validation rule, including the fake (AC2, AC3); the button's busy, empty, success, and error states (AC1, AC5, AC7); cards: change, reason, evidence, accept, edit, discard, accessible names, and disabled offline (AC3, AC4, AC7).
- E2E (CI): with recorded times and a note, the page says how many tasks it reviews; asking shows a minutes change and a new task with reasons; editing and accepting the minutes updates the task, accepting the new task adds it, discarding leaves the rest; pending suggestions survive a reload and asking again replaces them; a "[fail]" home note shows "Try again" and changes nothing; with nothing to review, the explanation shows; 360px in dark mode with the keyboard only and no console errors (AC1 to AC7).
