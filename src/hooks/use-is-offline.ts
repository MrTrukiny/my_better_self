"use client";

import { useOffline } from "next/offline";
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function subscribeNever() {
  return () => {};
}

/**
 * `useOffline()` only turns true after a failed request or an `offline` event, so a page that
 * the service worker serves from cache while offline would still report online. Reading
 * `navigator.onLine` as well covers that first offline load.
 *
 * While hydrating, this always reports online to match the server HTML. A Suspense boundary
 * can hydrate after `useOffline()` has already turned true, and React doesn't patch attribute
 * mismatches during hydration, so `disabled` would never reach the DOM.
 */
export function useIsOffline(): boolean {
  const nextOffline = useOffline();
  const browserOffline = useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  return hydrated && (nextOffline || browserOffline);
}
