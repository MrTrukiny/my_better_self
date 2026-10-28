# 0009: Time calibration and planned minutes

- **Status**: Accepted
- **Date**: 2026-10-28

## Context

Spec 009 records how long done cleaning tasks took. Spec 011 turns those times into estimates automatically, with no approval step, so the daily session fits its budget. Two questions follow: which times count, and what happens to a session that is already under way when an estimate changes. Until now every page read a task's current minutes, so changing them rewrote today's session and its slots on the spot.

## Decision

- **The rule**: once a cleaning task has at least 3 recorded times since its baseline, its estimate becomes the median of the last 5 (by day), rounded and kept within the task's minute limits. Changes under 2 minutes and under 20% are ignored, so estimates don't flicker. Routines are never calibrated.
- **The baseline** is `task.minutes_set_at`: null until the owner sets the minutes by hand, then the time of that edit. Only times saved after it count. A time's save time is the occurrence's `completed_at`, which every check-off save rewrites.
- **When**: after every change to a cleaning occurrence, so a new, corrected, or cleared time is taken into account. A calibrated task keeps the note's data in `task.calibrated_from` and `task.calibrated_samples`; a manual edit of the minutes clears them.
- **Occurrences keep the minutes they were planned with** (`occurrence.planned_minutes`). Today, the plan, and calendar events read them, falling back to the task's minutes for rows planned before this column existed. Replans rewrite only the days they replan, so a day that has started keeps its minutes and slots, and the next days use the new estimate.

## Consequences

- A manual edit of the minutes no longer changes a session that has started; it applies from the next replanned day, like any other task change.
- Calibration replans after a time is saved, so saving a time can be slower than a plain check-off.
- Times recorded before spec 011 ship count, since tasks start without a baseline.
- Amends ADR 0007 (what a replanned day stores) and ADR 0008 (check-offs can now change a task).
