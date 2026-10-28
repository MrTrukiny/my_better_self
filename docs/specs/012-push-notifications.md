# 012: Push notifications

- **Status**: Draft
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

- Sending at a given minute needs a job that runs every few minutes, and Vercel's Hobby plan only allows cron once a day. Options: a GitHub Actions scheduled workflow calling a protected endpoint every 5 minutes (free, recommended), an external scheduler such as Upstash QStash, or upgrading Vercel to Pro. Which one?

---

## Technical plan

_Filled in by the `plan-feature` skill after the spec is approved._

### Approach

### Tasks

### Test plan
