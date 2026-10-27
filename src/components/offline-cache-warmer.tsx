"use client";

import { useEffect } from "react";
import { useIsOffline } from "@/hooks/use-is-offline";

/** URLs with a refresh in flight, and whether the data changed again since it started. */
const refreshes = new Map<string, { again: boolean }>();

/**
 * Refreshes run one at a time per URL. Overlapping ones could finish out of order, and the
 * service worker keeps whichever response arrives last, so an older render would replace a newer
 * one. Changes made while a refresh is in flight collapse into a single follow-up refresh.
 */
async function refresh(url: string) {
  const inFlight = refreshes.get(url);
  if (inFlight) {
    inFlight.again = true;
    return;
  }
  const state = { again: false };
  refreshes.set(url, state);
  do {
    state.again = false;
    try {
      const response = await fetch(url, { credentials: "same-origin" });
      await response.arrayBuffer();
    } catch {
      // Offline or a failed render: the previous copy stays until the next change.
    }
  } while (state.again);
  refreshes.delete(url);
}

/**
 * Refreshes the service worker's copy of offline-readable pages whenever the data on screen
 * changes, so opening them offline shows the latest data rather than the first visit.
 * See docs/decisions/0005-offline-inventory-reading.md.
 */
export function OfflineCacheWarmer({ urls, version }: { urls: string[]; version: string }) {
  const isOffline = useIsOffline();
  const urlKey = urls.join("\n");

  useEffect(() => {
    if (isOffline || !navigator.onLine || !version) {
      return;
    }
    for (const url of urlKey.split("\n")) {
      void refresh(url);
    }
  }, [urlKey, version, isOffline]);

  return null;
}
