# 007: Fixed-length sessions and calendar resync

- **Status**: Draft
- **Owner**: @mrtrukiny
- **Created**: 2026-10-27

## Goal

Make the daily cleaning session a fixed block of time, so the owner can protect the same slot every day instead of an event whose length changes with the tasks planned. Each session lasts the day's cleaning budget (the weekday or weekend minutes on the schedule page), in Google Calendar and in the app. Add a "Sync now" action that replans and rewrites the calendar, so the owner can apply changes on demand instead of waiting for the next edit or the daily job. Builds on spec 004 (budgets) and spec 005 (calendar sync); see "Google Calendar sync" in [`PRODUCT.md`](../PRODUCT.md#mvp-phase-1).

## User stories

- As the owner, I want every cleaning session to take the same block of time, so that I can plan my day around it.
- As the owner, I want to sync my calendar on demand, so that I see changes applied right away and can fix a calendar that looks out of date.

## Acceptance criteria

Each criterion is testable and maps to at least one test.

- [ ] AC1: Given my calendar is connected and a day has cleaning tasks, then that day's event starts at the day's start time and lasts the day's budget (weekday or weekend minutes), whatever the tasks add up to. The title reads "Cleaning, 45 min" with the budget. The description starts with the planned minutes ("38 of 45 min planned"), then lists the tasks and routines as today. Days that are off or have no cleaning tasks still get no event.
- [ ] AC2: Given I change a budget on the schedule page, when I save, then the events of the coming days change length to match, and no day gets a second event.
- [ ] AC3: Given a day's session (start time plus budget) overlaps a busy time in my other calendars, then the plan shows the overlap warning for that day; given only the time after the planned tasks would overlap, the warning still shows, since the whole block is booked.
- [ ] AC4: Given I open the plan or Today, then each day shows its session as start to start plus budget ("06:30–07:15"), followed by the planned minutes ("38 of 45 min").
- [ ] AC5: Given my calendar is connected, when I choose "Sync now" in the calendar section of the schedule page, then the app replans from today, rewrites every event from today through the next 7 days (even those that look unchanged), deletes events of days that no longer have cleaning, and shows "Synced just now". The button shows a busy state and can't be triggered twice. Events of past days are not changed.
- [ ] AC6: Given Google rejects "Sync now", then the calendar section shows "We couldn't update your calendar" as with any other sync, with "Reconnect" when access was lost, and the plan keeps the replan.
- [ ] AC7: The calendar section shows when the calendar last synced ("Last synced 10 minutes ago"). "Sync now" works at 360px and on desktop, in light and dark mode, and with the keyboard; its result is announced to screen readers. Offline, it is disabled with the usual offline notice.

## UX notes

- "Sync now" sits next to "Disconnect" in the connected state, as a secondary button with a refresh icon; while running it reads "Syncing…".
- The success line ("Synced just now") replaces the last-synced line and fades back to the relative time on the next visit; it is a status message, not a toast.
- The session time on plan and Today cards keeps today's layout; only the end time and the minutes text change.

## Out of scope

- Choosing a session length other than the budget, or a different length per day beyond weekday and weekend.
- Moving the session to a free slot automatically.
- Syncing from Google Calendar back into the app.
- A resync of days before today.

## Open questions

- None. Decided with the owner: the session lasts the day's budget, and "Sync now" replans before rewriting every event.

---

## Technical plan

_Filled in by the `plan-feature` skill after the spec is approved._
