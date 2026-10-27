# 007: Fixed-length sessions and calendar resync

- **Status**: In progress
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

### Approach

- **The session window becomes start plus budget, in one place.** `buildWeek` (`src/lib/scheduler/format.ts`) computes `PlanDayView.end` as `start + budget` instead of `start + total`. `total` keeps meaning the planned minutes. `PlanDay` already renders `{start}–{end} · {total} of {budget} min` and uses `{start}–{end}` in the overlap line, so the plan follows without changing its layout. Today gets a `budget` prop (`budgetFor(settings, today)` in the page) and shows `{start}–{start + budget} · {planned} of {budget} min`. Planned is `progress.totalMinutes`, the session's minutes without skipped tasks, so skipping a task no longer moves the end time.
- **Events follow the same window.** `buildEvent` (`src/lib/calendar/events.ts`) ends at `start + day.budget`, titles the event `Cleaning, {budget} min`, and starts the description with `{total} of {budget} min planned` and a blank line before the task list. The digest already hashes summary, description, start, and end, so a budget change alters every affected day's digest. The next sync then rewrites those days in place: event ids derive from user and date, so a day never gets a second event (AC2). The first sync after deploy rewrites every upcoming day the same way; no migration is needed. `findOverlaps` and `overlapsBusy` read `startsAt` and `endsAt` from the built event, so the overlap check covers the whole block once the event ends at the budget (AC3). `overlap.ts` stays as it is.
- **Forced resync.** `planSync` takes `force?: boolean`. When set, it puts every wanted day in range whatever its digest, and deletes work as they do today. `syncCalendar(userId, { now, force } = {})` replaces the positional `now`; existing callers only pass `userId`, so they don't change. With `force`, `syncDays` starts at today (`zonedNow(...).day`) instead of `replanStart`, which rewrites today's event even after its session started. Past days stay out of range. The per-owner row lock already serializes a forced sync with `after()` syncs and the daily job.
- **Mutation.** A new Server Action, `syncCalendarNow()` in `src/app/(app)/schedule/calendar-actions.ts`, resolves the owner with `getCurrentUser()`, awaits `replan(user.id)`, then awaits `syncCalendar(user.id, { force: true })`. It does not use `after()`, so it can report the result, and calls `refresh()` like `disconnectCalendar`. If the replan throws, it returns `{ status: "error", formError }` and skips the sync. If the sync fails, Google's failure is already stored as the connection status (`reauth` or `error`), so the refreshed section shows the existing `CalendarSyncNotice` with "Reconnect" when needed (AC6). The replan is committed before the sync, so the plan keeps it. A `skipped` result (connection gone meanwhile) counts as an error. `replan` keeps its existing rule (ADRs 0007 and 0008): it replans from today, or from tomorrow once today's session has started, so the owner's checked tasks don't move.
- **Last synced.** `getCalendarConnection` adds `lastSyncedAt: Date | null` to `CalendarConnectionView`. A pure `lastSyncedLine(lastSyncedAt, now)` in `src/lib/calendar/format.ts` returns "Last synced just now", "Last synced 10 minutes ago", "… 3 hours ago", "… 2 days ago", or "Not synced yet". `CalendarSection` stays a Server Component and takes `now`. `CalendarArea` on the schedule page passes `new Date()` after its uncached reads (behind the existing Suspense boundary, `io()` first per Cache Components). The text is therefore computed on the server, which avoids hydration mismatches. An offline copy shows the time as of caching, which is acceptable.
- **Client leaf.** `SyncNowButton` (`"use client"`) owns the "Sync now" button and the last-synced status line, so the "Synced just now" success text lives in client state until the next visit. It uses `useTransition` for the busy state ("Syncing…", disabled, `LoaderCircle`) and `useEditsDisabled()` to disable it offline, like `DisconnectButton`. The line is a `role="status"` paragraph and the replan error renders through `FormError`, so both get announced. The section renders it next to `DisconnectButton` in a wrapping button row (`flex flex-wrap gap-2`, `h-11` buttons) that fits 360px.
- **Offline.** No new cached data. The button is disabled offline with the page's existing `EditNotice`. With `experimental.useOffline`, actions would otherwise be held and replayed, and spec 005 says nothing is queued.
- **No ADR needed.** The changes are behavior changes within ADR 0002's design (one event per day, derived ids, digests), so they get amendments, not a new ADR (T8).

### Tasks

