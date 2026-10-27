# 010: App navigation and settings

- **Status**: Done
- **Owner**: @mrtrukiny
- **Created**: 2026-10-27

## Goal

The schedule and the calendar connection are hard to find: the only ways in are links inside the week's plan and its empty states, and the home profile is reachable only from the tasks page. On a phone, the top bar is already crowded and Today has no entry of its own, only the logo. This spec gives the app one clear navigation: a tab bar at the bottom on mobile and the same destinations in the top bar on desktop. It also adds a Settings area that groups the schedule, the Google Calendar connection, and the home profile. It serves the single owner described in [`docs/PRODUCT.md`](../PRODUCT.md#target-user), who uses the app mostly as an installed PWA on a phone.

## User stories

- As the owner, I want to reach Today, the plan, tasks, rooms, and settings with one tap from anywhere, so I don't hunt for links.
- As the owner, I want my schedule, calendar connection, and home profile in one Settings place, so I know where to change how the app plans for me.
- As the owner, I want to see which section I'm in, so I don't lose my place.

## Acceptance criteria

- [x] AC1: Given I'm signed in on a phone (360px wide), then a tab bar fixed at the bottom shows five destinations with an icon and a label: Today, Plan, Tasks, Rooms, and Settings. It stays clear of the home indicator (safe area), and page content is never hidden behind it.
- [x] AC2: Given I'm signed in on desktop, then the top bar shows the same five destinations as links, and there is no bottom tab bar.
- [x] AC3: Given I'm on any page, then the destination it belongs to is marked as current, visually and for screen readers. A room page belongs to Rooms, task review to Tasks, and the schedule and home profile pages to Settings.
- [x] AC4: Given I open Settings, then I see three entries, each with a one-line summary: Schedule (for example "Weekdays 06:30 · 45 min"), Google Calendar ("Connected" or "Not connected"), and Home profile (for example "2 helpers"). Each entry opens its page.
- [x] AC5: Given I haven't set a schedule yet, then Settings says so in the Schedule entry ("Not set") and it still opens the schedule page. The links to the schedule that exist today in the plan keep working.
- [x] AC6: Given I'm on the schedule or home profile page, then a back link returns to Settings, and the browser's Back button returns where I came from.
- [x] AC7: Given I'm offline, then the navigation works as links do today: pages I've opened before load from the device, and others show the offline page. Settings shows its last saved summaries, and the pages behind it keep their current offline behavior.
- [x] AC8: The navigation works with the keyboard only (a logical tab order, a visible focus ring), in light and dark mode. Each destination has an accessible name, the tab bar is a labeled navigation landmark, and touch targets are at least 44px.

## UX notes

- **Mobile:** the top bar keeps the app name, the theme toggle, and the account menu, but drops the section links. The tab bar has five equal tabs: an icon above a short label (lucide icons, for example `Sun` for Today, `CalendarDays` for Plan, `ListChecks` for Tasks, `House` for Rooms, `Settings` for Settings). The current tab uses the primary color and a heavier label.
- **Desktop (from the `sm` breakpoint on):** the five links sit in the top bar where Rooms, Tasks, and Plan are now. The current one gets a muted background.
- **Settings page:** a heading and a list of three rows (icon, title, summary, chevron), each a full-width link at least 44px tall. No editing happens on this page.
- **Order:** Today, Plan, Tasks, Rooms, Settings, from daily use to setup.
- The app name stays a link to Today.
- Sign-in, the offline fallback, and the legal pages keep their minimal layout without navigation.

## Out of scope

- Changing what the schedule, calendar, or home profile pages contain, beyond the back link.
- Badges or counts on tabs (for example pending proposals).
- Moving sign-out or the theme toggle into Settings.
- Hiding the tab bar on scroll, or gestures between tabs.
- New settings, such as notifications or account deletion.

## Open questions

- None. Decided with the owner: a bottom tab bar on mobile with the same destinations in the top bar on desktop, and a Settings area grouping Schedule, Google Calendar, and Home profile.

---

## Technical plan

### Approach

