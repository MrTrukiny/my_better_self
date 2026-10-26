# 0006: Task scopes and routines

- **Status**: Accepted
- **Date**: 2026-10-25

## Context

The original domain model attached every task to an item. While specifying AI proposals (spec 003), the owner described work that doesn't belong to one item:

- **Room passes**, like a quick "Bathroom surface clean" and a monthly "Bathroom deep clean".
- **Home-wide chores**, like doing the laundry or washing the dishes.
- **Daily habits**, like making the bed, that shouldn't compete with cleaning for the daily cleaning budget.

## Decision

- **A task has a scope derived from its links.** `task` has an optional `roomId` and an optional `itemId`:
  - An item task has both.
  - A room task has only `roomId`.
  - A home task has neither.

  There is no separate `scope` column that could disagree with the links. Deleting a room or an item cascades to its tasks.
- **A task has a kind**, either `cleaning` or `routine`:
  - Cleaning tasks take 1 to 30 minutes and are what the scheduler (spec 004) packs into the daily budget.
  - Routines have their own frequency, are tracked outside the budget, and are checked off in the Today view (spec 006).
- **Pending AI proposals are stored** in a `task_proposal` table with the same shape as `task`, so review can be interrupted and resumed. Accepting one moves it to `task`.
- **Home context lives in `home_profile`**, one row per user:
  - Helpers come from a fixed list validated in code (stored as a text array), like item types.
  - A free-text note covers anything else.

## Consequences

- The scheduler and the Today view must treat routines separately from the budget.
- Task names are not unique, but proposals that duplicate an existing task (same normalized name and target) are dropped before they are shown.
- A `home` table, when sharing arrives, can take over `home_profile` without changing tasks, because every row already carries `userId`.
