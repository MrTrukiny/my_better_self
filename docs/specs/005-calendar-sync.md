# 005: Google Calendar sync

- **Status**: Draft
- **Owner**: @mrtrukiny
- **Created**: 2026-10-26

## Goal

Put each day's cleaning session in Google Calendar, where the owner already manages their time, so the routine shows up next to everything else without opening the app. The app creates its own "Cleaning" calendar, adds one event per cleaning day at that day's start time with the task checklist, keeps the events in step with the plan, and warns when a session overlaps something else in the owner's calendars. A daily job keeps the calendar current without the owner being present, which also makes this the spec that puts the app in production on Vercel. See "Google Calendar sync" in [`PRODUCT.md`](../PRODUCT.md#mvp-phase-1) and [ADR 0002](../decisions/0002-google-calendar.md).

## User stories

- As the owner, I want my cleaning sessions in my Google Calendar, so that I see them next to my other plans and get the calendar's reminders.
- As the owner, I want the app to use its own calendar, so that I can hide, recolor, or remove all cleaning events at once, and the app never touches my other events.
- As the owner, I want the calendar to follow the plan when I change tasks or my schedule, so that it never shows a stale or duplicated session.
- As the owner, I want to know when a session overlaps another event, so that I can move my start time for that day.
- As the owner, I want to disconnect the calendar at any time, so that I stay in control of what the app can do with my account.

## Acceptance criteria

Each criterion is testable and maps to at least one test.

- [ ] AC1: Given I'm signed in and my calendar isn't connected, when I choose "Connect Google Calendar" on the schedule page and accept Google's consent screen, then I'm back on the schedule page and it shows the calendar as connected, with the calendar's name. The app asks only to manage calendars it creates and to read free/busy times. Given I cancel or deny consent, then I'm back on the schedule page with a message, and nothing is connected.
- [ ] AC2: Given my calendar is connected, then the app has created one secondary calendar named "Cleaning" in my time zone (once; if I delete it in Google, the next sync creates it again). Each day of the plan that has cleaning tasks gets one event in it:
  - Title "Cleaning, 38 min" (the day's total cleaning minutes).
  - Start at that day's start time, end after the total minutes, in my time zone.
  - Description: the cleaning tasks with their minutes and what each belongs to, then the day's routines under "Also today", then a link to the app.
  - Days that are off or have no cleaning tasks get no event.
- [ ] AC3: Given my calendar is connected, when the plan changes (I add, edit, or delete tasks, delete rooms or items, or change the schedule), then within that action the events of the changed days are updated in place, created, or deleted to match the plan. There is never more than one event per day. Events of past days are not changed.
- [ ] AC4: Given a day's session overlaps a busy time in any of my calendars (other than "Cleaning"), then that day on the plan says "Overlaps another event in your calendar" with the session's time, and the event is still placed at the start time. The app reads only busy times, never the details of other events. When the overlap goes away, so does the notice.
- [ ] AC5: Given the app is deployed, then once a day a scheduled job extends every connected owner's plan to the next 7 days and syncs their calendar, without the owner being present. The job's endpoint rejects any caller without the job secret, and one owner's failure doesn't stop the others.
- [ ] AC6: Given my calendar is connected, when I choose "Disconnect" and confirm, then the "Cleaning" calendar and its events are deleted from my Google account, the app's access is revoked, and the schedule page shows "Connect Google Calendar" again. The plan keeps working without a calendar.
- [ ] AC7: Given Google rejects a sync (for example I revoked access from my Google account, or Google is down), then saving tasks or settings still succeeds, the plan still works, and the schedule and plan pages show "We couldn't update your calendar" with a "Reconnect" action when access was lost. The next successful sync brings the calendar up to date.
- [ ] AC8: The calendar section works at 360px and on desktop, in light and dark mode, and with the keyboard only; every control has an accessible name and status messages are announced. Offline, the connection status stays readable and "Connect", "Disconnect", and "Reconnect" are disabled with the usual offline notice.

## UX notes

- **Where:** a "Google Calendar" section at the end of the schedule page, under the budgets. Not connected: a short explanation ("Adds each day's session to a Cleaning calendar in your Google account. The app only manages that calendar and checks when you're busy.") and the "Connect Google Calendar" button. Connected: "Connected: Cleaning" with the Google account's email and a "Disconnect" button.
- **Consent:** connecting asks for the extra permissions on top of the sign-in, so signing in stays as simple as it is today. Google shows an "unverified app" warning for these permissions while the app is for personal use; the button's explanation says so.
- **Overlaps:** a small warning line on the affected day card, not a blocking dialog. The fix is changing that day's start time on the schedule page, which the line links to.
- **Event description:** plain text that reads well in Google Calendar on the phone: one line per task ("Kitchen surface clean (Kitchen), 10 min"), then "Also today: Make the bed, Take out the trash", then "Open My Better Self: <link to the plan>".
- **Disconnect:** a confirmation dialog that says the Cleaning calendar and its events will be deleted from Google Calendar.
- **Errors:** the sync-error line appears on the schedule page's calendar section and above the plan's days; it disappears after the next successful sync.

## Out of scope

- Choosing a free slot automatically or a scheduling window (later version; mornings first).
- Reading event details from other calendars, or writing to them.
- Changing the session from Google Calendar (moving or deleting an event there doesn't change the plan; the next sync puts it back).
- Updating events when tasks are checked off (spec 006 can add it).
- Calendar providers other than Google, and push notifications.
- Choosing the calendar's name or color in the app (the owner can change them in Google Calendar).

## Open questions

- None. Decided with the owner: sessions go at each day's start time with an overlap warning (free/busy read), permissions are requested from a "Connect Google Calendar" button, and this spec includes deploying to Vercel with the daily job.

## Owner actions (outside the code)

- Create the Vercel project and set the production environment variables (database, auth, Google, AI key, job secret).
- In Google Cloud: enable the Calendar API, add the production redirect URI, add the two calendar scopes to the consent screen, and set the consent screen to "In production" (unverified is fine for personal use), since refresh tokens expire after 7 days in "Testing".
- Run `pnpm db:migrate` against the production database.

---

## Technical plan

_Filled in by the `plan-feature` skill after the spec is approved._

### Approach

### Tasks

### Test plan
