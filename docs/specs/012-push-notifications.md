# 012: Push notifications

- **Status**: In progress
- **Owner**: @mrtrukiny
- **Created**: 2026-10-28

## Goal

Today the only reminder is the Google Calendar event, and nothing nudges the owner when a day is about to break the streak. This spec adds web push notifications from the installed PWA: one before the session starts and one in the evening when nothing was checked yet. It is the "Web push notifications" item of Phase 2 in [`docs/ROADMAP.md`](../ROADMAP.md#phase-2-smarter-routine).

## User stories

- As the owner, I want a heads-up before my session, so I start on time.
- As the owner, I want an evening reminder when I haven't checked anything, so I don't lose my streak by forgetting.
- As the owner, I want to turn each reminder on or off and choose when it arrives, so they help instead of annoy.

## Acceptance criteria

- [ ] AC1: Given I open Settings, then a Notifications entry lets me turn notifications on for this device. Turning them on asks the browser for permission; if I deny it, the page says so and how to allow it later. Given the browser can't receive push (for example iOS without installing the app), the page explains that it must be installed first.
- [ ] AC2: Given notifications are on, then I can turn on or off "Before my session" and choose how long before: at the start time, or 5, 15, or 30 minutes before (default 15).
- [ ] AC3: Given "Before my session" is on and today has cleaning tasks, then at the chosen time I get one notification ("Cleaning in 15 min: 4 tasks, 45 min"). Days off and days with nothing to clean send nothing.
- [ ] AC4: Given notifications are on, then I can turn on or off "Evening reminder" and choose its time (default 20:00). Given that time arrives and no cleaning task of today is done or skipped, then I get one notification ("Your streak is waiting: 4 tasks left today"). Given I already handled today, nothing is sent.
- [ ] AC5: Given I tap a notification, then the app opens on Today.
- [ ] AC6: Each notification is sent at most once per day and kind, in my time zone, and arrives within 5 minutes of its time.
- [ ] AC7: Given I turn notifications off on a device, or sign out there, then that device stops receiving them; other devices keep theirs.
- [ ] AC8: The settings work at 360px and on desktop, in light and dark mode, and with the keyboard only; switches have accessible names and the permission state is announced.

## UX notes

- Settings gets a fourth row, "Notifications", with a summary ("Before my session, 15 min · Evening, 20:00" or "Off on this device").
- The notifications page shows the permission state of this device and one switch plus one time control per reminder.
- Offline: changing notification settings needs a connection; the controls are disabled offline, like other settings.

## Out of scope

- Notifications for new proposals or plan changes.
- Email or SMS reminders.
- Snooze or actions inside the notification ("Mark done").
- Per-day reminder times.

## Open questions

- None. Decided with the owner: the reminder times are known ahead, so the daily job schedules each of the day's notifications as a delayed message in Upstash QStash at its exact time, and saving the schedule or the notification settings reschedules that day's messages. Vercel's Hobby cron runs only once a day, and polling (for example a GitHub Actions workflow every 5 minutes) can run 10 to 15 minutes late. The new service needs an ADR.

---

## Technical plan

### Approach

See [ADR 0010](../decisions/0010-push-notifications.md). Web Push with VAPID keys delivers; QStash delayed messages time each reminder.

- **Data**: `push_subscription` (endpoint, keys, owner, and the device's session, cascade-deleted with it), `notification_settings` (one row per owner; no row means the defaults), and `notification_log` (owner, date, kind) for once a day. Migration `0008`.
- **Rules** (`src/lib/notifications/reminders.ts`, pure): the reminders of a day from the schedule and the preferences, their UTC instants in the owner's time zone, and the send-time decision with its text. A day off has no "before" reminder; a day without cleaning tasks sends nothing.
- **Scheduling** (`schedule-reminders.ts`): for an owner with at least one subscription, publish the reminders of the next 26 hours to QStash with `notBefore` and a deduplication id. Runs from the daily job for every subscribed owner, and in `after()` when the schedule or the notification settings are saved and when a device subscribes.
- **Sending** (`/api/notifications/send`): verify the QStash signature, plan the owner's day, recompute the reminder, record it in `notification_log` (conflict means already sent), and push it to every subscription, deleting the ones the push service reports gone (404, 410).
- **Worker**: `push` shows the notification; `notificationclick` focuses an open window on Today or opens one. Handlers live in `src/lib/notifications/worker.ts` so they are unit-tested; `sw.ts` registers them.
- **UI**: a Server Component page `/notifications` passes the saved preferences, whether this session has a subscription, and the VAPID public key to a client `NotificationsPanel`, which reads the permission, subscribes or unsubscribes the browser, and calls Server Actions. Preferences use a form with Save, like Schedule, disabled offline. Settings gets a "Notifications" row summarizing this device. Signing out unsubscribes the browser first.
- **Offline**: the page is an offline document route like the other settings pages; controls are disabled offline.

### Tasks

- [ ] T1: Schema, migration, and pure reminder rules. Files: `src/db/schema/notifications.ts`, `src/db/schema/index.ts`, `drizzle/0008_*.sql`, `src/lib/notifications/reminders.ts`, `src/lib/notifications/reminders.test.ts`. Covers: AC2, AC3, AC4, AC6.
- [ ] T2: Delivery and scheduling: env, Web Push and QStash wrappers with a test-only fake, scheduling, the send route, the daily job, and rescheduling on schedule save. Files: `src/lib/env.ts`, `.env.example`, `src/lib/notifications/{push,qstash,schedule-reminders,deliver,queries}.ts`, `src/app/api/notifications/send/route.ts`, `src/app/api/cron/daily/route.ts`, `src/app/(app)/schedule/actions.ts`, tests. Covers: AC3, AC4, AC6.
- [ ] T3: Service worker handlers and unsubscribe on sign-out. Files: `src/lib/notifications/worker.ts`, `worker.test.ts`, `src/app/sw.ts`, `src/lib/notifications/browser.ts`, `src/components/account-menu.tsx`. Covers: AC5, AC7.
- [ ] T4: Notifications page, actions, and Settings row. Files: `src/app/(app)/notifications/{page,actions}.ts(x)`, `src/components/notifications/notifications-panel.tsx` (+ test), `src/components/ui/switch.tsx`, `src/app/(app)/settings/page.tsx`, `src/lib/settings/summary.ts`, `src/lib/navigation.ts`, `src/app/sw.ts`. Covers: AC1, AC2, AC4, AC7, AC8.
- [ ] T5: E2E and docs. Files: `e2e/notifications.spec.ts`, `e2e/support/auth.ts`, `docs/ARCHITECTURE.md`. Covers: AC1, AC2, AC4, AC7, AC8.

### Test plan

- Unit: reminder times per day, day off, lead at the start time, time zone and daylight saving conversion; the send decision (stale time, off, nothing to clean, already handled, late) and its text (AC2, AC3, AC4, AC6). Signature rejection in the send route (AC6). Worker push and click handlers (AC5). Panel states: unsupported, denied, on, off, offline (AC1, AC8).
- E2E with a stubbed `PushManager`: turning on stores a subscription and shows the reminders; saving preferences updates the Settings summary; denied permission shows the help text; turning off and signing out remove the subscription (AC1, AC2, AC4, AC7); 360px dark mode, keyboard, and no console errors (AC8).
- Not automated: real delivery through a push service and QStash timing; checked by hand once credentials exist.
