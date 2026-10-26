# Architecture

## Overview

A single Next.js 16 App Router application, rendered with Cache Components and Partial Prefetching, installable as a PWA. It plans household cleaning: AI proposes tasks, a deterministic scheduler packs them into daily sessions, and the sessions are synced to Google Calendar.

```mermaid
flowchart LR
  Browser --> ServiceWorker["Service worker (Serwist)"]
  ServiceWorker -->|"precache and runtime cache"| CacheStorage
  ServiceWorker -->|network| NextServer["Next.js server"]
  NextServer --> Routes["App Router routes"]
  NextServer --> SwRoute["/serwist/sw.js route handler"]
```

## Rendering

- **Server Components by default.** Client Components only where interactivity is needed.
- **Cache Components** (`cacheComponents: true`): static shell + dynamic holes behind `<Suspense>`. Use `"use cache"` for cacheable data. Route segment config (`dynamic`, `revalidate`) is not allowed.
- **Partial Prefetching**: `<Link>` prefetches the static shell of a route so it can render instantly, even offline.

## PWA and offline

| Concern                          | Where                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| Manifest                         | `src/app/manifest.ts` (served at `/manifest.webmanifest`)                               |
| Icons                            | `public/icons/`                                                                         |
| Service worker source            | `src/app/sw.ts`                                                                         |
| Service worker build and serving | `src/app/serwist/[path]/route.ts` (esbuild at request time, served at `/serwist/sw.js`) |
| Registration                     | `SerwistProvider` in `src/app/layout.tsx`                                               |
| Offline document fallback        | `src/app/~offline/page.tsx` (precached)                                                 |
| In-app connectivity state        | `experimental.useOffline` + `useIsOffline()` in `src/hooks/use-is-offline.ts`           |
| Offline inventory reading        | [ADR 0005](decisions/0005-offline-inventory-reading.md)                                 |

There are three layers of offline behavior:

1. **Inside a running app**: Next's `useOffline` keeps failed soft navigations and Server Actions pending and retries them when the connection returns. `useIsOffline()` adds `navigator.onLine`, so a page loaded from the cache while offline also knows it is offline. The offline banner tells the user.
2. **Cold loads without network**: the service worker serves precached assets and runtime-cached pages; uncached documents get the `/~offline` fallback.
3. **Inventory** (`/rooms`): read-only offline. Inventory RSC payloads are not cached, because their cache keys depend on the router state and go stale. Instead, `OfflineCacheWarmer` refreshes the cached documents whenever the data changes online, and `OfflineAwareLink` does full page loads while offline. Task pages (`/tasks`, `/tasks/review`, `/home-profile`) follow the same pattern (ADR 0005 amendment). Edit controls are disabled offline (`useEditsDisabled()`), so no Server Action is ever queued.

## UI

- Tailwind CSS v4 with CSS variables defined in `src/app/globals.css` (light and `.dark`).
- shadcn/ui components in `src/components/ui/` (Base UI primitives).
- Theme via `next-themes` (`class` strategy, system default).
- Layout shell in `src/components/app-shell.tsx`, which handles safe-area insets for standalone mode.

## Domain model

