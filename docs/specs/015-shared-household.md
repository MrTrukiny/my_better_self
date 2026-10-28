# 015: Shared household

- **Status**: Draft
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

_Filled in by the `plan-feature` skill after the spec is approved._

### Approach

### Tasks

### Test plan
