# 015: Shared household

- **Status**: In progress
- **Owner**: @mrtrukiny
- **Created**: 2026-10-28

## Goal

The app is for a single owner today, but people who live together clean the same home. This spec lets the owner invite the people they live with by email. Everyone shares the home's rooms, items, and tasks; each person keeps their own schedule, daily budget, Today page, streak, and Google Calendar; and the app splits the tasks between them automatically, in proportion to each person's available minutes. It moves "multi-user households" out of the non-goals in [`docs/PRODUCT.md`](../PRODUCT.md#non-goals-for-now) and needs an ADR for the data model and access rules.

## User stories

- As the owner, I want to invite the person I live with by email, so we manage the same home.
- As a member, I want my own schedule and calendar, so the plan fits my time.
- As a member, I want the work split fairly by the time each of us has, so nobody carries the home alone.

## Acceptance criteria

- [ ] AC1: Given I'm the owner, then Settings has a Household entry where I can invite someone by email, see who is a member or invited, cancel an invitation, and remove a member. A household has at most 5 people.
- [ ] AC2: Given I was invited, when I sign in with Google using that email, then I join the household and see its rooms, items, and tasks. People who aren't invited still can't sign in.
- [ ] AC3: Members can add and edit rooms, items, and tasks, review proposals, and edit the home profile. Only the owner can invite, cancel invitations, and remove members.
- [ ] AC4: Each member has their own schedule (start times and budgets), Today page, streak, recorded times, and Google Calendar connection, and sets them up as the owner does today.
- [ ] AC5: The plan gives each task occurrence to one member, balancing each person's share of the planned minutes over the week to their share of the available minutes, and never exceeding anyone's daily budget. A member without a schedule gets no tasks.
- [ ] AC6: Today, the plan, and each member's calendar show only that member's tasks. The plan page can also show the whole household's week, with each task labeled with its person.
- [ ] AC7: Given a member leaves or is removed, then their future tasks are replanned among the others, their own data (schedule, calendar connection, history) is deleted, and the shared home stays.
- [ ] AC8: The household page works at 360px and on desktop, in light and dark mode, and with the keyboard only; removing a member asks for confirmation.

## UX notes

- The invitation is just an entry in the household; no email is sent by the app in this spec. The owner tells the person to sign in.
- Members appear with their name and photo from Google once they join, and "Invited" before that.
- The owner's existing data becomes the household's data when the feature ships; nothing changes for a single-person household.

## Out of scope

- Assigning a task to a person by hand, or rotating tasks.
- Sending invitation emails.
- Several households per person, or transferring ownership.
- Chat, comments, or notifications between members.

## Open questions

- None. Decided with the owner: tasks are balanced automatically by available minutes, and each person has their own schedule, budget, and calendar.

---

## Technical plan

Decisions in [ADR 0011](../decisions/0011-shared-household.md).

### Approach

- **Data:** the household is its owner. Shared tables keep `user_id`, which now means the household (the owner's id), so existing data stays as it is. Personal tables keep the person's own id; an occurrence's `user_id` is the member it was given to. A new `household_member` table (migration `0011`) holds the invitations and memberships.
- **Access:** `getCurrentUser()` returns `householdId` and `role`. Every shared query and action switches from `user.id` to `user.householdId`, which covers rooms, items, tasks, proposals, adjustments, home profile, freshness, and calibration. Personal ones keep `user.id`. Owner-only actions check `role`. Shared cache tags are keyed by the household.
- **Sign-in:** the Better Auth hooks allow `ALLOWED_EMAILS` or an invited email, link the invitation when the account is created, and refuse sessions for people on neither list.
- **Planner (pure):** `schedule()` takes `people` (id, budgets, and the first day each may take new work) instead of one set of budgets. Each day packs into per-person bins: a cleaning task goes to the person with room whose planned share is lowest against their available share, and routines go to the person with the fewest routine minutes, preferring people with a session that day. With one person, the output is unchanged; the existing scheduler tests guard that.
- **Replanning:** `replan(householdId)` and `ensurePlan` lock every member's settings and keep each person's own start day. On frozen days, a person's planned occurrences stay and count as handled for the others. Rows are written per person, and every member's calendar is synced afterwards. Call sites pass `householdId`. The daily job plans each household once, then syncs each connected person.
- **Household page:** `/household`, linked from Settings as "Household", is a Server Component with client leaves. The owner sees a form to invite by email, the list of members (name and photo) and invited people, a confirmation dialog for cancelling an invitation or removing a member, and the 5-person limit. A member sees the list and "Leave household". Mutations are Server Actions that check `role`. The page is readable offline, and changes are disabled offline.
- **Plan:** the plan page shows the signed-in person's week. In a household with more than one person, a "Household" toggle (`?view=household`) shows everyone's occurrences labeled with each person's first name.

### Tasks

- [ ] T1: Membership data and sign-in. The `household_member` table and migration `0011`, membership rules (normalized email, 5-person limit, who may sign in), `getCurrentUser()` with `householdId` and `role`, and the Better Auth hooks. Files: `src/db/schema/household.ts`, `drizzle/0011_*.sql`, `src/lib/household/{rules,queries}.ts` (+ test), `src/lib/session.ts`, `src/lib/auth.ts`. Covers: AC1, AC2.
- [ ] T2: Shared data by household: inventory, tasks, proposals, adjustments, home profile, freshness, and calibration use `householdId`; cache tags follow it. Files: `src/lib/{inventory,tasks}/*queries.ts`, `src/lib/tasks/calibrate.ts`, `src/app/(app)/{rooms,tasks,tasks/adjustments,home-profile}/**/actions.ts` and pages, `src/app/(app)/actions.ts`. Covers: AC2, AC3.
- [ ] T3: Planner for several people: per-person bins, balancing by available minutes, per-person start day, and routines. Files: `src/lib/scheduler/schedule.ts` (+ test). Covers: AC5.
- [ ] T4: Household replanning, with every member's settings locked, frozen days kept, rows per person, every member's calendar synced, and the daily job. Files: `src/lib/scheduler/plan.ts`, `src/lib/scheduler/household-range.ts` (+ test), `src/app/api/cron/daily/route.ts`, the callers of `replan` and `replanAfterChange`. Covers: AC4, AC5, AC6.
- [ ] T5: Household page and actions: invite, cancel, remove, and leave (removing or leaving deletes the person and replans), plus the Settings row. Files: `src/app/(app)/household/{page,actions}.ts(x)`, `src/components/household/*` (+ tests), `src/app/(app)/settings/page.tsx`. Covers: AC1, AC3, AC7, AC8.
- [ ] T6: Plan household view with person labels. Files: `src/lib/scheduler/queries.ts`, `src/app/(app)/plan/page.tsx`, `src/components/plan/*` (+ tests). Covers: AC6.
- [ ] T7: E2E and docs. Files: `e2e/household.spec.ts`, `e2e/support/auth.ts` (add a member), `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`. Covers: AC1 to AC8.

### Test plan

- Unit: membership rules (email normalization, limit, sign-in decision) (AC1, AC2); planner: one person unchanged, two people split by available minutes, nobody over budget, a frozen person keeps their day, routines spread, nobody planned without a schedule (AC5); household range per person (AC4, AC5); household page states for the owner and a member, confirmation dialogs, limit, and offline (AC1, AC3, AC8); plan labels in the household view (AC6).
- E2E (CI): the owner invites a member, who then sees the shared rooms and tasks; each has their own schedule; Today shows each person only their own tasks and the household plan shows both, labeled; a member can edit a task but sees no invite controls; removing the member asks for confirmation, after which the owner gets all the tasks; 360px dark mode with the keyboard only and no console errors (AC1 to AC8).
