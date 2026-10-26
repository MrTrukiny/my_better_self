"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useIsOffline } from "@/hooks/use-is-offline";

/**
 * A `Link` that falls back to a full page load while offline. Inventory and task pages are read
 * offline from the service worker's document cache; in-app navigation would need RSC payloads,
 * which are not cached for those routes. See docs/decisions/0005-offline-inventory-reading.md.
 *
 * `navigator.onLine` is checked at click time as well, because `useIsOffline` reports online
 * until hydration settles; a soft navigation started offline never resolves.
 */
export function OfflineAwareLink({ href, onClick, ...props }: ComponentProps<typeof Link>) {
  const isOffline = useIsOffline();
  return (
    <Link
      href={href}
      onClick={(event) => {
        onClick?.(event);
        const offline = isOffline || !navigator.onLine;
        if (offline && !event.defaultPrevented && typeof href === "string") {
          event.preventDefault();
          window.location.assign(href);
        }
      }}
      {...props}
    />
  );
}
