# 010: App navigation and settings

- **Status**: Draft
- **Owner**: @mrtrukiny
- **Created**: 2026-10-27

## Goal

The schedule and the calendar connection are hard to find: the only ways in are links inside the week's plan and its empty states, and the home profile is reachable only from the tasks page. On a phone, the top bar is already crowded and Today has no entry of its own, only the logo. This spec gives the app one clear navigation: a tab bar at the bottom on mobile and the same destinations in the top bar on desktop. It also adds a Settings area that groups the schedule, the Google Calendar connection, and the home profile. It serves the single owner described in [`docs/PRODUCT.md`](../PRODUCT.md#target-user), who uses the app mostly as an installed PWA on a phone.

## User stories

- As the owner, I want to reach Today, the plan, tasks, rooms, and settings with one tap from anywhere, so I don't hunt for links.
- As the owner, I want my schedule, calendar connection, and home profile in one Settings place, so I know where to change how the app plans for me.
- As the owner, I want to see which section I'm in, so I don't lose my place.

## Acceptance criteria

- [ ] AC1: Given I'm signed in on a phone (360px wide), then a tab bar fixed at the bottom shows five destinations with an icon and a label: Today, Plan, Tasks, Rooms, and Settings. It stays clear of the home indicator (safe area), and page content is never hidden behind it.
- [ ] AC2: Given I'm signed in on desktop, then the top bar shows the same five destinations as links, and there is no bottom tab bar.
- [ ] AC3: Given I'm on any page, then the destination it belongs to is marked as current, visually and for screen readers. A room page belongs to Rooms, task review to Tasks, and the schedule and home profile pages to Settings.
- [ ] AC4: Given I open Settings, then I see three entries, each with a one-line summary: Schedule (for example "Weekdays 06:30 · 45 min"), Google Calendar ("Connected" or "Not connected"), and Home profile (for example "2 helpers"). Each entry opens its page.
- [ ] AC5: Given I haven't set a schedule yet, then Settings says so in the Schedule entry ("Not set") and it still opens the schedule page. The links to the schedule that exist today in the plan keep working.
- [ ] AC6: Given I'm on the schedule or home profile page, then a back link returns to Settings, and the browser's Back button returns where I came from.
- [ ] AC7: Given I'm offline, then the navigation works as links do today: pages I've opened before load from the device, and others show the offline page. Settings shows its last saved summaries, and the pages behind it keep their current offline behavior.
- [ ] AC8: The navigation works with the keyboard only (a logical tab order, a visible focus ring), in light and dark mode. Each destination has an accessible name, the tab bar is a labeled navigation landmark, and touch targets are at least 44px.

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

_Filled in by the `plan-feature` skill after the spec is approved._

### Approach

### Tasks

### Test plan
