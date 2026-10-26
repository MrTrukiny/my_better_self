# 0002: Google Calendar as the scheduling target

- **Status**: Accepted
- **Date**: 2026-10-25

## Context

The user manages their time in Google Calendar. Cleaning sessions must appear there, in a free slot, without cluttering or modifying the user's other calendars.

## Decision

- **Integrate with the Google Calendar API** through OAuth 2.0. The same Google sign-in authenticates the user in the app (see ADR 0004).
- **Least-privilege scopes**:
  - `https://www.googleapis.com/auth/calendar.app.created`: create a secondary calendar and manage events only in calendars created by this app.
  - `https://www.googleapis.com/auth/calendar.freebusy`: read free/busy information across the user's calendars, without seeing event details.
- **A dedicated secondary calendar** named "Cleaning" (the user can rename it). All events go there, so the user can hide, recolor, or delete everything at once.
- **One event per day** ("Cleaning, 45 min"), with the day's task checklist in the description and a deep link to the app. The app stores the event ID per session and upserts it; it never creates duplicates.
- **Slot search**: query the FreeBusy API for the user's scheduling window on that day and pick the earliest free interval that fits the session. If none fits, fall back to the start of the window and mark the session as "conflict" in the app.
- **Offline access**: request a refresh token (`access_type=offline`) so a daily server job can update events without the user being present.

## Consequences

- The app cannot read or edit events in the user's other calendars, only their busy times. This is intentional.
- The Google Cloud OAuth consent screen must be set to **In production** (it can stay unverified for personal use, which shows a warning screen at sign-in). In **Testing** status, refresh tokens for these scopes expire after 7 days, which would break the daily job.
- Changing calendar providers later means a new integration behind the same "calendar sync" module interface.
- Credentials needed: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (documented in `.env.example` when the integration is built).
