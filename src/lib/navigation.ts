export type NavHref = "/" | "/plan" | "/tasks" | "/rooms" | "/settings";

export type NavItem = {
  href: NavHref;
  label: string;
  /** Other pages that belong to this destination, besides its own nested routes. */
  includes?: readonly string[];
};

/** The app's destinations, from daily use to setup. See spec 010. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Today", includes: ["/earlier-days"] },
  { href: "/plan", label: "Plan" },
  { href: "/tasks", label: "Tasks" },
  { href: "/rooms", label: "Rooms" },
  {
    href: "/settings",
    label: "Settings",
    includes: ["/schedule", "/notifications", "/home-profile"],
  },
];

function within(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** The destination a page belongs to, or null for pages outside the navigation. */
export function sectionFor(pathname: string): NavHref | null {
  const item = NAV_ITEMS.find(({ href, includes = [] }) =>
    // Every path is within "/", so Today matches only itself and its includes.
    href === "/"
      ? pathname === "/" || includes.some((route) => within(pathname, route))
      : [href, ...includes].some((route) => within(pathname, route)),
  );
  return item?.href ?? null;
}
