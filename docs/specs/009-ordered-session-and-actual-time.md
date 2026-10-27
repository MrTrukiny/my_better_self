# 009: Ordered session and actual time

- **Status**: Approved
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

_Filled in by the `plan-feature` skill after the spec is approved._
