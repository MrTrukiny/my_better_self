# 004: Scheduler

- **Status**: In progress
- **Owner**: @mrtrukiny
- **Created**: 2026-10-25

## Goal

Turn the approved tasks (spec 003) into a daily plan: one cleaning session per day, at a time the owner chooses, that never exceeds the day's budget and keeps every task close to its frequency. The plan is computed by deterministic code, not by the AI: the AI already estimated minutes and frequency, and packing them into days is arithmetic that must be predictable, testable, free, and explainable. This spec shows the plan in the app; spec 005 puts each day's session in Google Calendar. See "Scheduler" in [`PRODUCT.md`](../PRODUCT.md#mvp-phase-1) and the principle "AI proposes, the user decides, code schedules".

## User stories

- As the owner, I want to choose which days I clean, at what time each day (mornings work best for me), and how many minutes I clean on weekdays and on weekends, so that the plan fits my life.
- As the owner, I want to see what I'll clean each day for the next week, so that I know what's coming without planning it myself.
- As the owner, I want each day to stay within its budget, so that cleaning never turns into a long, exhausting session.
- As the owner, I want every task to come back about as often as its frequency says, and new tasks spread out instead of piling up on the first day, so that the home stays evenly clean.
- As the owner, I want to be told when my tasks need more time than my budget allows, so that I can raise the budget or make tasks less frequent.

## Acceptance criteria

Each criterion is testable and maps to at least one test.

- [ ] AC1: Given I open the schedule settings, when I turn each day of the week on or off, set a start time for each day that is on, and set a weekday budget and a weekend budget (whole minutes from 30 to 120), then they are saved and used by the plan. The defaults are every day on, 06:30 on every day, 45 minutes on weekdays, and 60 minutes on weekends. The time zone is taken from my device and shown. At least one day must stay on. Invalid values show a field message and are not saved.
- [ ] AC2: Given I have cleaning tasks, when I open the plan, then I see the next 7 days starting today. Each cleaning day shows its date, its start and end time (that day's start time plus its total minutes), its cleaning tasks with minutes and what each belongs to, and its total against the budget ("38 of 45 min"). A day that is off says so and has no cleaning tasks. The routines due each day, on or off, are listed apart and don't count toward the budget. Given I have no cleaning tasks, the plan explains that tasks come first and links to "Propose tasks".
- [ ] AC3: Given any set of tasks and settings, then days that are off get no cleaning tasks, and no cleaning day's total exceeds its budget: the weekday budget from Monday to Friday and the weekend budget on Saturday and Sunday.
- [ ] AC4: Given the average daily load (each task's minutes divided by its frequency, added up) fits the average time available per day (the budgets of the days that are on, added up over a week, divided by 7), then:
  - Every task's first session falls within its first frequency period: a task every 10 days first appears within the first 10 days.
  - After that, every task comes back no later than its frequency and no earlier than three quarters of it (rounded down). When the day it is due is off, it moves to the closest earlier cleaning day, or to the next one if no earlier day fits in that range.
  - Daily tasks appear on every cleaning day.
  - Tasks are whole (up to 30 minutes each), so when several big ones collide, a repetition can run late. With the load at up to 60% of the time available, fewer than 1 in 1,000 repetitions run late, by at most a day, when every day is on. With days off, under 5% do, by at most 3 days, mostly frequent tasks around several days off in a row.
- [ ] AC5: Given the average daily load exceeds the average time available, then the plan shows a notice with the minutes per day my tasks need and the minutes I have, and suggests raising a budget, turning on another day, or making tasks less frequent. Late tasks are scheduled by how overdue they are relative to their frequency, so a task every 3 days that is 2 days late goes before a task every 30 days that is 2 days late, and every task still appears within twice its frequency.
- [ ] AC6: Given days pass, then each past day counts as done as planned, until check-off exists (spec 006). Given I add, edit, or delete a task, or change the settings, then the plan is recomputed from today if today's start time hasn't passed, or from tomorrow otherwise, and past days don't change. The same tasks and settings always produce the same plan.
- [ ] AC7: Given I am offline, then the plan stays readable and the settings can't be changed, with a visible reason, consistent with specs 002 and 003.
- [ ] AC8: The plan and the settings work at 360px wide and on desktop, in light and dark mode, and with the keyboard only. Each day is a labeled list, and every control has an accessible name.

## UX notes

- **Entry points:** a "Plan" link in the header, next to "Tasks". The task list links to the plan ("See your week"), and the plan links to the schedule settings.
- **Plan layout:** one card per day, today first and marked "Today". Weekend days show their own budget. A day that is off shows "Day off". A cleaning day with no due tasks says "Nothing to clean, enjoy the day" instead of an empty card.
- **First visit:** until the owner saves the schedule once (prefilled with the defaults), the plan shows "Set your schedule" instead of days. Saving also records the device time zone.
- **Load summary:** above the days, a short line such as "Your tasks need about 41 min a day; you have about 48."
- **Start times:** one per day of the week, chosen by the owner. 06:30 is the default for every day, since mornings work best; the app doesn't read the calendar yet.
- **Routines:** listed under each day as "Also today", including days off, without minutes counting toward the budget. A daily routine shows on every day.
- **Settings:** a row per day of the week (Monday first) with an on/off switch and a time input, then the weekday and weekend budgets. A page on both mobile and desktop, since it has more fields than the other forms.
- **Offline:** read-only, with the same notice as the inventory and task pages.

## Out of scope

- Creating or updating Google Calendar events (spec 005).
- Checking off tasks, skipping a day, or redistributing missed work based on what was actually done (spec 006). Until then, every past day counts as done.
- Reading the calendar to suggest or pick free slots. Planned as a later version: the app would look for the earliest free gap inside a morning window.
- Budgets per day of the week beyond the weekday and weekend split, and one-off changes for a single date (a trip, guests).
- Moving a task to another day by hand.

## Open questions

- None. Decided with the owner: a start time per day (06:30 by default), days can be turned off, a separate and larger weekend budget, past days count as done until check-off exists, and the scheduler is deterministic code.

---

## Technical plan

### Approach

See [ADR 0007](../decisions/0007-persisted-plan-and-replanning.md) for the data model and replanning rules.

- **Scheduler (pure):** `src/lib/scheduler/schedule.ts` walks the range day by day, using whole-day numbers. On each day it keeps a list of candidates: tasks whose earliest date (last completion plus three quarters of the frequency, rounded down, at least 1) has arrived. A task without history is treated as due at the end of its first frequency period, which staggers new tasks.
  - **Cleaning days:** first, the tasks that must be done today (due before the next cleaning day) are packed, ordered by slack relative to frequency, `(due - day) / frequency` (negative slack is the overdue ratio). Then the day is topped up with early candidates in the same order, up to a target: the average load per cleaning day, capped at the budget. That evens out the days instead of filling every session. Tasks that don't fit are skipped (first fit), and the day never exceeds its budget.
  - **Routines:** placed on every day, including days off, when they are due, with no budget.
  - **Ties:** broken by frequency, name, and id.
- **Dates and time zone:** `src/lib/scheduler/dates.ts` converts between ISO dates and day numbers, gets the weekday, and computes "today" and the current time in the owner's IANA time zone with `Intl.DateTimeFormat`.
- **Data:**
  - `schedule_settings`: per-weekday start times, Monday first, null for off; budgets; time zone.
  - `occurrence`: task, date, unique on both.
  - `src/lib/scheduler/plan.ts` (server-only) holds `replan(userId, now)` and `ensureHorizon(userId, now)`. They read tasks, settings, and last completions, run the scheduler, and write in a transaction.
  - The task actions (accept, accept all, update, delete) and the settings action call `replan`.
- **Plan page (`/plan`):** a Server Component. The day list sits inside `Suspense` and calls `await io()` before reading the clock, then `ensureHorizon`, then reads the next 7 days (uncached, since it depends on the date). The load summary and the overload notice come from a pure `loadSummary(tasks, settings)`. Without saved settings, it shows a "Set your schedule" call to action. Without cleaning tasks, it links to "Propose tasks".
- **Settings page (`/schedule`):**
  - The form is a client component: a fieldset per weekday with a checkbox and a time input, then the two budgets.
  - A hidden field carries the device time zone.
  - It's validated by a Zod schema shared with the Server Action, follows the `ActionState` pattern from the home profile, and is disabled offline.
- **Offline:** add `/plan` and `/schedule` to the service worker's document routes and refresh their cached copies with `OfflineCacheWarmer`, as for the task pages.

### Tasks

- [x] T1: Date helpers and the pure scheduler, with defaults and limits. Files: `src/lib/scheduler/dates.ts`, `src/lib/scheduler/dates.test.ts`, `src/lib/scheduler/settings.ts`, `src/lib/scheduler/schedule.ts`, `src/lib/scheduler/schedule.test.ts`. Covers: AC3, AC4, AC5, AC6 (determinism).
- [x] T2: Load summary. Files: `src/lib/scheduler/load.ts`, `src/lib/scheduler/load.test.ts`. Covers: AC4, AC5.
- [ ] T3: Schema and migration for `schedule_settings` and `occurrence`, plus ADR 0007. Files: `src/db/schema/schedule.ts`, `src/db/schema/index.ts`, `drizzle/0003_*.sql`, `docs/decisions/0007-persisted-plan-and-replanning.md`. Covers: AC1, AC6.
- [ ] T4: Replanning service: deciding the start date, then replanning and extending the horizon. Files: `src/lib/scheduler/plan.ts`, `src/lib/scheduler/replan-start.ts`, `src/lib/scheduler/replan-start.test.ts`. Covers: AC6.
- [ ] T5: Settings validation, action, form, and page. Task and settings mutations replan. Files: `src/lib/scheduler/schemas.ts`, `src/lib/scheduler/schemas.test.ts`, `src/app/(app)/schedule/actions.ts`, `src/app/(app)/schedule/page.tsx`, `src/components/plan/schedule-form.tsx`, `src/components/plan/schedule-form.test.tsx`, `src/app/(app)/tasks/actions.ts`. Covers: AC1, AC6.
- [ ] T6: Plan page, with day cards, load summary, empty states, and links. The header link, plus "See your week" on the task list. Files: `src/app/(app)/plan/page.tsx`, `src/components/plan/plan-day.tsx`, `src/components/plan/load-notice.tsx`, `src/lib/scheduler/queries.ts`, `src/lib/scheduler/format.ts`, `src/lib/scheduler/format.test.ts`, `src/components/app-shell.tsx`, `src/components/tasks/task-list.tsx`. Covers: AC2, AC5, AC8.
- [ ] T7: Offline: service worker routes, cache warmer, and disabled settings. Files: `src/app/sw.ts`, `src/components/plan/plan-cache-warmer.tsx`, `docs/decisions/0005-offline-inventory-reading.md`. Covers: AC7.
- [ ] T8: E2E and docs. Files: `e2e/plan.spec.ts`, `e2e/plan-offline.spec.ts`, `e2e/support/plan.ts`, `docs/ARCHITECTURE.md`. Covers: AC1 to AC8.

### Test plan

- **Unit (scheduler):** simulations over 120 days with generated task sets.
  - Budgets are never exceeded, and days off stay empty (AC3).
  - Each task's first session falls within its frequency, and the gaps between sessions stay within the bounds, including around days off (AC4).
  - Under overload, the most overdue ratio goes first and every task appears within twice its frequency (AC5).
  - The same input gives the same output (AC6).
- **Unit (other):**
  - The replan start date, before and after today's start time, across time zones (AC6).
  - Settings validation: ranges, time format, at least one day on (AC1).
  - The settings form's field errors and the offline state (AC1, AC7).
  - The load summary and the formatters (AC2, AC5).
- **E2E:**
  - Saving the settings, then seeing 7 days with "Today", totals within budget, a day off, and routines apart (AC1, AC2, AC3).
  - Editing a task replans the future (AC6).
  - The overload notice with a tight budget (AC5).
  - The empty states (AC2).
  - Offline reading with the settings disabled (AC7).
  - Keyboard only and dark mode at both viewports (AC8).
