# 014: Room freshness

- **Status**: Done
- **Owner**: @mrtrukiny
- **Created**: 2026-10-28

## Goal

The plan says what to clean each day, but not how the home is doing overall. This spec shows a freshness state per room that decays with the time since its tasks were last done, relative to how often they should be. The owner sees at a glance which rooms are fresh and which are falling behind. It is the "Room freshness" item of Phase 2 in [`docs/ROADMAP.md`](../ROADMAP.md#phase-2-smarter-routine).

## User stories

- As the owner, I want to see which rooms are fresh and which are behind, so I know how my home is doing.
- As the owner, I want a room's freshness to go up when I clean it, so my work feels visible.

## Acceptance criteria

- [x] AC1: Given a room has cleaning tasks, then the rooms list and the room page show its freshness as one of four states, with a label and an icon, not color alone: Fresh, Good, Due, or Overdue.
- [x] AC2: A room's state comes from its most behind cleaning task, the room's own and its items': with the time since its last completion divided by its frequency, below 0.5 is Fresh, below 1 is Good, below 1.5 is Due, and 1.5 or more is Overdue.
- [x] AC3: Given the most behind task was never done, then its time counts from when the task was added.
- [x] AC4: Given I check off a task (today or a past day, spec 013), then its room's freshness updates when I next see the rooms list or the room page. Unchecking reverts it.
- [x] AC5: The room page also says when the room was last cleaned ("Last cleaned 2 days ago", or "Not cleaned yet"), counting any done cleaning task of the room or its items.
- [x] AC6: Given a room has no cleaning tasks, then it shows "No tasks yet" instead of a state.
- [x] AC7: Given I'm offline, then the rooms pages show the freshness from their last saved copy.
- [x] AC8: The states read well at 360px and on desktop, in light and dark mode, and screen readers announce each room's state with its name ("Kitchen, Due").

## UX notes

- In the rooms list the state is a small badge next to the item count.
- On the room page, the state and the last-cleaned line sit under the room name.
- Whole-home tasks don't belong to any room, so they don't affect freshness.

## Out of scope

- A freshness score or chart for the whole home.
- Using freshness in the scheduler; it keeps using the overdue ratio.
- Freshness for routines.

## Open questions

- None.

---

## Technical plan

### Approach

- **Rule (pure):** `roomFreshness(tasks, today)` in `src/lib/inventory/freshness.ts` takes a room's cleaning tasks (frequency, the day it was added, the day it was last done) and returns its state and last-cleaned day, or null without tasks. A task's age counts from its last done day, or from the day it was added (AC3). Only done counts: a skip postpones a task but doesn't clean the room. `lastCleanedLabel` words the last-cleaned line.
- **Reads:** `getRoomFreshness(now)` in `src/lib/inventory/freshness-queries.ts` reads every room-linked cleaning task with its last done occurrence date, in the owner's time zone (UTC without a schedule), and returns a map by room. It depends on the date and on check-offs, so it isn't cached: the room list and the room page read it after `io()`, inside their existing Suspense boundaries.
- **UI:** `FreshnessBadge` shows the state with a lucide icon and a label (not color alone). The rooms list shows it next to the item count, after the room's name in the link's text, so the link reads "Kitchen, Due, 2 items". The room page shows the badge and "Last cleaned …" under the room name, or "No tasks yet".
- **Offline:** the offline copies' version includes the freshness, so the cached rooms pages refresh whenever it changes (AC7).
- No schema change, no new dependencies.

### Tasks

- [x] T1: Freshness rule and labels. Files: `src/lib/inventory/freshness.ts`, `src/lib/inventory/freshness.test.ts`. Covers: AC2, AC3, AC5, AC6.
- [x] T2: Freshness query. Files: `src/lib/inventory/freshness-queries.ts`. Covers: AC2–AC5.
- [x] T3: Badge, rooms list, and room page. Files: `src/components/inventory/freshness-badge.tsx`, `src/components/inventory/freshness-badge.test.tsx`, `src/components/inventory/room-list.tsx`, `src/app/(app)/rooms/[roomId]/page.tsx`. Covers: AC1, AC5–AC8.
- [x] T4: E2E and docs. Files: `e2e/freshness.spec.ts`, `e2e/support/auth.ts`, `docs/ARCHITECTURE.md`. Covers: AC1–AC8.

### Test plan

- Unit: the thresholds at 0.5, 1, and 1.5, the most behind task deciding, never-done tasks counting from when they were added, skips not counting, no tasks, and the last-cleaned wording (AC2, AC3, AC5, AC6); the badge's label and icon (AC1, AC8).
- E2E: a kitchen whose tasks were added days ago (aged through the test database) shows Overdue and "Not cleaned yet"; checking its most behind task on Today makes it fresher and says "Last cleaned today"; unchecking reverts it; a room without tasks says "No tasks yet"; the list link's accessible name includes the state; offline, the rooms page shows the last copy; 360px and dark mode without console errors (AC1–AC8).
