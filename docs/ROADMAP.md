# Roadmap

Each feature becomes a spec in `docs/specs/` and goes through the workflow in `AGENTS.md` (write-spec, plan-feature, implement-feature, review-changes).

## Phase 1: MVP

Goal: a working daily cleaning routine in Google Calendar, built from a manually mapped home.

| Spec | Feature | Depends on | Notes |
| --- | --- | --- | --- |
| 001 | Home inventory | none | Rooms and items, manual entry. Also introduces the database and Google sign-in (ADR 0004). |
| 002 | AI task proposals | 001 | Gemini proposes tasks, minutes, and frequency per item; review and approve (ADR 0003). |
| 003 | Scheduler | 002 | Deterministic packing into the daily budget, rebalancing of missed work. Pure logic, heavily unit tested. |
| 004 | Google Calendar sync | 003 | Dedicated calendar, free/busy slot search, daily event upsert, daily cron job (ADR 0002). |
| 005 | Today view and habit | 003 | Today's session, check-off (offline-tolerant), streak. |

Specs 004 and 005 can be built in parallel once 003 is done.

## Phase 2: Smarter routine

- **Time calibration**: log actual minutes on completion; adjust estimates.
- **Room freshness**: per-room indicator that decays with time since cleaning.
- **Natural-language adjustments**: "I'm traveling next week", "guests on Saturday, prioritize the living room".
- **Web push notifications** in addition to calendar reminders.
- **Seasonal or deep-cleaning tasks** with long frequencies.

## Phase 3: Beyond cleaning

- **Home mapping from video**: upload a walkthrough video; Gemini produces the inventory in the same format as the manual one.
- **Other activity types**: personal routines and habits scheduled with the same budget-and-window engine.
- **Calendar management**: broader planning across activities.
- **Sharing**: household members with assigned tasks.
