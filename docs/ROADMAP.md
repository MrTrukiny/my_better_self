# Roadmap

Each feature becomes a spec in `docs/specs/` and goes through the workflow in `AGENTS.md` (write-spec, plan-feature, implement-feature, review-changes).

## Phase 1: MVP

Goal: a working daily cleaning routine in Google Calendar, built from a manually mapped home.

| Spec | Feature              | Depends on | Notes                                                                                                          |
| ---- | -------------------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| 001  | Sign-in and data     | none       | Database, Google sign-in restricted to an allowlist, protected app shell (ADR 0004).                           |
| 002  | Home inventory       | 001        | Rooms and items, manual entry.                                                                                 |
| 003  | AI task proposals    | 002        | Gemini proposes tasks, minutes, and frequency per item; review and approve (ADR 0003).                         |
| 004  | Scheduler            | 003        | Deterministic packing into the daily budget, rebalancing of missed work. Pure logic, heavily unit tested.      |
| 005  | Google Calendar sync | 004        | Calendar scopes, dedicated calendar, free/busy overlap warning, daily event upsert, daily cron job (ADR 0002). |
| 006  | Today view and habit | 004        | Today's session, check-off (offline-tolerant), streak.                                                         |

Specs 005 and 006 can be built in parallel once 004 is done.

## Phase 2: Smarter routine

- **Richer item attributes**: size, material, and how dirty an item usually gets, to improve AI estimates.
- **Time calibration**: log actual minutes on completion; adjust estimates.
- **Room freshness**: per-room indicator that decays with time since cleaning.
- **Natural-language adjustments**: "I'm traveling next week", "guests on Saturday, prioritize the living room".
- **Occasional tasks and guest mode**: tasks that only run while something is active. Telling the app "guests are staying" turns on the guest bed's chores (making it, changing the sheets after they leave) until the visit ends.
- **Web push notifications** in addition to calendar reminders.
- **Seasonal or deep-cleaning tasks** with long frequencies.

## Phase 3: Beyond cleaning

- **Home mapping from video**: upload a walkthrough video; Gemini produces the inventory in the same format as the manual one.
- **Other activity types**: personal routines and habits scheduled with the same budget-and-window engine.
- **Calendar management**: broader planning across activities.
- **Sharing**: household members with assigned tasks.
