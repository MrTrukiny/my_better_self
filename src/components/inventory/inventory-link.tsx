"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useIsOffline } from "@/hooks/use-is-offline";

/**
 * A `Link` that falls back to a full page load while offline. Inventory pages are read offline
 * from the service worker's document cache; in-app navigation would need RSC payloads, which
 * are not cached for inventory routes.
 */
export function InventoryLink({ href, onClick, ...props }: ComponentProps<typeof Link>) {
  const isOffline = useIsOffline();
  return (
    <Link
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (isOffline && !event.defaultPrevented && typeof href === "string") {
          event.preventDefault();
          window.location.assign(href);
        }
      }}
      {...props}
    />
  );
}
