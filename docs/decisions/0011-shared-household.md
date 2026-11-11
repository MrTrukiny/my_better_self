# 0011: Shared household

- **Status**: Accepted
- **Date**: 2026-11-11

## Context

Spec 015 lets the owner invite up to 4 people who live with them. Everyone shares the home's rooms, items, tasks, proposals, adjustments, and home profile. Each person keeps their own schedule, plan, Today page, streak, recorded times, notes, calendar connection, and notifications. The planner splits the tasks between the people who have a schedule. Today every table carries a `user_id`, and ADR 0004 chose that so sharing wouldn't need a data migration. Sign-in is limited to `ALLOWED_EMAILS`.

## Decision

- **The household is its owner.** A household is identified by its owner's user id; there is no `household` table. On shared tables (`room`, `item`, `task`, `task_proposal`, `task_adjustment`, `home_profile`), `user_id` now means "the household", which is the owner's id for every member. Existing data needs no migration: a single owner is already a one-person household. Transferring ownership is out of scope, so the id never changes.
- **Personal tables keep the person's own id:** `schedule_settings`, `occurrence`, `calendar_connection`, `calendar_day`, `notification_settings`, `notification_log`, and `push_subscription`. An occurrence's `user_id` is the member the planner gave it to, while its `task_id` points at a shared task.
- **Membership:** a new table `household_member` (migration `0011`) has one row per invited person: the owner's id, the email (unique, since a person belongs to at most one household), the member's user id once they join (unique, cascade on delete), and the invite and join times. The owner has no row. A household has at most 5 people (the owner plus 4 rows).
- **Resolving the user:** `getCurrentUser()` also returns `householdId` (the owner's id, or the user's own id when they have no membership row) and `role` (`owner` or `member`). Shared reads and writes use `householdId`; personal ones use `id`. The membership is read with the session in the same private cache, so a change can take up to that cache's lifetime (minutes) to show for the affected person.
- **Sign-in:** an email may sign in when it is on `ALLOWED_EMAILS` (owners) or has a `household_member` row. `user.create.before` checks this; `user.create.after` links the row to the new user. `session.create.before` refuses a user who is on neither list, so a removed member can't sign back in. Inviting someone who already has an account is refused, since they have their own home.
- **Leaving:** removing a member, or a member leaving, deletes their membership row and their user. The cascade deletes their sessions, schedule, occurrences (past and future), calendar connection, and notification data; the shared home stays. Then the household is replanned. Their Google "Cleaning" calendar isn't deleted, because their tokens go with them.
- **Planning:** the scheduler (ADR 0007) plans the household's tasks once for every person with a schedule. Each day's capacity is the sum of those people's budgets. Every picked cleaning task goes to one person who still has room that day; among them, it goes to the one whose share of the planned minutes over the range is furthest below their share of the available minutes. So no daily budget is exceeded, and the split follows available time. Routines are outside the budgets and go to the person with the fewest routine minutes so far, preferring people with a session that day. With one person, the plan is exactly what it was.
- **Replanning is per household:** `replan` and `ensurePlan` take the household id and lock every member's settings row in user id order, so concurrent replans run one at a time without deadlocks. Each person keeps their own first replan day (today, or tomorrow once their session started, ADR 0008). On days before a person's start, that person keeps their planned occurrences, which count as handled for the others' plan, and takes no new work. After a replan, every member's calendar is synced.
- **Shared history:** calibration (ADR 0009), freshness (spec 014), and adjustments (spec 017) read the times and completions of a task from every member, because the task is shared.

## Consequences

- Most changes are a switch from `user.id` to `user.householdId` in shared queries, plus the planner's per-person budgets.
- Shared cache tags (`tasks:`, `inventory:`) are keyed by the household, so one member's edit refreshes everyone's cached reads.
- A member's own history leaves with them, so calibration and freshness lose their times. The spec asks for this.
- The column name `user_id` on shared tables is now a misnomer. Renaming it would need a migration of every table and every query for no behavior change, so the meaning is documented on the schema instead.
- Members may live in different time zones. Each person's days follow their own time zone, but occurrences are stored by date, so a task planned for one date is that date for everyone.

## Alternatives considered

- **A `household` table and a `household_id` column on every shared table:** cleaner names, but it needs a migration of every shared table and every query, and has the same behavior while ownership can't move.
- **Planning each person separately with a fixed split of the tasks:** simpler, but it can't balance a week or use spare minutes from one person's long day.
