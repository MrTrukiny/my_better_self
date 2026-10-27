"use client";

import {
  CalendarDays,
  House,
  ListChecks,
  type LucideIcon,
  Settings as SettingsIcon,
  Sun,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { OfflineAwareLink } from "@/components/offline-aware-link";
import { NAV_ITEMS, type NavHref, sectionFor } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const ICONS: Record<NavHref, LucideIcon> = {
  "/": Sun,
  "/plan": CalendarDays,
  "/tasks": ListChecks,
  "/rooms": House,
  "/settings": SettingsIcon,
};

type Variant = "top" | "tabs";

/**
 * The app's destinations: links in the top bar from `sm` up, a tab bar at the bottom below it.
 * Only one is displayed at a time, so both are the "Main" landmark.
 */
export function NavLinks({ variant, current }: { variant: Variant; current: NavHref | null }) {
  if (variant === "top") {
    return (
      <nav aria-label="Main" className="hidden sm:flex">
        {NAV_ITEMS.map(({ href, label }) => (
          <OfflineAwareLink
            key={href}
            href={href}
            aria-current={href === current ? "page" : undefined}
            className={cn(
              "hover:bg-muted focus-visible:ring-ring inline-flex h-9 items-center rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-2",
              href === current ? "bg-muted text-foreground" : "text-muted-foreground",
            )}
          >
            {label}
          </OfflineAwareLink>
        ))}
      </nav>
    );
  }
  return (
    <nav
      aria-label="Main"
      className="bg-background/95 fixed inset-x-0 bottom-0 z-10 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 px-[env(safe-area-inset-left)]">
        {NAV_ITEMS.map(({ href, label }) => {
          const Icon = ICONS[href];
          const active = href === current;
          return (
            <li key={href}>
              <OfflineAwareLink
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset",
                  active ? "text-primary font-semibold" : "text-muted-foreground font-medium",
                )}
              >
                {active ? (
                  <span
                    aria-hidden
                    className="bg-primary absolute inset-x-4 top-0 h-0.5 rounded-full"
                  />
                ) : null}
                <Icon aria-hidden className="size-5" strokeWidth={active ? 2.5 : 2} />
                {label}
              </OfflineAwareLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** `NavLinks` with the current page's destination marked. */
export function AppNav({ variant }: { variant: Variant }) {
  return <NavLinks variant={variant} current={sectionFor(usePathname())} />;
}
