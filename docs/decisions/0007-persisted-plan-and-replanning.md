# 0007: Persisted plan and replanning

- **Status**: Accepted
- **Date**: 2026-10-25

## Context

Spec 004 needs a plan that never changes in the past, moves forward as days pass (assuming each past day was done as planned, until check-off exists in spec 006), and is recomputed when tasks or settings change. A plan computed on the fly from the current tasks would rewrite the past on every edit, and the "last time this task was done" would be unknown. Spec 005 also needs somewhere to keep each day's calendar event, and spec 006 needs somewhere to record completion.

## Decision

- **Occurrences are stored.** An `occurrence` row says "this task is planned for this date" (unique per task and date). Past occurrences are the history: a task's last completion is its latest occurrence before the replanning date.
- **The scheduler is a pure function** (`src/lib/scheduler/`) from tasks, settings, last completions, and a date range to occurrences. It has no I/O, uses whole-day numbers rather than `Date` arithmetic, and breaks ties by frequency, name, and id, so the same input always gives the same plan.
- **Replanning replaces the future only.** It starts today if today's start time hasn't passed in the owner's time zone, otherwise tomorrow. It deletes occurrences from that date on and inserts the new ones, in one transaction. It runs after every task or settings change.
- **The horizon is extended on read.** When the plan page finds fewer than 7 planned days ahead, it plans the missing days after the last planned one. The unique key makes this safe to repeat. Spec 005's daily job will call the same function.
- **Schedule settings live in `schedule_settings`**, one row per user: a start time per weekday (null for a day off), the weekday and weekend budgets, and the IANA time zone reported by the device. There is no plan until the owner saves them once, which is also how the time zone is captured.

## Consequences

- Deleting a task deletes its occurrences, including past ones. The plan only shows the future, so nothing visible changes in the past.
- Editing a task's minutes changes how its past occurrences would read. Spec 006 can snapshot minutes on completion if history needs to be exact.
- The plan page writes to the database while rendering when the horizon is short. The write is idempotent and scoped to the signed-in user.
