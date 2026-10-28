# 013: Check off past days

- **Status**: Done
- **Owner**: @mrtrukiny
- **Created**: 2026-10-28

## Goal

Check-offs only work for today (spec 006). When the owner cleans but forgets to check it in the app, the day counts as missed: the streak breaks and the scheduler plans the tasks again as if they weren't done. This spec lets the owner catch up on the last 7 days, so the history, the streak, and the plan reflect what really happened. It resolves the follow-up listed in spec 006's out-of-scope section.

## User stories

- As the owner, I want to check off tasks I did on an earlier day, so my streak and plan stay right.
- As the owner, I want to see which recent days I left unchecked, so I know what to catch up on.

## Acceptance criteria

- [x] AC1: Given I'm on Today, then a link "Earlier days" opens the last 7 days before today, each with its date, its cleaning tasks, and how many are done ("2 of 5 done").
- [x] AC2: Given a past day within the last 7 days, then I can check, uncheck, or skip its cleaning tasks and check its routines, and record or change the minutes a done task took (spec 009), the same way as on Today. Older days are read-only.
- [x] AC3: Given I complete a past day, then the streak counts it, as if I had checked it on that day.
- [x] AC4: Given I mark a past task done or skipped, then its last completion is that day, and the plan is rebuilt from the next replannable day, so the task isn't planned again too soon. Given I uncheck it, then the plan is rebuilt the same way.
- [x] AC5: Changing a past day never changes its Google Calendar event.
- [x] AC6: Given I'm offline, then changes on past days are kept on the device and sent when the connection returns, as on Today. Given a queued change is for a day that has meanwhile become older than 7 days, it is dropped with a notice.
- [x] AC7: Given there are no past days with tasks (a new owner, or only days off), then the page says so.
- [x] AC8: The page works at 360px and on desktop, in light and dark mode, and with the keyboard only; each day is a labeled section and each control has an accessible name that includes the task and the date.

## UX notes

- Days are listed newest first, each as a collapsible section that starts open when the day has unchecked tasks.
- A day shows its tasks in the session order of spec 009, without time slots (they are in the past).
- Days off show "Day off" and have no controls.
- The link on Today shows how many recent days have unchecked tasks ("Earlier days · 2 unchecked").

## Out of scope

- Days older than 7 days.
- Adding a task to a past day that wasn't planned for it.
- Changing future days early.
- Rewriting past calendar events to show what was done.

## Open questions

- None. Decided with the owner: the last 7 days can be changed.

---

## Technical plan

### Approach

- **Rule (pure):** `checkOffDecision` accepts occurrences from today back `EDITABLE_PAST_DAYS` (7) days; older or future ones stay `past`. `isEditableDay(date, today)` is shared by the server and the client.
- **Action:** `setOccurrenceStatus` keeps its input. When the occurrence is before today, it calls `replanAfterChange` after the update, so the scheduler's history (`lastCompletions`, built from past occurrences) moves the task's next date; today's changes still don't replan (ADR 0008). Replans only touch days from `replanStart` on, so past calendar events stay as they are.
- **Reads:** `getEarlierDays(settings, now)` in `src/lib/today/queries.ts` returns the last 7 days that have occurrences, newest first, each with its start time and its tasks in `sessionOrder` (routines after). The Today page counts unchecked recent days from the streak history it already reads.
- **UI:** a new page `/earlier-days` (Server Component shell, uncached after `io()`) renders `EarlierDays`, a client leaf with one `details` section per day and `TaskRow`s without slots. The queue and the overlay of queued and local changes move out of `TodaySession` into a shared hook, `useCheckOffs`, used by both pages. `TaskRow` takes an optional `context` (the day) appended to the accessible names.
- **Navigation:** Today's destination includes `/earlier-days`.
- **Offline:** `/earlier-days` joins the offline document routes and is warmed with Today. A queued change for a day that left the window is refused as `past` and dropped with a notice, like today's.
- No new data, dependencies, or ADR; ADR 0008 gets an amendment.

### Tasks

- [x] T1: Editable window: `EDITABLE_PAST_DAYS`, `isEditableDay`, and `checkOffDecision` accepting the last 7 days. Files: `src/lib/today/schemas.ts`, `src/lib/today/schemas.test.ts`. Covers: AC2.
- [x] T2: Replan after a past change. Files: `src/app/(app)/actions.ts`. Covers: AC3, AC4, AC5.
- [x] T3: Earlier days data: `getEarlierDays` and `uncheckedDays`. Files: `src/lib/today/queries.ts`, `src/lib/today/earlier.ts`, `src/lib/today/earlier.test.ts`. Covers: AC1, AC7.
- [x] T4: Shared check-off hook, extracted from `TodaySession`, and `TaskRow` context. Files: `src/components/today/use-check-offs.ts`, `src/components/today/today-session.tsx`, `src/components/today/task-row.tsx`. Covers: AC2, AC6.
- [x] T5: Earlier days page and Today's link. Files: `src/app/(app)/earlier-days/page.tsx`, `src/components/today/earlier-days.tsx`, `src/components/today/earlier-days.test.tsx`, `src/app/(app)/page.tsx`, `src/lib/navigation.ts`, `src/app/sw.ts`. Covers: AC1, AC2, AC6, AC7, AC8.
- [x] T6: E2E and docs. Files: `e2e/earlier-days.spec.ts`, `docs/decisions/0008-check-off-and-offline-queue.md`, `docs/ARCHITECTURE.md`, `docs/specs/006-today-view.md`. Covers: AC1–AC8.

### Test plan

- Unit: the window (today, 7 days back, 8 days back, future) and the decision (AC2); unchecked-day counting and newest-first ordering (AC1, AC7); `EarlierDays` sections, progress text, day-off and read-only states, and accessible names with the date (AC1, AC2, AC8).
- E2E: an owner with yesterday's session planned (seeded through the test database) checks it off from "Earlier days", sees the streak count it and the task leave tomorrow's plan (AC1–AC4); the calendar fake keeps yesterday's event unchanged (AC5); a change made offline syncs on reconnect (AC6); a new owner sees the empty state (AC7); keyboard at 360px in dark mode without console errors (AC8).
