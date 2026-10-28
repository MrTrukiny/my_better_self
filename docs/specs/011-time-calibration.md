# 011: Time calibration

- **Status**: In progress
- **Owner**: @mrtrukiny
- **Created**: 2026-10-28

## Goal

Spec 009 records how long a done cleaning task actually took, but estimates still come from the AI and never change. When a task keeps taking longer (or shorter) than planned, the daily session overruns its budget or leaves time unused. This spec adjusts each task's estimate automatically from the owner's recorded times, so the plan fits the real 45 minutes. It is the "Time calibration" item of Phase 2 in [`docs/ROADMAP.md`](../ROADMAP.md#phase-2-smarter-routine).

## User stories

- As the owner, I want estimates to follow how long tasks really take me, so my session ends on time.
- As the owner, I want to see when and why an estimate changed, so the plan doesn't feel arbitrary.
- As the owner, I want to set an estimate by hand when I know better, so calibration doesn't fight me.

## Acceptance criteria

- [ ] AC1: Given a cleaning task has at least 3 recorded times since its estimate was last set by hand, when I record a new time, then its estimate becomes the median of its last 5 recorded times, rounded to whole minutes and kept within the task's minute limits.
- [ ] AC2: Given the median differs from the current estimate by less than 2 minutes and less than 20%, then the estimate stays as it is.
- [ ] AC3: Given an estimate changed by calibration, then the plan is rebuilt from the next replannable day as after any task change, and the Google Calendar events follow. Today's session and its slots don't change mid-day.
- [ ] AC4: Given an estimate was calibrated, then the tasks page shows it with a note ("Adjusted from 10 to 15 min from your last 3 times"), and the task's edit form shows the same note.
- [ ] AC5: Given I edit a task's minutes by hand, then my value is kept, and only times recorded after that edit count toward the next calibration.
- [ ] AC6: Given I clear or change a recorded time (spec 009), then calibration uses the corrected values the next time it runs; a time that was cleared doesn't count.
- [ ] AC7: Routines and tasks with fewer than 3 recorded times are never calibrated.
- [ ] AC8: The note is readable at 360px and on desktop, in light and dark mode, and is announced as part of the task's row for screen readers.

## UX notes

- No new screen and no confirmation: calibration happens when a time is saved, like a check-off.
- The note sits under the task's minutes in the tasks list, in muted text; it disappears once I set the minutes by hand.
- Offline: times queued on the device (spec 009) calibrate when they reach the server.

## Out of scope

- Calibrating from times recorded before this spec ships beyond what is stored (all stored times count).
- Teaching the AI from calibrated estimates when it proposes new tasks.
- Calibrating routines, or the daily budget itself.
- A history chart of recorded times.

## Open questions

- None. Decided with the owner: calibration is automatic, with no approval step.

---

## Technical plan

### Approach

- **Rule (pure):** `calibrate({ minutes, kind, times })` in `src/lib/tasks/calibration.ts` returns the new estimate or null. `times` are the task's recorded times since its baseline, newest first; it needs at least 3, takes the median of the first 5 (the mean of the middle two, rounded, for an even count), keeps it within `minutesMax(kind)`, and returns null for routines or when the change is under 2 minutes and under 20%.
- **Data:** `task.minutes_set_at` (null until the owner sets minutes by hand; only times recorded after it count), `task.calibrated_from` and `task.calibrated_samples` (the note; null when the estimate wasn't calibrated). Recorded times are done occurrences with `actual_minutes`, newest day first, whose `completed_at` (rewritten on every save) is after the baseline.
- **When:** `setOccurrenceStatus` calibrates the occurrence's task after every cleaning change, so a new, corrected, or cleared time is taken into account (AC6). A changed estimate updates the task, refreshes the tasks cache, and replans like any task edit.
- **Today stays put:** occurrences get `planned_minutes`, written when they are planned. Today, the plan, and calendar events read it (falling back to the task's minutes for older rows), so a started day keeps the minutes and slots it was planned with, while replanned days pick up the new estimate (AC3). Recorded in ADR 0009.
- **Manual edits:** `updateTask` resets the baseline and clears the note only when the minutes change (AC5).
- **UI:** `TaskEntry` carries `calibration` for tasks; `TaskSummary` shows the note under the minutes, and the edit form shows it under the minutes field (AC4, AC8).

### Tasks

- [ ] T1: ADR 0009 (calibration rule, baseline, planned minutes on occurrences). Files: `docs/decisions/0009-time-calibration.md`. Covers: AC1–AC3, AC5.
- [ ] T2: Schema and migration. Files: `src/db/schema/tasks.ts`, `src/db/schema/schedule.ts`, `drizzle/0007_*.sql`, `drizzle/meta/*`. Covers: AC1, AC3, AC5.
- [ ] T3: Calibration rule. Files: `src/lib/tasks/calibration.ts`, `src/lib/tasks/calibration.test.ts`. Covers: AC1, AC2, AC7.
- [ ] T4: Planned minutes: written by `planRange`, read by Today, the plan, and calendar sync. Files: `src/lib/scheduler/plan.ts`, `src/lib/scheduler/queries.ts`, `src/lib/today/queries.ts`, `src/lib/calendar/sync.ts`. Covers: AC3.
- [ ] T5: Calibrate after check-offs. Files: `src/lib/tasks/calibrate.ts`, `src/app/(app)/actions.ts`. Covers: AC1, AC3, AC6, AC7.
- [ ] T6: Manual edits reset the baseline. Files: `src/app/(app)/tasks/actions.ts`. Covers: AC5.
- [ ] T7: The note on the tasks page and in the edit form. Files: `src/lib/tasks/queries.ts`, `src/lib/tasks/format.ts`, `src/components/tasks/proposal-card.tsx`, `src/components/tasks/task-row.tsx`, `src/components/tasks/task-form.tsx`, tests. Covers: AC4, AC8.
- [ ] T8: E2E and docs. Files: `e2e/calibration.spec.ts`, `docs/ARCHITECTURE.md`. Covers: AC1–AC8.

### Test plan

- Unit: the rule (fewer than 3 times, median of the last 5, even counts, limits, the 2-minute and 20% threshold, routines) (AC1, AC2, AC7); the note text and where it shows (AC4, AC8).
- E2E: three recorded times on past days of one task (seeded on earlier days through the test database) and a fourth saved from Earlier days calibrate it; the tasks page and the edit form show the note; Today's started session keeps its minutes; editing the minutes by hand removes the note and resets the count (AC1, AC3–AC5); clearing a time recalibrates from the rest (AC6); 360px, dark mode, keyboard, no console errors (AC8).
