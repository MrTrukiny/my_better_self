# 009: Ordered session and actual time

- **Status**: In progress
- **Owner**: @mrtrukiny
- **Created**: 2026-10-27

## Goal

Turn today's session on the home page into a to-do list the owner can follow from start to finish: the cleaning tasks in a recommended order, each with its own time slot, and a place to note how long each one actually took. The order follows how people clean (one room at a time, top to bottom, floors last), and the slots follow from the session's start time and each task's estimate. Recording actual minutes is the first step of "Time calibration" in [`ROADMAP.md`](../ROADMAP.md#phase-2-smarter-routine); this spec only records and shows them. Builds on spec 006 (Today view) and spec 007 (fixed-length sessions).

## User stories

- As the owner, I want today's tasks in the order I should do them, so that I don't have to decide where to start or clean something twice.
- As the owner, I want each task to show from what time to what time, so that I know whether I'm on track.
- As the owner, I want to note how long a task really took, so that I can compare it with the estimate and the app can learn from it later.

## Acceptance criteria

Each criterion is testable and maps to at least one test.

- [ ] AC1: Given today has cleaning tasks, then the home page lists them as one numbered list in the recommended order, instead of grouped by place:
  - One room at a time, in the order of the rooms page; tasks for the whole home come last.
  - Within a room: high places and dusting first, then furniture, fixtures, and appliances, then wet areas (sink, toilet, shower), then floors; the room's own quick or deep pass comes last.
  - The same tasks always come in the same order.
- [ ] AC2: Given the session starts at 06:30, then each task shows its slot, back to back from the start time using the estimated minutes ("1. 06:30–06:40"). Slots are the plan: they don't move when I check, skip, or record time. Given today is off or has no start time, tasks show no slots.
- [ ] AC3: Given a task is done, then it shows a "Took" minutes field. Given I enter whole minutes from 1 to 240, then it is saved and shown with the estimate ("Took 12 min, est. 10"). I can change it, or clear it to remove it. A value outside that range shows a field message and isn't saved. Checking a task never requires a time; skipped tasks have no time field.
- [ ] AC4: Given I uncheck a task that has a recorded time, then the time is removed with it.
- [ ] AC5: Given I recorded times today, then the progress area also shows the total ("Took 32 min so far"), next to the planned progress, which keeps using estimates.
- [ ] AC6: Given I'm offline, when I enter or change a time, then it is kept on the device with "Saved on this device" and sent with the check-offs when the connection is back, in order, as in spec 006.
- [ ] AC7: Routines keep their own "Also today" section, without slots or a time field.
- [ ] AC8: The list works at 360px and on desktop, in light and dark mode, and with the keyboard only. Each time field has an accessible name with the task ("Minutes taken for Clean the kitchen window"), errors are announced, and touch targets are at least 44px.

## UX notes

- **Row:** position number and slot on the first line ("1 · 06:30–06:40"), then the checkbox with the task name and what it belongs to, then estimated minutes on the right, as today. The "Took" field appears under a done task's name: a small numeric input with a "min" suffix, saved when it loses focus or on Enter.
- Checking off, skipping, and the streak behave as in spec 006; the list doesn't reorder when tasks change state.
- The week's plan keeps its current grouping; only the home page becomes an ordered list.

## Out of scope

- Adjusting estimates from recorded times (a follow-up time-calibration spec).
- Reordering tasks by hand, or letting the AI choose the order.
- Recording time for routines or skipped tasks, or for past days.
- Shifting the following slots when a task runs long.

## Open questions

- None. Decided with the owner: the order comes from fixed rules, times are only recorded and shown, and recording is optional.

---

## Technical plan

### Approach

