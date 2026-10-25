# 001: Sign-in and data

- **Status**: Approved
- **Owner**: @mrtrukiny
- **Created**: 2026-10-25

## Goal

Give the app an owner and a place to keep data. Every later feature (inventory, tasks, sessions) stores personal records and later needs Google access for the calendar, so the app must first know who is using it and keep that person's data in a database. Only the owner can get in; anyone else is turned away. See the target user and the "single owner" constraint in [`PRODUCT.md`](../PRODUCT.md#target-user), and ADR [0004](../decisions/0004-data-auth-hosting.md).

## User stories

- As the owner, I want to sign in with my Google account so that I don't need another password.
- As the owner, I want everyone else to be refused so that my home data stays private.
- As the owner, I want to stay signed in on my phone so that opening the installed app takes me straight in.
- As the owner, I want to sign out so that I can leave a shared or borrowed device safely.

## Acceptance criteria

Each criterion is testable and maps to at least one test.

- [ ] AC1: Given I am signed out, when I open any app page, then I am taken to the sign-in screen, and after signing in I land on the page I first asked for.
- [ ] AC2: Given my Google email is on the allowlist, when I choose "Continue with Google" and approve, then I land in the app and see my name or avatar in the app header.
- [ ] AC3: Given a Google email that is not on the allowlist, when that account completes Google sign-in, then no session is created and the sign-in screen shows "This account doesn't have access."
- [ ] AC4: Given I am signed in, when I close and reopen the app (browser or installed PWA) within the session lifetime, then I am still signed in.
- [ ] AC5: Given I am signed in, when I choose "Sign out" from the account menu, then my session ends and I am back on the sign-in screen; pressing Back does not show app content.
- [ ] AC6: Given sign-in is in progress, when I wait, then the button shows a busy state and cannot be pressed twice; given Google returns an error or I cancel, then I see a short message and can try again.
- [ ] AC7: Given I am offline on the sign-in screen, when I look at it, then the Google button is disabled and a message says a connection is needed to sign in.
- [ ] AC8: The sign-in screen and the account menu work at 360px wide and on desktop, in light and dark mode, using only the keyboard, and their controls have accessible names.

## UX notes

- **Sign-in screen:** app name and icon, one-line description, and a single "Continue with Google" button. Centered on both mobile and desktop; no other navigation.
- **Account menu:** avatar button in the app header that opens a menu with the account email and "Sign out". On mobile it sits at the top right, inside the safe area.
- **Loading:** the button shows a spinner and "Signing in..." while the Google redirect is in flight.
- **Errors:** inline message under the button, announced to screen readers (`role="alert"` or a polite live region). The access-denied message does not reveal the allowlist.
- **Offline:** reuse the existing offline banner; the button is disabled with a visible reason, not just greyed out.
- **Focus:** on load, focus starts on the Google button; after an error, focus moves to the message.

## Out of scope

- Google Calendar scopes and tokens. Sign-in asks only for basic profile access; calendar access is requested in spec 005.
- Multiple users, invitations, or household sharing.
- Sign-in methods other than Google (email, passkeys, other providers).
- An admin screen to edit the allowlist; it is configured by the owner in the deployment settings.
- Any domain data (rooms, items). Those tables arrive with spec 002.

## Open questions

- None.

---

## Technical plan

### Approach

Follows ADR [0004](../decisions/0004-data-auth-hosting.md), confirmed with two amendments recorded there: the database driver is `pg` (node-postgres) instead of the Neon serverless driver, so the same code runs against Neon, a local Postgres, and the CI Postgres service; and the allowlist is enforced in Better Auth database hooks.

- **Data:** Drizzle over a `pg` pool in `src/db/index.ts` (server-only). Better Auth's four tables (`user`, `session`, `account`, `verification`) are generated with the Better Auth CLI into `src/db/schema/auth.ts`; migrations are generated with `drizzle-kit` into `drizzle/` and committed. Environment variables are parsed once with Zod in `src/lib/env.ts`, so a missing secret fails fast with a clear message.
- **Auth:** Better Auth in `src/lib/auth.ts` with the Google provider (profile and email only, `prompt: "select_account"`), the Drizzle adapter, a 30-day rolling session, and `nextCookies()`. Mounted at `src/app/api/auth/[...all]/route.ts`. The allowlist check (`ALLOWED_EMAILS`, case-insensitive) runs in `databaseHooks.user.create.before` and `databaseHooks.session.create.before`. The second hook also refuses a user who was later removed from the list. Rejections throw `APIError("FORBIDDEN")`; Better Auth then redirects to the sign-in page with an `error` query parameter. The exact code it emits is confirmed in T2 and mapped to user-facing messages in one place.
- **Route protection, two layers** (the Next.js guidance for Cache Components):
  - `src/proxy.ts` does an optimistic cookie check (`getSessionCookie`). It redirects signed-out requests to `/sign-in?callbackURL=<path>` and skips `/sign-in`, `/api/auth`, `/serwist`, `/~offline`, the manifest, icons, and `_next`.
  - A data access layer, `getCurrentUser()` in `src/lib/session.ts`, validates the session on the server with `"use cache: private"` and redirects when it is missing. Every protected Server Component and future Server Action goes through it.
  - `callbackURL` only accepts same-origin relative paths (`src/lib/callback-url.ts`), to prevent open redirects.
- **Routes and rendering:**
  - Protected pages move into a `src/app/(app)/` route group whose layout renders the existing `AppShell`.
  - `/sign-in` and `/~offline` live in a `src/app/(public)/` group with a minimal layout (offline banner, no navigation).
  - The root layout keeps only the providers.
  - The account menu reads the user behind a `<Suspense>` boundary in the header, so the static shell still prerenders and prefetches.
