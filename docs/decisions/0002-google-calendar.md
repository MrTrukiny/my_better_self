# 0002: Google Calendar as the scheduling target

- **Status**: Accepted, amended 2026-10-26 (spec 005)
- **Date**: 2026-10-25

## Context

The user manages their time in Google Calendar. Cleaning sessions must appear there without cluttering or modifying the user's other calendars.

## Decision

- **Integrate with the Google Calendar API** through OAuth 2.0. The same Google sign-in authenticates the user in the app (see ADR 0004).
- **Least-privilege scopes**:
  - `https://www.googleapis.com/auth/calendar.app.created`: create a secondary calendar and manage events only in calendars created by this app.
  - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`: list the user's calendars (ids and names only, no events), so free/busy can be asked for each of them.
  - `https://www.googleapis.com/auth/calendar.freebusy`: read free/busy information across the user's calendars, without seeing event details.
- **A dedicated secondary calendar** named "Cleaning" (the user can rename it). All events go there, so the user can hide, recolor, or delete everything at once.
- **One event per day** ("Cleaning, 38 min", the day's total cleaning minutes), with the day's task checklist in the description and a deep link to the app. The app stores a content digest per day and only writes events that changed.
- **Sessions go at the day's start time.** Free/busy doesn't move them: it only flags a session that overlaps a busy time in any of the user's selected calendars other than "Cleaning", and the app shows a warning on that day. Choosing a free slot automatically is a later version.
- **Offline access**: request a refresh token (`access_type=offline`) so a daily server job can update events without the user being present.

## Amendment (spec 005)

- **Incremental consent through Better Auth.** Sign-in keeps its basic scopes. A "Connect Google Calendar" button calls Better Auth's `linkSocial` for the existing Google account with the three calendar scopes plus `access_type=offline`, `prompt=consent`, and `include_granted_scopes=true`, so the account row gains a refresh token. Better Auth's `getAccessToken` refreshes access tokens; the app has no token handling of its own.
- **Calendar list scope added**, because `freeBusy` only answers for calendar ids it's given. Decided with the owner over querying only the primary calendar.
- **REST over `fetch`** instead of the `googleapis` package: the app needs a handful of endpoints, and the package is large.
- **Derived event ids.** Each event's id is derived from the user and the date (base32hex, as Google requires), so a lost database row can't create a duplicate event: writing that id again updates the existing event.
- **Disconnect** deletes the "Cleaning" calendar and revokes the grant. Revoking also drops the sign-in grant on Google's side, but the app session stays valid; the next sign-in or "Connect" asks again.

## Consequences

- The app cannot read or edit events in the user's other calendars, only their busy times. This is intentional.
- The Google Cloud OAuth consent screen must be set to **In production** (it can stay unverified for personal use, which shows a warning screen when connecting). In **Testing** status, refresh tokens for these scopes expire after 7 days, which would break the daily job.
- Changing calendar providers later means a new integration behind the same "calendar sync" module interface (`src/lib/calendar/`).
- Credentials needed: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `CRON_SECRET` for the daily job (see `.env.example` and `docs/DEPLOYMENT.md`).
