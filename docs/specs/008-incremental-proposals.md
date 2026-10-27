# 008: Incremental task proposals

- **Status**: Draft
- **Owner**: @mrtrukiny
- **Created**: 2026-10-27

## Goal

When the owner adds a room or an item and asks for proposals again, only the new things should get proposals. Today the whole inventory goes back to the AI and pending proposals of that scope are replaced, so a request after a small change can reshuffle work the owner already reviewed. With this spec, proposing again leaves accepted tasks and pending proposals exactly as they are and asks the AI only about rooms and items that have neither. Amends AC6 of [spec 003](003-ai-task-proposals.md); see "AI task proposals" in [`PRODUCT.md`](../PRODUCT.md#mvp-phase-1).

## User stories

- As the owner, I want to add a room or an item and get proposals only for it, so that what I already reviewed stays the same.
- As the owner, I want to know when there's nothing new to propose for, so that I don't wait for an AI request that can't help.
- As the owner, I want to get fresh proposals for something by discarding its pending ones, so that I can redo a single item without touching the rest.

## Acceptance criteria

Each criterion is testable and maps to at least one test.

- [ ] AC1: Given some rooms and items already have tasks or pending proposals, when I propose for the whole home, then proposals appear only for rooms and items that have neither. Accepted tasks are unchanged, and every pending proposal from before is still there, unchanged.
- [ ] AC2: Given I added an item to a room that already has room tasks (its quick and deep passes), when I propose, then I get proposals for the new item and none for the room itself. Given I added a new room with items, then I get room tasks for it and tasks for each of its items.
- [ ] AC3: Given the whole home already has home-wide routines (tasks or pending proposals targeting "Whole home"), when I propose for the whole home, then no new home-wide routines are proposed.
- [ ] AC4: Given I propose for a single room, then the same rule applies within that room: only its items, or the room itself, that have no tasks and no pending proposals get proposals.
- [ ] AC5: Given every room and item already has tasks or pending proposals, when I open the proposals page, then "Propose tasks" explains "Everything already has tasks. Add a room or an item, or discard proposals to get new ones." and no AI request is made.
- [ ] AC6: Given I discard all pending proposals of an item (or delete all its tasks), when I propose again, then that item gets new proposals, and nothing else changes.
- [ ] AC7: Given the AI request fails, then I see "Try again", and the pending proposals from before are untouched. The busy, empty, and offline states, and keyboard and screen reader access, stay as in spec 003, at 360px and on desktop.

## UX notes

- The proposals page says what will be covered before the request: "Proposes tasks for 2 new items and 1 new room." when there is something new, or the AC5 message when there isn't.
- New proposals join the list alongside the pending ones, in the same room groups.

## Out of scope

- Detecting edits to an existing item (a renamed item or a changed count or note) and re-proposing for it. Discarding its proposals or deleting its tasks, as in AC6, covers that.
- Suggesting missing tasks for rooms and items that already have some.
- Proposing automatically when the inventory changes.

## Open questions

- None. Decided with the owner: only rooms and items with no tasks and no pending proposals go to the AI.

---

## Technical plan

_Filled in by the `plan-feature` skill after the spec is approved._
