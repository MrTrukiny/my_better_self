# 0004: Data, auth, and hosting

- **Status**: Accepted (amended when spec 001 was planned; see "Amendments")
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
  - It requests the calendar scopes with offline access and stores the access and refresh tokens in the database. Sign-in (spec 001) asks only for basic profile scopes; the calendar scopes are added later through incremental authorization when calendar sync is enabled (spec 005).
  - Sign-in is restricted to an **allowlist** of email addresses (`ALLOWED_EMAILS`), which is just the owner for now.
- **Hosting: Vercel**, the native platform for Next.js 16 features (Cache Components, Partial Prefetching).
- **Daily job: Vercel Cron** calls a protected route handler (`CRON_SECRET`) that recomputes upcoming sessions and syncs the calendar.
- **Ownership in the model**: every user-owned table carries a `userId`, so sharing (phase 3) does not need a migration of existing data.

## Consequences

- Free tiers of Neon and Vercel are enough for one user. Vercel Hobby cron runs at most once per day, which matches the need.
- Server-side code connects through a small `pg` pool using Neon's pooled connection string (see "Amendments").
- New environment variables, documented in `.env.example` when introduced:
  - `DATABASE_URL`
  - `BETTER_AUTH_SECRET`
  - `BETTER_AUTH_URL`
  - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
  - `ALLOWED_EMAILS`
  - `CRON_SECRET`
- Moving off Vercel later requires replacing the cron trigger; the job itself is a plain route handler.

## Amendments (spec 001)

- **Driver: `pg` (node-postgres) instead of the Neon serverless driver.** The same code then runs against Neon, a plain local Postgres, and the Postgres service in CI. With the Neon driver, CI would need a real Neon database.
- **Allowlist enforcement** lives in Better Auth database hooks. Two hooks check it: `user.create.before` refuses new accounts, and `session.create.before` refuses existing users who were later removed from the list. Both throw `APIError` with the code `email_not_allowed`, which Better Auth forwards to the sign-in page as `?error=`.
- **Timestamps** are `timestamptz`, so the scheduler (spec 004) can reason about local days without ambiguity.
- **E2E tests don't go through Google.** A test-only Better Auth instance with the `testUtils` plugin (`e2e/support/auth.ts`) creates users and session cookies directly. The production config never includes the plugin. The real Google redirect is checked manually during review.

## Alternatives considered

- **Supabase** (Postgres plus auth in one service): viable, but its auth would duplicate the Google OAuth handling we need anyway for calendar tokens.
- **SQLite or Turso**: simpler, but Neon's branching and Postgres ecosystem fit Vercel previews better.
- **Auth.js**: works, but Better Auth has simpler token storage for extra scopes and active development.
