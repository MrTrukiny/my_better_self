# 0010: Push notifications with QStash and Web Push

- **Status**: Accepted
- **Date**: 2026-10-28

## Context

Spec 012 sends two reminders a day from the installed PWA: one before the session and one in the evening when nothing was handled yet. Each must arrive within 5 minutes of its time. The app runs on Vercel Hobby, whose cron runs once a day (`/api/cron/daily`, 09:00 UTC) and may fire anywhere in its hour, so it can't send at the right minute. Polling from outside (for example a GitHub Actions workflow every 5 minutes) is often 10 to 15 minutes late. The reminder times are known ahead: they follow the schedule and the notification settings.

## Decision

- **Delivery**: standard Web Push with VAPID keys, through the `web-push` package (it signs the VAPID token and encrypts the payload as RFC 8291 requires). The service worker shows the notification and opens Today when it's tapped. A subscription belongs to the device's Better Auth session (`push_subscription.session_id`, cascade on delete), so signing out on a device removes its subscription and leaves other devices alone; the client also unsubscribes the browser before signing out.
- **Timing**: [Upstash QStash](https://upstash.com/docs/qstash) delayed messages, through `@upstash/qstash`. Each reminder is one message with `notBefore` set to its exact time, posted to `/api/notifications/send`, which verifies QStash's signature. The daily job schedules the messages of the next 26 hours for every owner with a subscription. Saving the schedule, saving the notification settings, or turning notifications on schedules them again.
- **No cancelling**: messages are never deleted. The send route recomputes the reminder at send time from the current settings and plan and drops the message when its time no longer matches, the reminder is off, the day has nothing to clean (before the session), today was already handled (evening), or it's more than 30 minutes late. QStash deduplicates identical messages, and `notification_log` (one row per owner, day, and kind) keeps each reminder to once a day.
- **Preferences** are per owner in `notification_settings` (no row means the defaults: both on, 15 minutes before, evening at 20:00). Whether notifications are on is per device: a device is on when it has a subscription.
- **Configuration**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, and `QSTASH_NEXT_SIGNING_KEY` (plus `QSTASH_URL` for a non-default region). Without them the notifications page says notifications aren't set up yet. `PUSH_FAKE=1` (test-only) replaces QStash and Web Push with no-ops.

## Consequences

- A new external service, on QStash's free tier (a few messages per owner per day).
- Changing a time leaves the old message queued; it's dropped when it arrives, so the cost is one extra request.
- The send route is public but only accepts signed requests; it acts only on the owner named in the message.
- On iOS, push works only in the installed app (Safari 16.4 or later), which the page explains.
- Push delivery can't be tested end to end in CI; the decision logic and the worker handlers have unit tests, and e2e covers the settings flow with a stubbed browser subscription.
