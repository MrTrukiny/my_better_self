# 006: Today view and habit

- **Status**: Draft
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

_Filled in by the `plan-feature` skill after the spec is approved._

### Approach

### Tasks

### Test plan
