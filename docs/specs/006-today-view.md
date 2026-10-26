# 006: Today view and habit

- **Status**: In progress
- **Owner**: @mrtrukiny
- **Created**: 2026-10-26

## Goal

Make the daily session something the owner does and tracks, not just reads. Opening the app shows today's session; the owner checks tasks off as they go, on the phone and even without a connection, can skip a task, and keeps a streak of completed days. What was actually done replaces the scheduler's current assumption that every past day went as planned (spec 004): tasks left unchecked come back and are spread over the next days within the budget. See "Today view and habit" in [`PRODUCT.md`](../PRODUCT.md#mvp-phase-1) and the principle "Forgiving by design".

## User stories

- As the owner, I want to open the app and see today's session right away, so that I can start cleaning without navigating.
- As the owner, I want to check tasks off as I finish them, so that I see my progress and the plan knows what was done.
- As the owner, I want to skip a task I can't or don't need to do today, so that it waits for its next time instead of piling up.
- As the owner, I want tasks I didn't get to to come back on the next days without overloading them, so that missing a day doesn't derail the routine.
- As the owner, I want a streak of completed days, so that I'm motivated to keep the habit.
- As the owner, I want checking off to work when my phone's connection is flaky, so that I never lose what I did.

## Acceptance criteria

Each criterion is testable and maps to at least one test.

- [ ] AC1: Given I have a plan, when I open the app, then the home page shows today: the date, the session's start and end time, its cleaning tasks with minutes and what each belongs to, progress ("15 of 38 min done"), and today's routines apart. Given today is off, it says "Day off" and still lists today's routines. Given I have no schedule yet or no cleaning tasks, it shows the same calls to action as the plan ("Set your schedule", "Propose tasks"). It links to the week's plan.
- [ ] AC2: Given today's session, when I check a task, then it shows as done and the progress updates at once; unchecking it undoes that. Routines can be checked the same way, and don't count toward the progress. After a reload, I see what I checked.
- [ ] AC3: Given a cleaning task in today's session, when I choose "Skip", then it shows as skipped, it leaves the progress (the session's total drops by its minutes), and it comes back at its next time counted from today, as if done. "Undo" restores it.
- [ ] AC4: Given a past day had cleaning tasks that weren't checked or skipped, then they count as not done: on the next plan, each one is due from its last real completion, so it comes back as soon as the budget allows, most overdue first, without any day going over its budget. Days that went as planned stay as they were. Past days can no longer be checked or skipped.
- [ ] AC5: Given my history, then the home page shows my streak: the number of consecutive cleaning days, ending today or yesterday, on which every cleaning task was done or skipped. Days off and days with no cleaning tasks neither break nor extend it. Today extends the streak once its last cleaning task is done, and doesn't break it while the day is still going. Skipping every task of a day doesn't count as completing it. A streak of 0 says "Start a streak today".
- [ ] AC6: Given I'm offline, when I check, uncheck, or skip a task, then it changes at once and shows "Saved on this device", it survives closing and reopening the app, and it is sent to the server when the connection is back, in the order I made the changes. Nothing is lost or applied twice. Given the plan changed in the meantime and a task is no longer in today's session, then that change is dropped with a notice.
- [ ] AC7: Given saving a check-off fails while online, then the task keeps its new state, the app retries, and a notice appears only if it still can't save. Loading today shows a skeleton, and a failure to load shows a message with "Try again".
- [ ] AC8: The home page works at 360px and on desktop, in light and dark mode, and with the keyboard only. Each task's checkbox and "Skip" button has an accessible name that includes the task, progress and the streak are announced to screen readers when they change, and touch targets are at least 44px.

## UX notes

- **Home page:** today replaces the current home page, so the app name in the header leads there. Layout: a heading with the date ("Today, Monday, Oct 26"), the streak as a short line ("5-day streak"), the progress as text and a bar, then the task list, then "Also today" with routines, then a "See your week" link.
- **Task rows:** a large checkbox with the name and what it belongs to, minutes on the right, and a "Skip" button in a row menu or as a small secondary button. Done tasks are struck through and dimmed; skipped ones say "Skipped" with "Undo". The row stays in place when checked, so the list doesn't jump.
- **Completed day:** when the last cleaning task is done, a short celebration line replaces the progress ("Done for today. 6-day streak."), without a modal.
- **Offline:** the usual offline notice, but here edits keep working; rows changed offline show a small "Saved on this device" until synced. The week's plan and settings stay read-only offline as in spec 004.
- **Before the session's start time:** the tasks can already be checked; the time is a plan, not a lock.

