# 0004: Data, auth, and hosting

- **Status**: Proposed (confirm when spec 001 is planned)
- **Date**: 2026-10-25

## Context

The app needs:

- Persistent storage for the inventory, tasks, occurrences, and sessions.
- Authentication for a single owner, with a stored Google refresh token for calendar access (ADR 0002).
- A scheduled daily job.

It is a personal app, so cost and operational effort should be close to zero.

## Decision

- **Database: Postgres on Neon** (serverless, free tier, branching for previews).
- **ORM: Drizzle** with SQL migrations committed to the repo (`drizzle/`). Schema in TypeScript under `src/db/`.
- **Auth: Better Auth** with the Google social provider and the Drizzle adapter:
  - It requests the calendar scopes with offline access and stores the access and refresh tokens in the database.
  - Sign-in is restricted to an **allowlist** of email addresses (`ALLOWED_EMAILS`), which is just the owner for now.
- **Hosting: Vercel**, the native platform for Next.js 16 features (Cache Components, Partial Prefetching).
- **Daily job: Vercel Cron** calls a protected route handler (`CRON_SECRET`) that recomputes upcoming sessions and syncs the calendar.
- **Ownership in the model**: every user-owned table carries a `userId`, so sharing (phase 3) does not need a migration of existing data.

## Consequences

- Free tiers of Neon and Vercel are enough for one user. Vercel Hobby cron runs at most once per day, which matches the need.
- Server-side code needs a database driver that works in serverless functions (the Neon serverless driver).
- New environment variables, documented in `.env.example` when introduced:
  - `DATABASE_URL`
  - `BETTER_AUTH_SECRET`
  - `BETTER_AUTH_URL`
  - `ALLOWED_EMAILS`
  - `CRON_SECRET`
- Moving off Vercel later requires replacing the cron trigger; the job itself is a plain route handler.

## Alternatives considered

- **Supabase** (Postgres plus auth in one service): viable, but its auth would duplicate the Google OAuth handling we need anyway for calendar tokens.
- **SQLite or Turso**: simpler, but Neon's branching and Postgres ecosystem fit Vercel previews better.
- **Auth.js**: works, but Better Auth has simpler token storage for extra scopes and active development.
