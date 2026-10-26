# 0005: Read the inventory offline from cached documents

- **Status**: Accepted
- **Date**: 2026-10-25

## Context

Spec 002 (AC7) requires that, after opening the inventory once, the owner can browse their rooms and items offline, with edits disabled and nothing queued.

The default Serwist runtime cache stores Next.js RSC payloads for in-app navigations. Testing showed that this serves stale data offline:

- RSC requests carry an `_rsc` query parameter derived from the router state they start from. The same destination gets a different cache entry depending on where the user came from.
- A given entry is only refreshed when that exact transition happens again online. After adding items to a room, going offline and opening the room showed the room as it was on the first visit.
- The cached HTML of `/rooms` has the same problem: it only refreshes on a full page load, not after client-side changes.
- `useOffline()` only turns true after a failed request or an `offline` event. A page served from the cache while offline would still report "online".

## Decision

- **Inventory RSC payloads are not cached.** A `NetworkOnly` rule in `src/app/sw.ts` covers `/rooms` and `/rooms/*` RSC requests, ahead of the default cache.
- **Inventory documents are the offline copy.** `OfflineCacheWarmer` fetches `/rooms` and the affected room pages in the background whenever the inventory data on screen changes and the app is online. The service worker's `NetworkFirst` document cache stores them under their plain URL.
- **Offline navigation is a full page load.** `InventoryLink` wraps `next/link` and, while offline, navigates with `window.location.assign`, so the service worker serves the cached document.
- **Offline detection** (`useIsOffline`) combines `useOffline()` with `navigator.onLine`. The offline banner, the sign-in form, and the inventory edit guard all use it.

## Consequences

- Offline, the owner sees the inventory as of the last change or visit made while online, not as of an arbitrary earlier visit.
- Each inventory change triggers a few extra page renders: `/rooms` plus one per room from the list, or two from a room page. That is cheap at personal scale. Revisit this if rooms grow into the dozens.
- Pages never seen online fall back to `/~offline`, as before. Sign-out already clears these caches.
- Future offline-readable areas (the Today view, spec 006) should follow the same pattern rather than relying on cached RSC payloads.

## Amendment (spec 003)

The pattern now covers the task pages too, under generic names:

- The `NetworkOnly` RSC rule lists `/rooms`, `/tasks` (with `/tasks/review`), and `/home-profile` in `OFFLINE_DOCUMENT_ROUTES` in `src/app/sw.ts`.
- `InventoryLink` became `OfflineAwareLink` and `OfflineCacheWarmer` moved to `src/components/`, since they are no longer inventory-specific.
- `TasksCacheWarmer` refreshes `/tasks`, `/tasks/review`, and `/home-profile` together whenever tasks, proposals, the home profile, or rooms change, because all three pages show that data.
- The review page is cached for the whole-home scope only. A room scope (`/tasks/review?room=…`) opened offline for the first time falls back to `/~offline`. The scope picker is disabled offline, since nothing can be generated without a connection.

## Amendment (spec 004)

- `/plan` and `/schedule` join `OFFLINE_DOCUMENT_ROUTES`.
- The plan page refreshes the copies of `/plan` and `/schedule` when the week or the settings it shows change, and the schedule page does the same for its settings. Task pages also refresh `/plan` once there is a schedule, since task changes replan.
- An offline copy of the plan is the plan as of its last refresh: on a later day, "Today" still marks the day it was cached. Spec 006 (the Today view) should revisit this if the plan is used offline across days.