## Out of scope

- Checking off or editing past days, including yesterday (a possible follow-up if forgetting to check off turns out to be common).
- Checking off future days' tasks early, or moving a task to another day by hand.
- Logging actual minutes (phase 2, time calibration) and room freshness.
- Updating the Google Calendar event when tasks are checked (spec 005 creates the events; this can follow).
- Push notifications or reminders, and streak rewards beyond the count.

## Open questions

- None. Decided with the owner: a day counts for the streak when all of its cleaning tasks are done (skipped ones count, but not a day of only skips; routines don't count), unchecked tasks come back and are redistributed, "Skip" postpones a task until its next time, and check-offs made offline are kept on the device and synced later.

---

## Technical plan

### Approach

- **History becomes real.** `occurrence` gets a `status` (`scheduled`, `done`, `skipped`) and a `completed_at`. A task's last completion is its latest `done` or `skipped` occurrence before the replanning date; a task with past occurrences but none handled is due on its first missed date. This replaces ADR 0007's "past days went as planned". Routines follow the same rule; they sit outside the budget, so a missed one just comes back the next day.
- **The plan is rebuilt once a day.** `schedule_settings.replanned_on` records the owner's date of the last full replan. `ensurePlan` (replacing `ensureHorizon`) replans from today when that date is in the past, which redistributes yesterday's misses, and otherwise only extends the horizon. The day's first visit pays for it; spec 005's daily job calls the same function.
- **Handled work is never rewritten.** Once any of today's occurrences is done or skipped, today counts as started and replans begin tomorrow (as after the start time). The replan deletes only `scheduled` rows, as a second guard.
- **New tasks keep their first due date.** Today a task the scheduler hasn't placed yet is spread again on every replan; replanning daily would push infrequent tasks back forever. `task.first_due` stores the day the scheduler picked, and later replans treat it as fixed until the task is first done.
- **Check-off is a Server Action that sets, not toggles**: `setOccurrenceStatus(occurrenceId, status)`. It resolves the user, accepts only the owner's occurrences dated today in their time zone (skip only for cleaning tasks), and returns `ok`, `gone` (no such occurrence), or `past`. Setting is idempotent, so a queued change sent twice is harmless. It doesn't replan: done or skipped matches what the plan already assumed, and an unchecked task is picked up by the next daily replan.
- **Today at `/`** is a Server Component that reads settings (cached), then after `io()` calls `ensurePlan` and reads today's occurrences with their status and the streak window, inside `Suspense` with a skeleton. A client leaf (`TodaySession`) owns the list state: it applies each change at once, recomputes progress, and sends it through the queue. The progress and streak lines are `aria-live`.
- **Streak and progress are pure functions** over per-day counts of cleaning occurrences (total, done, skipped) for the last 400 days, so they are unit tested without a database.
- **Offline: a device queue** (ADR 0008, amending ADR 0005's "nothing is queued" for this page only). Changes go to a `localStorage` queue keyed by user, one entry per occurrence (a later change replaces an earlier one). The queue is flushed in order on load, on the `online` event, and when the page becomes visible; entries leave it only after the server answers `ok`, `gone` (shown as a notice), or `past`. While queued, the row shows "Saved on this device", and the page overlays queued states on the server's, so a reload, including from the offline copy, still shows them. `/` joins the offline document routes (exact match) and the Today page warms its own copy and `/plan` after each change.
- **Home inventory** leaves the home page; the header already links to Rooms.

### Tasks

- [x] T1: ADR 0008 (check-off history, daily replan, offline queue; amends ADRs 0005 and 0007). Files: `docs/decisions/0008-check-off-and-offline-queue.md`, `docs/decisions/0005-offline-inventory-reading.md`, `docs/decisions/0007-persisted-plan-and-replanning.md`. Covers: AC4, AC6.
- [x] T2: Schema: `occurrence.status` (check constraint) and `completed_at`, `task.first_due`, `schedule_settings.replanned_on`; migration. Files: `src/db/schema/schedule.ts`, `src/db/schema/tasks.ts`, `drizzle/0004_check_off.sql`, `drizzle/meta/*`. Covers: AC2, AC3, AC4.
- [x] T3: Scheduler history: a pure `lastCompletions(rows, from)` that turns occurrences with status and first dues into the scheduler's input, and `schedule` reporting the first due it picks for new tasks. Files: `src/lib/scheduler/history.ts`, `src/lib/scheduler/history.test.ts`, `src/lib/scheduler/schedule.ts`, `src/lib/scheduler/schedule.test.ts`. Covers: AC3, AC4.
- [x] T4: Planning: `ensurePlan` (daily replan, then horizon), `replanStart` treating a handled today as started, replans delete only `scheduled` rows and save first dues; plan and schedule pages use `ensurePlan`. Files: `src/lib/scheduler/plan.ts`, `src/lib/scheduler/replan-start.ts`, `src/lib/scheduler/replan-start.test.ts`, `src/lib/scheduler/queries.ts`. Covers: AC4.
- [ ] T5: Today data and rules: progress and streak functions, `getToday(settings, now)` (today's occurrences with status, plus streak counts). Files: `src/lib/today/progress.ts`, `src/lib/today/streak.ts`, their tests, `src/lib/today/queries.ts`. Covers: AC1, AC3, AC5.
- [ ] T6: Check-off action with input schema and result codes. Files: `src/app/(app)/actions.ts`, `src/lib/today/schemas.ts`, `src/lib/today/schemas.test.ts`. Covers: AC2, AC3, AC4, AC7.
- [ ] T7: Today page: session list with checkboxes, skip and undo, progress bar, streak line, completed-day line, routines, day off and empty states, skeleton and load error. Files: `src/app/(app)/page.tsx`, `src/components/today/today-session.tsx`, `src/components/today/task-row.tsx`, `src/components/today/today-session.test.tsx`, `src/components/today/today-summary.tsx`. Covers: AC1, AC2, AC3, AC5, AC7, AC8.
- [ ] T8: Offline queue: queue module, flush hook with retry and notices, pending indicator, `/` as an offline document route, cache warming. Files: `src/lib/today/queue.ts`, `src/lib/today/queue.test.ts`, `src/components/today/use-check-off-queue.ts`, `src/components/today/today-session.tsx`, `src/app/sw.ts`. Covers: AC6, AC7.
- [ ] T9: E2E and docs: today flows and offline check-off; update specs that opened the inventory from the home page; architecture notes; spec status. Files: `e2e/today.spec.ts`, `e2e/today-offline.spec.ts`, `e2e/support/today.ts`, `e2e/inventory.spec.ts`, `docs/ARCHITECTURE.md`, this spec. Covers: AC1, AC2, AC3, AC5, AC6, AC8.

### Test plan

- **Unit (Vitest)**:
  - AC3, AC4: `history.test.ts` (missed tasks due on their first missed date, skips count as done, routines, first dues kept) and `schedule.test.ts` (missed tasks come back most overdue first without exceeding budgets; an infrequent new task isn't postponed by daily replans).
  - AC4: `replan-start.test.ts` (a handled today starts the replan tomorrow).
  - AC1, AC3, AC5: `progress.test.ts` (skips leave the total) and `streak.test.ts` (days off neutral, all-skipped day doesn't count, today extends but doesn't break, gaps).
  - AC2, AC3, AC7: `schemas.test.ts` and `today-session.test.tsx` (immediate update, undo, accessible names, retry notice).
  - AC6: `queue.test.ts` (order, one entry per occurrence, survives reload, `gone` drops with a notice).
- **E2E (Playwright, desktop and mobile)**:
  - AC1, AC2, AC3, AC5, AC8: `today.spec.ts` (session shown, check and reload, skip and undo, streak goes from "Start a streak today" to "1-day streak" when all are done, keyboard, dark mode, no console errors).
  - AC6: `today-offline.spec.ts` (check offline, reload offline, back online and the server has it).