- [x] T1: Session window is start plus budget in the plan view model; plan cards and overlap line show it. Files: `src/lib/scheduler/format.ts`, `src/lib/scheduler/format.test.ts`, `src/components/plan/plan-day.test.tsx`. Covers: AC4, AC3 (overlap line text).
- [x] T2: Events last the budget: end at `start + budget`, title with the budget, description opens with "{total} of {budget} min planned". Add overlap cases where only the time after the planned tasks overlaps. Files: `src/lib/calendar/events.ts`, `src/lib/calendar/events.test.ts`, `src/lib/calendar/overlap.test.ts`. Covers: AC1, AC2, AC3.
- [x] T3: Forced resync: `planSync({ force })` puts every in-range day. `syncCalendar(userId, { now, force })` syncs from today when forced, and callers keep compiling. Files: `src/lib/calendar/diff.ts`, `src/lib/calendar/diff.test.ts`, `src/lib/calendar/sync.ts`. Covers: AC5.
- [x] T4: Last-synced data and text: `lastSyncedAt` on `CalendarConnectionView`, plus a pure `lastSyncedLine`. Files: `src/lib/calendar/queries.ts`, `src/lib/calendar/format.ts` (new), `src/lib/calendar/format.test.ts` (new). Covers: AC7.
- [x] T5: `syncCalendarNow` Server Action: `getCurrentUser()`, then `replan`, then a forced and awaited sync, then `refresh()`. It returns `ActionState` and returns an error when the replan fails or the sync isn't `ok`. Files: `src/app/(app)/schedule/calendar-actions.ts`. Covers: AC5, AC6.
- [x] T6: "Sync now" UI: a `SyncNowButton` client component with busy and offline-disabled states, a "Synced just now" or last-synced status line, and a refresh icon. Wire it into `CalendarSection` next to "Disconnect", and pass `syncCalendarNow` and `now` from the schedule page. Update section tests and the e2e `connectCalendar` helper so `getByRole("status")` queries filter by text, because the section gains a second status region. Files: `src/components/calendar/sync-now-button.tsx` (new), `src/components/calendar/calendar-section.tsx`, `src/components/calendar/calendar-section.test.tsx`, `src/app/(app)/schedule/page.tsx`, `e2e/support/calendar.ts`, `e2e/calendar.spec.ts` (status selectors only). Covers: AC5, AC6, AC7.
- [x] T7: Today shows the fixed window and planned minutes: a `budget` prop on `TodaySession`, and the header reads "06:30–07:15 · 38 of 45 min". Files: `src/components/today/today-session.tsx`, `src/components/today/today-session.test.tsx`, `src/app/(app)/page.tsx`. Covers: AC4.
- [ ] T8: Doc amendments, done in this branch, not edited during planning:
  - ADR 0002: the event lasts the day's budget, titled with the budget, and the description opens with the planned minutes. "Sync now" forces a rewrite that ignores digests.
  - `docs/ARCHITECTURE.md`: the Sync row and the idempotency bullet mention the forced resync and the budget-long event. The Calendar section mentions last synced and "Sync now".
  - Spec 005: AC1 bullets get a note superseded by 007.
  - Spec 004: AC2's end-time wording gets a note superseded by 007.
  - Spec 006: AC1's session end-time wording gets a note superseded by 007.

  Files: `docs/decisions/0002-google-calendar.md`, `docs/ARCHITECTURE.md`, `docs/specs/004-scheduler.md`, `docs/specs/005-calendar-sync.md`, `docs/specs/006-today-view.md`. Covers: none; keeps docs consistent with AC1, AC3, AC4, AC5.
- [ ] T9: E2E for the new flows with `CALENDAR_FAKE=1`:
  - The plan and Today show `06:30–07:15 · N of 45 min` with the default budget.
  - After changing the weekday budget to 60, the plan shows the new end time and the calendar status stays "Connected" with no failure notice.
  - "Sync now" from the keyboard at 360px in dark mode: it shows "Syncing…" and is disabled while running, then shows "Synced just now". After a reload it shows "Last synced …". No console errors.
  - The offline test also checks that "Sync now" is disabled.

  Files: `e2e/calendar.spec.ts`, `e2e/today.spec.ts`. Covers: AC1, AC2, AC4, AC5, AC7.

### Test plan

- **Unit (Vitest)**:
  - AC1: `events.test.ts` checks that `buildEvent` ends at start plus budget whatever the total, the title reads "Cleaning, 45 min" and uses the weekend budget on weekends, the description's first line is "38 of 45 min planned" followed by the tasks and routines, and days off or with no cleaning get `null`.
  - AC2:
    - `events.test.ts`: a different budget gives a different digest with the same event id.
    - `diff.test.ts`: a changed digest is put in place, and a day never gets two events (existing cases kept).
  - AC3:
    - `overlap.test.ts` and `events.test.ts`: a busy time that only overlaps after `start + total` but before `start + budget` counts as an overlap.
    - `plan-day.test.tsx`: the overlap line shows the budget window.
  - AC4:
    - `format.test.ts`: `end` is start plus budget, and `total` stays the planned minutes.
    - `plan-day.test.tsx`: the plan card shows "06:30–07:15 · 38 of 45 min".
    - `today-session.test.tsx`: Today shows "07:00–07:45 · 38 of 45 min", and skipping a task keeps the end time.
  - AC5:
    - `diff.test.ts`: `force` puts unchanged days, still deletes days that lost their cleaning, and leaves days before `from` alone.
    - `calendar-section.test.tsx`: "Sync now" calls the action once, shows "Syncing…" and is disabled while pending, and shows "Synced just now" on success.
  - AC6: `calendar-section.test.tsx` checks that a failed action doesn't show "Synced just now", that a replan error shows the form error, and that `reauth` or `error` status shows "We couldn't update your calendar" with or without "Reconnect" (existing notice cases kept).
  - AC7:
    - `format.test.ts` (calendar): `lastSyncedLine` returns "just now", minutes, hours, days, and "Not synced yet".
    - `calendar-section.test.tsx`: the section shows the last-synced line, and "Sync now" is disabled offline.
- **E2E (Playwright, `CALENDAR_FAKE=1`, desktop and mobile)**:
  - `calendar.spec.ts` covers AC1 and AC4 (the plan shows the budget window), AC2 (a budget change updates the window with no failure notice), AC5 and AC7 ("Sync now" with the keyboard at 360px in dark mode: busy state, "Synced just now", last-synced line after reload, disabled offline, no console errors).
  - `today.spec.ts` covers AC4 on Today.
  - Event length and the forced rewrite of unchanged days can't be seen from the browser, because the fake's store lives in the server process. Unit tests on `buildEvent` and `planSync` cover them.
  - AC6 has no e2e test: the fake can't make Google reject a call without a test-only failure hook, which this spec doesn't call for. It is covered by unit tests of the section and the existing notice.