- **Destinations (pure):** `src/lib/navigation.ts` holds `NAV_ITEMS` (Today `/`, Plan `/plan`, Tasks `/tasks`, Rooms `/rooms`, Settings `/settings`) and `sectionFor(pathname)`, which maps any path to its destination: `/rooms/*` to Rooms, `/tasks/*` to Tasks, and `/settings`, `/schedule`, and `/home-profile` to Settings.
- **Navigation (client leaf):** `AppNav` in `src/components/app-nav.tsx` reads `usePathname()` and renders the destinations twice: a top-bar list (`hidden sm:flex`) and a bottom tab bar (`sm:hidden`, fixed, with `env(safe-area-inset-bottom)` padding). Only one is displayed at a time, so each is a `nav` landmark labeled "Main", and the current link gets `aria-current="page"`. Links stay `OfflineAwareLink`. With Cache Components, `usePathname` suspends on routes with unknown params (`/rooms/[roomId]`), so `AppShell` wraps it in `Suspense` with the same links and nothing marked current as the fallback. On mobile, `main` gets bottom padding so content clears the tab bar.
- **Settings page (Server Component):** `/settings` in the `(app)` group shows three link rows. Each summary loads in its own Suspense boundary from the existing queries (`getScheduleSettings`, `getCalendarConnection`, `getHomeProfile`), and pure formatters in `src/lib/settings/summary.ts` turn them into one line. The Google Calendar row opens `/schedule#calendar`.
- **Schedule summary rule:** "Not set" without saved settings; "No cleaning days" when every day is off; otherwise the days ("Every day", "Weekdays", "Weekends", or "N days a week"), the start time when every cleaning day shares it, and the minutes (one value, or "45–60 min" when weekday and weekend budgets both apply and differ).
- **Back links:** the schedule and home profile pages get a "Settings" back link like the room page's "All rooms".
- **Offline:** `/settings` joins `OFFLINE_DOCUMENT_ROUTES` in `sw.ts`. The settings page warms its own copy, and the schedule page and `TasksCacheWarmer` add `/settings` to the copies they refresh, so the summaries follow saved changes. The calendar summary refreshes the next time Settings is opened online.
- No new dependencies, data, or ADR.

### Tasks

- [x] T1: Destinations and sections: `NAV_ITEMS` and `sectionFor`. Files: `src/lib/navigation.ts`, `src/lib/navigation.test.ts`. Covers: AC3.
- [x] T2: Navigation UI: `AppNav` with the top-bar list and the bottom tab bar, current marking, and `AppShell` using it with a Suspense fallback and mobile bottom padding. Files: `src/components/app-nav.tsx`, `src/components/app-nav.test.tsx`, `src/components/app-shell.tsx`. Covers: AC1, AC2, AC3, AC8.
- [x] T3: Settings summaries: schedule, calendar, and home profile one-liners. Files: `src/lib/settings/summary.ts`, `src/lib/settings/summary.test.ts`. Covers: AC4, AC5.
- [x] T4: Settings page and back links, plus its offline copy. Files: `src/app/(app)/settings/page.tsx`, `src/app/(app)/schedule/page.tsx`, `src/app/(app)/home-profile/page.tsx`, `src/components/calendar/calendar-section.tsx` (anchor id), `src/components/tasks/tasks-cache-warmer.tsx`, `src/app/sw.ts`. Covers: AC4, AC5, AC6, AC7.
- [x] T5: E2E and docs: tab bar on mobile and top links on desktop with the current section, Settings summaries and links, back links, Settings offline, keyboard and dark mode. `docs/ARCHITECTURE.md` (routes and the app shell). Files: `e2e/navigation.spec.ts`, `docs/ARCHITECTURE.md`. Covers: AC1–AC8.

### Test plan

- Unit: `sectionFor` for every route, including nested ones (AC3); `AppNav` names, order, and `aria-current` (AC1, AC2, AC3, AC8); summaries for not set, all days off, every day, weekdays, mixed times and budgets, calendar states, and helper counts (AC4, AC5).
- E2E: at 360px, the tab bar shows five tabs, marks the current one, and doesn't hide the page's last content; on desktop, the top bar has the links and there's no tab bar (AC1, AC2, AC3). Settings shows "Not set", "Not connected", and "No helpers" for a new owner, then the saved schedule's summary; each row opens its page, and the back link returns (AC4, AC5, AC6). Settings opens offline with its summaries (AC7). Tabbing through the navigation in dark mode without console errors (AC8).
