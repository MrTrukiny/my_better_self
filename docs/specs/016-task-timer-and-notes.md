# 016: Task timer and notes

- **Status**: In progress
- **Owner**: @mrtrukiny
- **Created**: 2026-10-28

## Goal

Spec 009 lets the owner type how long a done task took, and spec 011 turns those times into estimates. Typing a number after the fact is a guess, though, and a bare number doesn't say why a task ran long. This spec adds a timer to each of today's cleaning tasks, so the time is measured instead of remembered, and a short note on done tasks ("Took longer: full deep clean"). The measured time stays editable for when the timer was left running. Notes are stored for [spec 017](017-ai-time-and-task-adjustments.md), where the AI uses times and notes to suggest better tasks. See "Time calibration" in [`ROADMAP.md`](../ROADMAP.md#phase-2-smarter-routine).

## User stories

- As the owner, I want to start a timer when I begin a task and stop it when I finish, so that the app records exactly how long it took.
- As the owner, I want to pause the timer when I'm interrupted, so that breaks don't count.
- As the owner, I want to correct the time when I forgot to stop the timer, so that one mistake doesn't skew my estimates.
- As the owner, I want to add a short note about why a task took longer or shorter, so that the app and I can understand the difference later.

## Acceptance criteria

Each criterion is testable and maps to at least one test.

- [ ] AC1: Given a cleaning task of today is not done or skipped, then its row has a "Start" button. When I start it, then the row shows the running time (mm:ss) with "Pause" and "Stop" buttons, and the other rows' "Start" stays available. Routines have no timer.
- [ ] AC2: Given a timer is running, when I start another task's timer, then the first one pauses and keeps its time. Only one timer runs at a time.
- [ ] AC3: Given a timer is running, when I pause it, then the time stops and "Resume" continues from it. Paused time doesn't count.
- [ ] AC4: When I stop a timer, then the task is checked off as done and its "Took" time is the measured time rounded to whole minutes (at least 1, at most 240), as if I had typed it (spec 009). Given it ran longer than 240 minutes, then it is saved as 240 and the row says "Timer capped at 240 min. Correct it if needed."
- [ ] AC5: Given a done task, then I can still change or clear its "Took" time as in spec 009, whether it came from the timer or not. Given I uncheck a task, then its time and its timer are cleared.
- [ ] AC6: Given a done cleaning task, then I can add a note of up to 200 characters ("Add note"), change it, or clear it. The note shows under the task in Today and in earlier days. Over 200 characters shows a field message and isn't saved. Unchecking a task removes its note with its time.
- [ ] AC7: Given a timer is running or paused, when I reload, close the app, lock the phone, or lose the connection, then the timer keeps its state and the running one keeps counting from when it was started. Given I'm offline, then stopping a timer and saving a note work like other check-offs: "Saved on this device", sent when the connection is back (specs 006 and 009). Given the day changes while a timer runs, then the timer stays on the task of the day it was started.
- [ ] AC8: The timer and note controls work at 360px and on desktop, in light and dark mode, and with the keyboard only. Buttons have accessible names with the task ("Start timer for Clean the kitchen window"), the running time isn't announced every second but starting, pausing, and stopping are, and touch targets are at least 44px.

## UX notes

- **Row:** the timer sits on the right of the row, next to the estimate. Running: the elapsed time in tabular figures and "Pause" and "Stop" icon buttons; paused: the frozen time with "Resume" and "Stop". A running row is highlighted so it's easy to find on a long list.
- **Today header:** while a timer runs, the progress area shows it ("Timing: Clean the kitchen window, 04:12") with a link that scrolls to the row.
- **Note:** under the "Took" field of a done task, "Add note" opens a one-line text field; saved on blur or Enter, like "Took". A saved note shows in muted text with an edit button.
- Earlier days (spec 013) show and edit notes the same way, but have no timer.

## Out of scope

- Timers for routines, skipped tasks, or past days.
- A timer for the whole session, or several timers running at once.
- Sharing a running timer between devices: it lives on the device it was started on.
- Notifications while a timer runs (spec 012 covers reminders only).
- What the AI does with notes: [spec 017](017-ai-time-and-task-adjustments.md).

## Open questions

- None. Decided with the owner: one timer at a time with pause and resume, stopping checks the task off, and the time stays editable.

---

## Technical plan

### Approach

- **Notes (data):** a nullable `occurrence.note` (text, at most 200 characters, checked in the database; migration `0009`). `setOccurrenceStatus` takes an optional `note` with the same keep, set, or clear meaning as `actualMinutes`; a blank note clears it, and any status other than `done` clears both. Notes are only for cleaning tasks. Today's and earlier days' queries return it on `TodayTask`.
- **Queue:** a queued change gains an optional `note`. Since one entry per occurrence still holds, a new `done` change for an occurrence whose queued entry is also `done` now merges into it (fields it leaves out keep the queued values), so saving a note offline doesn't drop a time queued before it. Amends [ADR 0008](../decisions/0008-check-off-and-offline-queue.md).
- **Timer (device only):** pure functions in `src/lib/today/timers.ts` over a map of occurrence id to `{ date, elapsedMs, startedAt }`: start (pauses any other running timer), pause, elapsed time, and stop, which returns whole minutes (at least 1, capped at 240, with a `capped` flag). The map lives in `localStorage` (`mbs:timer:<userId>`), so it survives reloads, closing the app, and going offline; a running timer's time is computed from `startedAt`, so it keeps counting while the app is closed. `useTimers` reads it with `useSyncExternalStore`, follows other tabs and mounted pages through the `storage` event and a same-tab event, and ticks once a second only while one runs. Timers are keyed by occurrence, so a timer started yesterday stays on yesterday's task.
- **UI (client leaves):** `TaskRow` gets optional timer props from `TodaySession` only: "Start" on open cleaning tasks, and the elapsed time with "Pause" or "Resume" and "Stop" while timing. Stopping calls the same `update` as checking with the measured minutes; a capped time shows the notice on the row. Unchecking or skipping clears the timer. A banner in the progress area names the active timer and links to its row; one left on an earlier day offers "Stop" (saved through the queue, which accepts the 7 days before today) and "Discard". A polite live region announces start, pause, resume, and stop, never the ticking time. `NoteField` under "Took" ("Add note", one line, saved on blur or Enter, 200 characters, field message beyond) works in Today and Earlier days.
- No new dependencies, no caching changes: Today and Earlier days are read uncached after `io()`.

### Tasks

- [x] T1: Note column, check-off input, action, queries, and queue merge. Files: `src/db/schema/schedule.ts`, `drizzle/0009_*.sql`, `src/lib/today/{schemas,queue,progress,queries}.ts` (+ tests), `src/app/(app)/actions.ts`, `src/components/today/{use-check-offs,use-check-off-queue}.ts`, `docs/decisions/0008-check-off-and-offline-queue.md`. Covers: AC5, AC6, AC7.
- [x] T2: Timer rules and storage hook. Files: `src/lib/today/timers.ts`, `timers.test.ts`, `src/components/today/use-timers.ts`. Covers: AC2, AC3, AC4, AC7.
- [ ] T3: Timer controls, banner, announcements, and clearing on uncheck or skip. Files: `src/components/today/{timer-controls,timer-banner,task-row,today-session}.tsx`, `today-session.test.tsx`. Covers: AC1, AC2, AC3, AC4, AC5, AC7, AC8.
- [ ] T4: Note field in Today and Earlier days. Files: `src/components/today/{note-field,task-row,earlier-days,today-session}.tsx` (+ tests). Covers: AC6, AC8.
- [ ] T5: E2E and docs. Files: `e2e/timer-notes.spec.ts`, `docs/ARCHITECTURE.md`. Covers: AC1 to AC8.

### Test plan

- Unit: timer start, pause, resume, single running timer, rounding, minimum, cap (AC2, AC3, AC4); note validation and the check-off decision for notes (AC6); queue merge keeps a queued time when a note follows (AC7); row and session behavior with fake timers: start, pause, stop checks off with minutes, capped notice, uncheck clears, announcements, accessible names (AC1 to AC5, AC8); note add, edit, clear, too long (AC6).
- E2E: start, pause, resume, and stop a task with the clock controlled, the time lands in "Took" and stays editable; a timer survives a reload; a note is saved, shown after reload, and shown in Earlier days; offline stop and note sync when back; 360px dark mode with the keyboard and no console errors (AC1 to AC8).
