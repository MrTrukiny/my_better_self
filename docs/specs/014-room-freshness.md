# 014: Room freshness

- **Status**: Approved
- **Owner**: @mrtrukiny
- **Created**: 2026-10-28

## Goal

The plan says what to clean each day, but not how the home is doing overall. This spec shows a freshness state per room that decays with the time since its tasks were last done, relative to how often they should be. The owner sees at a glance which rooms are fresh and which are falling behind. It is the "Room freshness" item of Phase 2 in [`docs/ROADMAP.md`](../ROADMAP.md#phase-2-smarter-routine).

## User stories

- As the owner, I want to see which rooms are fresh and which are behind, so I know how my home is doing.
- As the owner, I want a room's freshness to go up when I clean it, so my work feels visible.

## Acceptance criteria

- [ ] AC1: Given a room has cleaning tasks, then the rooms list and the room page show its freshness as one of four states, with a label and an icon, not color alone: Fresh, Good, Due, or Overdue.
- [ ] AC2: A room's state comes from its most behind cleaning task, the room's own and its items': with the time since its last completion divided by its frequency, below 0.5 is Fresh, below 1 is Good, below 1.5 is Due, and 1.5 or more is Overdue.
- [ ] AC3: Given the most behind task was never done, then its time counts from when the task was added.
- [ ] AC4: Given I check off a task (today or a past day, spec 013), then its room's freshness updates when I next see the rooms list or the room page. Unchecking reverts it.
- [ ] AC5: The room page also says when the room was last cleaned ("Last cleaned 2 days ago", or "Not cleaned yet"), counting any done cleaning task of the room or its items.
- [ ] AC6: Given a room has no cleaning tasks, then it shows "No tasks yet" instead of a state.
- [ ] AC7: Given I'm offline, then the rooms pages show the freshness from their last saved copy.
- [ ] AC8: The states read well at 360px and on desktop, in light and dark mode, and screen readers announce each room's state with its name ("Kitchen, Due").

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

_Filled in by the `plan-feature` skill after the spec is approved._

### Approach

### Tasks

### Test plan