- **Client pieces:** `sign-in-form.tsx` and `account-menu.tsx` are the only new client components. They use the Better Auth React client (`src/lib/auth-client.ts`) and `useOffline()`.
- **Sign-out:** sign out through the client, delete the service worker's runtime page caches (Cache Storage), then `location.replace("/sign-in")`. This drops the router cache and any cached authenticated HTML, so Back and offline cold loads can't show app content (AC5).
- **Tests without Google:** e2e uses Better Auth's `testUtils` plugin in a separate, test-only auth instance (`e2e/support/auth.ts`). It creates an allowlisted user and injects session cookies into the Playwright context. The production auth config never includes it. The Google redirect itself is not exercised in automated tests; it is checked manually once in the review step.
- **New dependencies** (reasons for the PR description):
  - `better-auth`, `drizzle-orm`, and `pg` (with `@types/pg`): ADR 0004.
  - `drizzle-kit`: migrations.
  - `zod`: environment validation, and later Server Action input validation (spec 002) and AI output schemas (spec 003).
  - `server-only`: keeps database and auth modules out of client bundles.
  - shadcn `avatar` and `dropdown-menu`: the account menu.

### Tasks

- [x] T1: Database foundation: Drizzle with a `pg` pool, validated env, scripts `db:generate` and `db:migrate`, and `.env.example` entries (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS`). Files: `package.json`, `drizzle.config.ts`, `src/db/index.ts`, `src/lib/env.ts`, `src/lib/env.test.ts`, `.env.example`. Covers: foundation for all ACs.
- [x] T2: Better Auth server and client, allowlist hooks, generated auth schema, first migration, auth route handler, and error-code mapping. Files: `src/lib/auth.ts`, `src/lib/allowlist.ts`, `src/lib/allowlist.test.ts`, `src/lib/auth-errors.ts`, `src/lib/auth-errors.test.ts`, `src/lib/auth-client.ts`, `src/db/schema/auth.ts`, `drizzle/0000_*.sql`, `src/app/api/auth/[...all]/route.ts`. Covers: AC2, AC3, AC4.
- [x] T3: Route protection: proxy, data access layer, and safe callback URL. Files: `src/proxy.ts`, `src/lib/session.ts`, `src/lib/callback-url.ts`, `src/lib/callback-url.test.ts`. Covers: AC1.
- [x] T4: Route restructure and sign-in screen. Move the shell into `(app)`, add the sign-in route with its own layout, the form (busy, error, and offline states), and a redirect for already signed-in visitors. Files: `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx` (moved from `src/app/page.tsx`), `src/app/(public)/layout.tsx` (shared with `~offline`, moved into the group), `src/app/(public)/sign-in/page.tsx`, `src/components/sign-in-form.tsx`, `src/components/sign-in-form.test.tsx`. Covers: AC1, AC3, AC6, AC7, AC8.
- [x] T5: Account menu in the header, and sign-out that clears caches. Files: `src/components/ui/avatar.tsx`, `src/components/ui/dropdown-menu.tsx` (shadcn), `src/components/account-menu.tsx`, `src/components/account-menu.test.tsx`, `src/components/app-shell.tsx`, `src/lib/clear-app-caches.ts`. Covers: AC2, AC5, AC8.
- [x] T6: E2E infrastructure and auth flows. Add a test-only auth instance with `testUtils` and a Playwright fixture for a signed-in context, and run migrations before the web server. Add a Postgres service, migration step, and test env vars to CI. Update `pwa.spec.ts`, because `/` now redirects to sign-in. Files: `e2e/support/auth.ts`, `e2e/fixtures.ts`, `e2e/auth.spec.ts`, `e2e/pwa.spec.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`. Covers: AC1 to AC8.
- [ ] T7: Docs: set ADR 0004 to Accepted with the amendments. Update `ARCHITECTURE.md`, the README with setup steps (Neon project, Google OAuth client, `.env.local`, `pnpm db:migrate`), and the `AGENTS.md` commands table. Files: `docs/decisions/0004-data-auth-hosting.md`, `docs/ARCHITECTURE.md`, `README.md`, `AGENTS.md`. Covers: none (documentation).

### Test plan

- Unit (Vitest):
  - Env parsing (missing or invalid values).
  - Allowlist matching: case, whitespace, empty list.
  - Auth error-code mapping (AC3, AC6).
  - Callback URL sanitizing, including absolute and protocol-relative URLs (AC1).
- Component (Testing Library):
  - Sign-in form: busy state and single submit (AC6); error message announced with focus moved to it (AC3, AC6); disabled with a reason when offline (AC7).
  - Account menu: shows the email, keyboard-operable, sign-out calls the client and clears caches (AC2, AC5, AC8).
- E2E (Playwright, desktop and mobile projects):
  - AC1: a signed-out visit to `/` lands on `/sign-in`, and a session then returns to the original path.
  - AC2: a signed-in context sees the avatar and name.
  - AC3: `/sign-in?error=<forbidden code>` shows the access-denied message.
  - AC4: a new page in the same context is still signed in.
  - AC5: sign-out returns to sign-in, and Back does not show app content.
  - AC7: offline sign-in shows the disabled button and reason.
  - AC8: keyboard-only sign-out flow, checked in light and dark mode.
- Manual, in review-changes: one real Google sign-in with an allowlisted account and one with a non-allowlisted account, at 360px and on desktop.