Terms are defined in the glossary in [`PRODUCT.md`](PRODUCT.md#glossary).

```mermaid
flowchart LR
  User --> Home
  Home --> Room
  Room --> Item["Item (window, closet, shelf...)"]
  Item --> Task["Task (action, minutes, frequency, lastDoneAt)"]
  Task --> Occurrence["Occurrence (date, status)"]
  Session["Session (date, budget, calendarEventId)"] --> Occurrence
  Proposal["Proposal (AI output, pending review)"] -->|approved| Task
```

- Every user-owned record carries a `userId`, so sharing can be added later.
- **Home is implicit for now**: with one home per user, the user is the home. A `home` table can be added with sharing without moving data.

### Inventory (spec 002)

| Concern    | Where                             | Notes                                                                                                                    |
| ---------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Tables     | `src/db/schema/inventory.ts`      | `room` (unique `(user_id, lower(name))`) and `item` (`type`, `name`, `count`, `note`), cascade-deleted with their owner. |
| Item types | `src/lib/inventory/item-types.ts` | A fixed list with labels and icons. Stored as `text` and validated in code, so adding a type needs no migration.         |
| Validation | `src/lib/inventory/schemas.ts`    | Zod schemas shared by forms and actions; duplicate room names map to a field error.                                      |
| Reads      | `src/lib/inventory/queries.ts`    | Getters resolve the user, then call `"use cache"` functions keyed by `userId` and tagged `inventory:<userId>`.           |
| Writes     | `src/app/(app)/rooms/actions.ts`  | Server Actions scope every query by `userId`, return typed results, and call `updateTag` on the user's inventory tag.    |
| UI         | `src/components/inventory/`       | Forms use a sheet on mobile and a dialog on desktop (`src/components/responsive-dialog.tsx`).                            |

### Tasks and AI proposals (spec 003)

| Concern      | Where                                           | Notes                                                                                                                                                                    |
| ------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tables       | `src/db/schema/tasks.ts`                        | `home_profile` (helpers, note), `task_proposal` (pending, with the `scope_room_id` it was generated for), and `task`. A task targets an item, a room, or the whole home. |
| Domain rules | `src/lib/tasks/`                                | Limits, helper list, per-type cleaning guide, Zod schemas, and formatting. The cleaning guide and helper guidance are the prompt's domain knowledge.                     |
| AI           | `src/lib/ai/`                                   | `proposeTasks` builds the prompt from the inventory, profile, and existing tasks, calls Gemini with a Zod output schema, then validates and dedupes.                     |
| Reads        | `src/lib/tasks/queries.ts`                      | Cached per user and tagged with both the tasks and the inventory tags.                                                                                                   |
| Writes       | `src/app/(app)/tasks/actions.ts`                | Generating replaces the scope's pending proposals in one transaction. Accepting moves proposals into `task`; nothing is accepted by default.                             |
| UI           | `src/components/tasks/`, `src/app/(app)/tasks/` | Review screen (`/tasks/review`), task list (`/tasks`), and home profile (`/home-profile`). All three stay readable offline (ADR 0005).                                   |

Proposal flow: the user picks a scope (whole home or one room) and asks for proposals. The server reads the inventory, home profile, existing tasks, and pending proposals of other scopes, so the AI doesn't repeat them. Gemini returns structured proposals with references (`r1`, `r1.i1`, `home`) that the code maps back to rows and rejects if invalid. A failure, timeout, or invalid output saves nothing. With `AI_FAKE=1`, a deterministic fake (`src/lib/ai/fake-proposals.ts`) replaces Gemini for e2e and CI.
- **Due date = `lastDoneAt` + frequency.** A task's schedule moves with actual completion rather than following a fixed recurrence.
- **Priority = overdue ratio** (days past due divided by frequency), so a weekly task 3 days late outranks a monthly task 3 days late.

### Scheduler (spec 004)

See [ADR 0007](decisions/0007-persisted-plan-and-replanning.md).

| Concern   | Where                                                                    | Notes                                                                                                                                                                        |
| --------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tables    | `src/db/schema/schedule.ts`                                              | `schedule_settings` (a start time per weekday or null for off, weekday and weekend budgets, time zone, `planned_through`) and `occurrence` (task and date, unique together). |
| Algorithm | `src/lib/scheduler/schedule.ts`                                          | Pure and deterministic, in whole-day numbers. Packs must-do work by overdue ratio, pulls work forward when a coming day would overflow, and staggers new tasks.              |
| Replans   | `src/lib/scheduler/plan.ts`, `replan-start.ts`                           | `replan` after task, inventory, or settings changes; `ensureHorizon` when the plan page is read. Both lock the settings row and only replace days from the start date on.    |
| Reads     | `src/lib/scheduler/queries.ts`                                           | Settings are cached per user (`schedule:<userId>`). The week is read uncached after `io()`, since it depends on the date.                                                    |
| UI        | `src/app/(app)/plan/`, `src/app/(app)/schedule/`, `src/components/plan/` | Weekly plan (`/plan`) and settings (`/schedule`). Both stay readable offline (ADR 0005).                                                                                     |

Until check-off exists (spec 006), each past occurrence counts as done, so a task's last completion is its latest occurrence before the replanning date.

## Responsibilities: AI vs code

| Concern                                   | Owner                                          | Why                                      |
| ----------------------------------------- | ---------------------------------------------- | ---------------------------------------- |
| Propose tasks, minutes, frequency, splits | Gemini (structured output, Zod-validated)      | Needs world knowledge about cleaning     |
| Approve or edit proposals                 | User                                           | Trust and control                        |
| Pack tasks into daily sessions, rebalance | Deterministic scheduler (`src/lib/scheduler/`) | Predictable, testable, free, explainable |
| Place the session in a free slot          | Calendar sync via FreeBusy                     | Respects the user's real availability    |

## Daily flow

```mermaid
flowchart TD
  Cron["Vercel Cron, daily"] --> Due["Compute due and overdue tasks"]
  Due --> Pack["Scheduler packs sessions for the next days within the budget"]
  Pack --> FreeBusy["FreeBusy query in the day's scheduling window"]
  FreeBusy --> Upsert["Create or update the day's event in the Cleaning calendar"]
  CheckOff["User checks off tasks in the PWA"] --> Update["Mark occurrence done, set lastDoneAt"]
  Update --> Due
```

- The scheduler plans a rolling horizon (for example 7 days) and is re-run after every check-off and by the daily job, so missed work is redistributed automatically without exceeding the daily budget.
- Calendar writes are idempotent: each session stores its `calendarEventId` and is updated in place.

## Data, auth, and integrations

See ADRs [0002](decisions/0002-google-calendar.md), [0003](decisions/0003-ai-provider-gemini.md), and [0004](decisions/0004-data-auth-hosting.md). In short:

- **Database:** Postgres (Neon), accessed through Drizzle over a `pg` pool (`src/db/index.ts`). The schema lives in `src/db/schema/` and migrations in `drizzle/`. Environment variables are validated in `src/lib/env.ts`.
- **Auth:** Better Auth with Google sign-in (`src/lib/auth.ts`, mounted at `/api/auth/*`), restricted to an email allowlist. Later it also stores the refresh token for calendar access.
- **AI:** Gemini through the Vercel AI SDK, server-only. Prompts and schemas live in `src/lib/ai/`.
- **Calendar:** Google Calendar API with the `calendar.app.created` and `calendar.freebusy` scopes. The app writes only to its own calendar.
- **Hosting:** Vercel, with Vercel Cron for the daily job.

The calendar and cron paths are planned; they are created by the specs that introduce them (see [`ROADMAP.md`](ROADMAP.md)).

### Route protection

| Layer             | Where                             | What it does                                                                                                                                 |
| ----------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Optimistic check  | `src/proxy.ts`                    | Redirects requests without a session cookie to `/sign-in?callbackURL=...`. It does not validate the cookie.                                  |
| Data access layer | `src/lib/session.ts`              | `getCurrentUser()` validates the session (`"use cache: private"`) and redirects when it is missing. Every protected page and action uses it. |
| Route groups      | `src/app/(app)`, `(public)`       | `(app)` renders the app shell and account menu; `(public)` holds `/sign-in` and `/~offline` with a minimal layout.                           |
| Sign-out          | `src/components/account-menu.tsx` | Ends the session, deletes the service worker's runtime caches, and replaces the history entry, so cached pages can't show signed-in content. |

## Testing

- Unit and component tests: Vitest + Testing Library + jsdom, colocated as `*.test.ts(x)`.
- End-to-end: Playwright against a production build on desktop and mobile (Pixel 7) projects. Covers the manifest, service worker registration, offline fallback, auth flows, and the inventory (including offline reading and data isolation between owners).
- E2E needs a Postgres database (`DATABASE_URL`). The `signedInUser` fixture in `e2e/fixtures.ts` creates a user and session cookies through a test-only auth instance, so tests never go through Google. CI runs a Postgres service container.