- **Order (pure):** `sessionOrder` in `src/lib/today/order.ts` sorts today's cleaning tasks by room position (the rooms page order: `room.createdAt`, then id; whole-home tasks last), then by a zone rank from the item type, then by item position, name, and id. Zones: high and dusting (`light-fixture`, `shelf`), furniture, fixtures, and appliances (every other type, including `other`), wet (`sink`, `toilet`, `shower`, `bathtub`), floors (`floor`, `rug`), and the room's own tasks (no item) last. `getToday` selects the room and item positions and the item type, and sorts cleaning tasks with it; routines keep `byPlace`.
- **Slots (pure):** `sessionSlots(start, ordered)` in `src/lib/today/slots.ts` returns back-to-back slots from the start time using each task's estimated minutes, whatever its status, so slots never move. No start time, no slots.
- **Actual minutes (data):** a nullable `occurrence.actual_minutes` integer (migration `0006`). `setOccurrenceStatus` takes an optional `actualMinutes`: a number from 1 to 240 sets it, `null` clears it, and leaving it out keeps it. Any status other than `done` clears it, and a routine with minutes is `invalid`. Setting it doesn't replan, like check-offs (ADR 0008).
- **Offline:** a queued change gains an optional `actualMinutes`, with the same keep, set, or clear meaning. One entry per occurrence still holds, since each entry carries the status: checking then typing a time queues `done` with minutes, and unchecking queues `scheduled`, which clears it. Older entries without the field stay valid.
- **UI (client leaves):** `TodaySession` overlays queued and local minutes the way it does statuses, numbers the cleaning rows, and adds the "Took 32 min so far" line. `TaskRow` shows the position and slot, and a `TookField` under done cleaning tasks: a numeric input with a "min" suffix, saved on blur or Enter, validated from 1 to 240 with a field message linked through `aria-describedby`. The page stays a Server Component; no caching changes, since today is read uncached after `io()`.
- No new dependencies. ADR 0008 gets an amendment for the queued minutes rather than a new ADR.

### Tasks

- [ ] T1: Actual minutes column: `actualMinutes` on `occurrence`, and the generated migration. Files: `src/db/schema/schedule.ts`, `drizzle/0006_actual_minutes.sql`, `drizzle/meta/*`. Covers: AC3.
- [ ] T2: Session order: `sessionOrder` with zone ranks, and `getToday` selecting room and item positions, item type, and actual minutes, sorting cleaning tasks with it. Files: `src/lib/today/order.ts`, `src/lib/today/order.test.ts`, `src/lib/today/progress.ts` (`TodayTask` fields), `src/lib/today/queries.ts`. Covers: AC1.
- [ ] T3: Slots: `sessionSlots` from the start time and estimates, unaffected by status. Files: `src/lib/today/slots.ts`, `src/lib/today/slots.test.ts`. Covers: AC2.
- [ ] T4: Saving minutes: `actualMinutes` in the input schema and the decision (routines refuse it), and `setOccurrenceStatus` setting, keeping, or clearing it; `progressOf` adds `tookMinutes`. Files: `src/lib/today/schemas.ts`, `src/lib/today/schemas.test.ts`, `src/app/(app)/actions.ts`, `src/lib/today/progress.ts`, `src/lib/today/progress.test.ts`. Covers: AC3, AC4, AC5, AC7.
- [ ] T5: Queue carries minutes: optional `actualMinutes` on `QueuedChange`, validated on read, and the hook's `change` taking it. Files: `src/lib/today/queue.ts`, `src/lib/today/queue.test.ts`, `src/components/today/use-check-off-queue.ts`. Covers: AC6.
- [ ] T6: Ordered list UI: numbered rows with slots, `TookField`, the overlay of minutes, and the "Took … so far" line. Files: `src/components/today/today-session.tsx`, `src/components/today/task-row.tsx`, `src/components/today/took-field.tsx`, `src/components/today/today-session.test.tsx`. Covers: AC1, AC2, AC3, AC4, AC5, AC7, AC8.
- [ ] T7: E2E and docs: order and slots, recording, changing, clearing, and unchecking a time, the offline queue with a time, keyboard and 360px. ADR 0008 amendment, `docs/ARCHITECTURE.md` (Today table), and spec 006's out-of-scope line pointing here. Files: `e2e/today.spec.ts`, `e2e/today-offline.spec.ts`, `e2e/support/today.ts`, `docs/decisions/0008-check-off-and-offline-queue.md`, `docs/ARCHITECTURE.md`, `docs/specs/006-today-view.md`. Covers: AC1–AC8.

### Test plan

- Unit: zone ranks and room, item, and whole-home ordering, stable for equal inputs (AC1); slots from a start time, unchanged by status, none without a start (AC2); input schema range and routine refusal, keep, set, and clear (AC3, AC4, AC7); `tookMinutes` (AC5); queue entries with and without minutes, and replacement per occurrence (AC6); `TodaySession` numbering, slots, the field's validation message and accessible name, and minutes cleared on uncheck (AC3, AC4, AC8).
- E2E: a home with a kitchen and a bathroom whose tasks show in the expected order with slots; recording a time, reloading, changing it, clearing it, and unchecking (AC1–AC5); routines without slots or a field (AC7); recording a time offline and seeing it saved after reconnecting (AC6); the flow by keyboard at 360px in dark mode without console errors (AC8).
- Production: migration `0006` runs against the production branch before or right after the deploy that needs it.
