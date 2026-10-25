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
