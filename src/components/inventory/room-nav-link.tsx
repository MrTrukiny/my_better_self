"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { OfflineAwareLink } from "@/components/offline-aware-link";

export function RoomNavLink({
  href,
  label,
  children,
}: {
  href: string;
  /** The link's accessible name, when its text needs punctuation to read well. */
  label?: string;
  children: ReactNode;
}) {
  const isCurrent = usePathname() === href;
  return (
    <OfflineAwareLink
      href={href}
      aria-label={label}
      aria-current={isCurrent ? "page" : undefined}
      className="hover:bg-muted/60 focus-visible:ring-ring aria-[current=page]:bg-muted flex min-h-14 items-center justify-between gap-4 px-4 outline-none focus-visible:ring-2 focus-visible:ring-inset"
    >
      {children}
    </OfflineAwareLink>
  );
}

/** Shows the room list beside a room's detail on wide screens; `/rooms` already shows it. */
export function RoomsSidebar({ children }: { children: ReactNode }) {
  if (usePathname() === "/rooms") {
    return null;
  }
  return (
    <aside aria-label="All rooms" className="hidden lg:block">
      {children}
    </aside>
  );
}
