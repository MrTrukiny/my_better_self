# 011: Time calibration

- **Status**: Approved
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

_Filled in by the `plan-feature` skill after the spec is approved._

### Approach

### Tasks

### Test plan
