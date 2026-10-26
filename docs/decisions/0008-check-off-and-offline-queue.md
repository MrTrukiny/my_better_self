# 0008: Check-off history and the offline queue

- **Status**: Accepted
- **Date**: 2026-10-26

## Context

Spec 006 lets the owner check off and skip the day's tasks, including offline, and asks the plan to bring back what wasn't done. Until now the plan assumed every past day went as planned (ADR 0007), and offline pages were read-only with nothing queued (ADR 0005). Both assumptions have to change, and the scheduler must not start postponing tasks once it replans every day.

## Decision

- **Occurrences carry a status**: `scheduled`, `done`, or `skipped`, with `completed_at` for handled ones. A task's last completion is its latest `done` or `skipped` occurrence before the replanning date. A task with past occurrences but none handled since its last completion is due on its first missed date, so it counts as overdue from then.
- **The plan is rebuilt once a day.** `schedule_settings.replanned_on` stores the owner's date of the last full replan. `ensurePlan`, which replaces `ensureHorizon`, replans from today when that date is in the past, and otherwise only plans the days missing from the horizon. Spec 005's daily job calls it too.
- **Handled work is never rewritten.** Once any of today's occurrences is handled, today counts as started and replans begin tomorrow, as they do after the start time. Replans also delete only `scheduled` rows.
- **New tasks keep their first due date.** The day the scheduler picks for a task that was never done is saved as `task.first_due`, and later replans use it instead of spreading the task again. Without it, a daily replan moves an infrequent task's first date forward every day.
- **Check-off sets a state, it doesn't toggle**, and only for today's occurrences in the owner's time zone. Sending the same change twice is harmless.
- **Offline check-off goes through a device queue.** Changes are kept in `localStorage`, one entry per occurrence (the latest wins), and sent in order when the app loads, comes back online, or becomes visible. An entry leaves the queue only when the server accepts it or answers that it no longer applies; the latter shows a notice. The Today page overlays queued states on what the server returned, so its offline copy shows them too. This is the only place where offline changes are queued; other pages stay read-only offline.

## Consequences

- The plan's first visit each day writes to the database while rendering, as horizon extension already did.
- A day with nothing checked counts as missed after it ends, including days the owner simply didn't open the app. That matches the streak definition.
- Background Sync isn't used, since iOS doesn't support it; queued changes wait for the app to be opened again.
- Changes queued on a device the owner never opens again are lost. That is acceptable for a single-owner app.
- Amends ADR 0005 (offline queue for the Today page) and ADR 0007 (history from statuses, daily replan).
