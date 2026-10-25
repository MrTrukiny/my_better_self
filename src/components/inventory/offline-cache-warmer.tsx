"use client";

import { useEffect } from "react";
import { useIsOffline } from "@/hooks/use-is-offline";

/**
 * Refreshes the service worker's copy of inventory pages whenever the data on screen changes,
 * so opening them offline shows the latest inventory rather than the first visit.
 * See docs/decisions/0005-offline-inventory-reading.md.
 */
export function OfflineCacheWarmer({ urls, version }: { urls: string[]; version: string }) {
  const isOffline = useIsOffline();
  const urlKey = urls.join("\n");

  useEffect(() => {
    if (isOffline || !version) {
      return;
    }
    for (const url of urlKey.split("\n")) {
      fetch(url, { credentials: "same-origin" }).catch(() => {});
    }
  }, [urlKey, version, isOffline]);

  return null;
}
