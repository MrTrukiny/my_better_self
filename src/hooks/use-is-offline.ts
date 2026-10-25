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

/**
 * `useOffline()` only turns true after a failed request or an `offline` event, so a page that
 * the service worker serves from cache while offline would still report online. Reading
 * `navigator.onLine` as well covers that first offline load.
 */
export function useIsOffline(): boolean {
  const nextOffline = useOffline();
  const browserOffline = useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
  return nextOffline || browserOffline;
}
