# 005: Google Calendar sync

- **Status**: Done
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

- [x] AC1: Given I'm signed in and my calendar isn't connected, when I choose "Connect Google Calendar" on the schedule page and accept Google's consent screen, then I'm back on the schedule page and it shows the calendar as connected, with the calendar's name. The app asks only to manage calendars it creates, to see the list of my calendars, and to read their free/busy times. Given I cancel or deny consent, then I'm back on the schedule page with a message, and nothing is connected.
- [x] AC2: Given my calendar is connected, then the app has created one secondary calendar named "Cleaning" in my time zone (once; if I delete it in Google, the next sync creates it again). Each day of the plan that has cleaning tasks gets one event in it:
  - Title "Cleaning, 38 min" (the day's total cleaning minutes).
  - Start at that day's start time, end after the total minutes, in my time zone.
  - Description: the cleaning tasks with their minutes and what each belongs to, then the day's routines under "Also today", then a link to the app.
  - Days that are off or have no cleaning tasks get no event.
- [x] AC3: Given my calendar is connected, when the plan changes (I add, edit, or delete tasks, delete rooms or items, or change the schedule), then within that action the events of the changed days are updated in place, created, or deleted to match the plan. There is never more than one event per day. Events of past days are not changed.
- [x] AC4: Given a day's session overlaps a busy time in any of my calendars (other than "Cleaning"), then that day on the plan says "Overlaps another event in your calendar" with the session's time, and the event is still placed at the start time. The app reads only busy times, never the details of other events. When the overlap goes away, so does the notice.
- [x] AC5: Given the app is deployed, then once a day a scheduled job extends every connected owner's plan to the next 7 days and syncs their calendar, without the owner being present. The job's endpoint rejects any caller without the job secret, and one owner's failure doesn't stop the others.
- [x] AC6: Given my calendar is connected, when I choose "Disconnect" and confirm, then the "Cleaning" calendar and its events are deleted from my Google account, the app's access is revoked, and the schedule page shows "Connect Google Calendar" again. The plan keeps working without a calendar.
- [x] AC7: Given Google rejects a sync (for example I revoked access from my Google account, or Google is down), then saving tasks or settings still succeeds, the plan still works, and the schedule and plan pages show "We couldn't update your calendar" with a "Reconnect" action when access was lost. The next successful sync brings the calendar up to date.
- [x] AC8: The calendar section works at 360px and on desktop, in light and dark mode, and with the keyboard only; every control has an accessible name and status messages are announced. Offline, the connection status stays readable and "Connect", "Disconnect", and "Reconnect" are disabled with the usual offline notice.

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
- In Google Cloud: enable the Calendar API, add the production redirect URI, add the three calendar scopes to the consent screen, and set the consent screen to "In production" (unverified is fine for personal use), since refresh tokens expire after 7 days in "Testing".
- Run `pnpm db:migrate` against the production database.

---

## Technical plan

### Approach

- **Consent through Better Auth.** "Connect" calls `authClient.linkSocial` for Google with the three calendar scopes (`calendar.app.created`, `calendar.calendarlist.readonly`, `calendar.freebusy`) and `access_type=offline`, `prompt=consent`, `include_granted_scopes=true`, so the existing Google account row gains a refresh token. Its callback lands on `GET /api/calendar/connected`, which resolves the user, checks the granted scopes, creates the connection, runs a first sync, and redirects to `/schedule?calendar=connected`; a denial comes back as `/schedule?calendar=denied`. Sign-in keeps its current scopes.
- **Tokens**: `auth.api.getAccessToken` returns a fresh access token and refreshes it with the stored refresh token. No token handling of our own.
- **Google client over `fetch`** (no `googleapis` dependency): create and read a calendar, put and delete an event, query free/busy, revoke a token. Errors are classified as `auth` (revoked or expired grant), `gone` (404/410), or `transient`. `CALENDAR_FAKE=1` swaps in an in-memory client for e2e and CI, like `AI_FAKE`, with a fixed busy block so overlaps can be tested.
- **Storage**: `calendar_connection` (one row per user: calendar id, status `ok` or `reauth` or `error`, last sync time) and `calendar_day` (user, date, event id, content digest, overlap flag). Event ids are derived from the user and date (base32hex), so a lost row can't create a duplicate: a put that finds the id gets an update.
- **Sync** (`syncCalendar(userId, now)`) is a pure diff plus I/O: build the desired events from the plan (from `replanStart`, so a started day is left alone, through the seventh day), compare digests with `calendar_day`, put what changed, delete days that lost their cleaning, query free/busy for the range, and save overlap flags. A missing "Cleaning" calendar is recreated and every day is re-put. Failures set the connection status and are logged; they never throw into the caller.
- **When it runs**: after every replan, via `after()` from `next/server`, so saving tasks or settings doesn't wait for Google; on connect; and in the daily job. `replanAfterChange` and the schedule save schedule it.
- **Free/busy reads all the owner's calendars.** `calendar.freebusy` only answers for calendar ids we name, so the sync lists them with `calendar.calendarlist.readonly` (ids and names only, no events) and queries every selected calendar except "Cleaning". Decided with the owner over querying only the primary calendar.
- **Daily job**: `GET /api/cron/daily`, checked against `Authorization: Bearer ${CRON_SECRET}` with a timing-safe compare, scheduled in `vercel.json` (once a day, Hobby plan). For each connected owner, one at a time, it extends the plan and syncs; one owner's failure is logged and the loop goes on.
- **Disconnect** is a Server Action: delete the calendar in Google (ignoring `gone`), revoke the grant, delete the connection and its days. Revoking the grant doesn't sign the owner out; the next "Connect" asks again.
- **UI**: a "Google Calendar" section at the end of `/schedule` (Server Component for status, client leaves for the buttons and the confirmation dialog, reusing `ResponsiveDialog`), the overlap line on `PlanDay`, and a sync-error notice on both pages. Buttons use the existing offline guard.
- **ADR 0002 is amended**: sessions go at the start time and free/busy only flags overlaps; the calendar-list scope is added; consent is incremental through Better Auth; the REST client and derived event ids.
- **Merging with spec 006**: both add a migration and touch `src/lib/scheduler/plan.ts`. Whichever merges second rebases, regenerates its migration with the next number, and calls 006's `ensurePlan` in the daily job instead of `ensureHorizon`.

### Tasks

- [x] T1: ADR 0002 amendment; env vars `CRON_SECRET` (required in production) and `CALENDAR_FAKE`; `.env.example`. Files: `docs/decisions/0002-google-calendar.md`, `src/lib/env.ts`, `src/lib/env.test.ts`, `.env.example`. Covers: AC1, AC4, AC5.
- [x] T2: Schema and migration for `calendar_connection` and `calendar_day`. Files: `src/db/schema/calendar.ts`, `src/db/schema/index.ts`, `drizzle/0004_calendar.sql`, `drizzle/meta/*`. Covers: AC2, AC3, AC7.
- [x] T3: Event content and ids: title, start and end in the owner's time zone, description, digest, base32hex id. Files: `src/lib/calendar/events.ts`, `src/lib/calendar/events.test.ts`. Covers: AC2.
- [x] T4: Google client and fake: calendars, calendar list, events, free/busy, revoke, error classes. Files: `src/lib/calendar/google.ts`, `src/lib/calendar/google.test.ts`, `src/lib/calendar/fake.ts`, `src/lib/calendar/client.ts`. Covers: AC2, AC4, AC6, AC7.
- [x] T5: Sync: pure diff (`planSync`) and overlap detection, then `syncCalendar` with storage and status; scheduled after replans and schedule saves. Files: `src/lib/calendar/diff.ts`, `src/lib/calendar/diff.test.ts`, `src/lib/calendar/overlap.ts`, `src/lib/calendar/overlap.test.ts`, `src/lib/calendar/sync.ts`, `src/lib/scheduler/plan.ts`, `src/app/(app)/schedule/actions.ts`. Covers: AC2, AC3, AC4, AC7.
- [x] T6: Connect and disconnect: Google provider options, `linkSocial` call, the connected route handler, the disconnect action. Files: `src/lib/auth.ts`, `src/app/api/calendar/connected/route.ts`, `src/app/(app)/schedule/calendar-actions.ts`, `src/lib/calendar/queries.ts`. Covers: AC1, AC6.
- [x] T7: UI: calendar section with status, connect, disconnect dialog, denial and error messages; overlap line on plan days; sync-error notice. Files: `src/components/calendar/calendar-section.tsx`, `src/components/calendar/connect-button.tsx`, `src/components/calendar/disconnect-button.tsx`, `src/components/calendar/calendar-section.test.tsx`, `src/components/plan/plan-day.tsx`, `src/app/(app)/schedule/page.tsx`, `src/app/(app)/plan/page.tsx`. Covers: AC1, AC4, AC6, AC7, AC8.
- [x] T8: Daily job: route handler, secret check, per-owner loop, `vercel.json` cron. Files: `src/app/api/cron/daily/route.ts`, `src/lib/calendar/cron-auth.ts`, `src/lib/calendar/cron-auth.test.ts`, `vercel.json`. Covers: AC5.
- [x] T9: E2E with the fake client: connect, status, overlap line, disconnect with confirmation, offline-disabled buttons, unauthorized job call. Files: `e2e/calendar.spec.ts`, `e2e/support/calendar.ts`, `playwright.config.ts`, `.github/workflows/*` (`CALENDAR_FAKE`, `CRON_SECRET`). Covers: AC1, AC4, AC5, AC6, AC8.
- [x] T10: Deployment and docs: production setup guide (Vercel project, env vars, Google Cloud consent and redirect URI, migrations), architecture notes, spec status. Files: `docs/DEPLOYMENT.md`, `docs/ARCHITECTURE.md`, this spec. Covers: AC5.

### Implementation notes

- `src/lib/auth.ts` needed no change: `linkSocial` takes the scopes, and `access_type` and `prompt` go in its `additionalParams`; Google's provider already sends `include_granted_scopes=true`.
- The scope list and checks live in `src/lib/calendar/scopes.ts`, shared by the connect button and the server. Disconnect also clears the refresh token and the calendar scopes from the account row, so a later connect re-checks what Google grants.
- The disconnect confirmation uses `AlertDialog`, like the app's other destructive confirmations, instead of `ResponsiveDialog`.
- Better Auth's `getAccessToken` doesn't say why a refresh failed, so any token failure counts as lost access ("Reconnect").
- Without saved schedule settings the sync waits: the calendar is created in the owner's time zone on the first sync after the schedule is saved.
- `playwright.config.ts` reads an optional `E2E_PORT` (default 3100) so checkouts running side by side don't share a server.

### Test plan

- **Unit (Vitest)**:
  - AC2: `events.test.ts` (title, times across time zones and DST, description layout, stable ids and digests).
  - AC3: `diff.test.ts` (create, update only on digest change, delete days that lost cleaning, past days untouched, never two events per day).
  - AC4: `overlap.test.ts` (busy intervals against sessions, the edges).
  - AC2, AC4, AC6, AC7: `google.test.ts` (requests sent, 401 and `invalid_grant` become `auth`, 404 and 410 become `gone`, put falls back to insert).
  - AC5: `cron-auth.test.ts` (missing, wrong, and right secret).
  - AC1, AC6, AC7, AC8: `calendar-section.test.tsx` (states, accessible names, offline-disabled buttons).
  - Env: `env.test.ts` for the new variables.
- **E2E (Playwright, `CALENDAR_FAKE=1`, desktop and mobile)**: `calendar.spec.ts` covers AC1 (connect and status), AC4 (overlap line from the fake busy block), AC5 (401 without the secret), AC6 (disconnect after confirming), and AC8 (keyboard, dark mode, 360px, offline-disabled buttons, no console errors).
- **Manual, once deployed**: real consent, events in Google Calendar, a deleted calendar recreated, and the daily job's log (AC1, AC2, AC5, AC7). Google's real API isn't called from automated tests.
