# Product

## Vision

**My Better Self** turns keeping a home clean into a small daily habit. You describe your home once; AI proposes the cleaning tasks, how long each one takes, and how often it is needed. The app then spreads them into one 30-minute session per day, placed in a free slot of your Google Calendar, so cleaning never piles up.

It starts as a cleaning planner and is meant to grow into a broader personal time and calendar manager.

## Target user

A single person (the owner) managing their own home:

- Uses Google Calendar as the source of truth for their time.
- Plans on desktop, executes on the phone (installed PWA).
- Wants a routine without having to think about what to clean next.

The app is single-user for now. The data model keeps an owner on every record so that sharing with household members can be added later.

## Core problems

1. **Cleaning accumulates.** Without a plan, tasks are done only when they become urgent, which turns them into long, exhausting sessions.
2. **Deciding what to clean is overhead.** Remembering when the windows or the closets were last cleaned is mental load.
3. **Estimates are hard.** It is not obvious how long a task takes or how often it should be done.
4. **Habits break.** One missed day often derails a routine entirely.

## Key features

### MVP (phase 1)

- **Home inventory**: register rooms and the items in them (windows, closets, bathrooms, tables, shelves, desks...) Each item has a type, a name, a count, and an optional note.
- **AI task proposals**: for each item, Gemini proposes cleaning tasks with an estimated duration and frequency. Big tasks are split per item so each fits in a session. The user reviews, edits, and approves; nothing is scheduled without approval.
- **Scheduler**: a deterministic algorithm packs due tasks into a daily budget of 30 minutes, prioritizing the most overdue relative to their frequency. Missed work is rebalanced over the following days without exceeding the daily budget.
- **Google Calendar sync**: one event per day ("Cleaning, 30 min") in a dedicated calendar the app creates, placed in a free slot within a user-defined window, with the task checklist in the description and a link to the app.
- **Today view and habit**: see today's session, check tasks off (on the phone, even with a flaky connection), and keep a daily streak.

### Later

See [`ROADMAP.md`](ROADMAP.md): richer item attributes (size, material), time calibration, room freshness, natural-language adjustments, web push, home mapping from video, other activities, sharing.

## Non-goals (for now)

- Multi-user households, task assignment between people, or social features.
- Calendars other than Google Calendar.
- AI deciding and scheduling without review.
- Native mobile apps; the PWA is the mobile experience.
- Shopping lists or cleaning-supply inventory.

## Principles

- **AI proposes, the user decides, code schedules.** AI output is a suggestion validated against a schema; scheduling is plain, testable code that can explain its choices.
- **Small and steady beats big and rare.** The daily budget (30 minutes by default) is a hard limit.
- **Forgiving by design.** Missing a day never creates a backlog spike; work is redistributed.
- **Respect the calendar.** The app writes only to its own calendar and only reads free/busy information from the others.
- Mobile-first and installable; works well on a 360px-wide screen and degrades gracefully offline.
- Accessible by default (WCAG 2.2 AA).

## Glossary

| Term                  | Meaning                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home**              | The place being managed. One per user for now.                                                                                              |
| **Room**              | A space in the home (kitchen, bedroom, bathroom, hallway...).                                                                               |
| **Item**              | Something in a room that needs cleaning (window, closet, shelf, desk, mirror, floor...). Has a type, a name, a count, and an optional note. |
| **Task**              | A cleaning action on an item, such as "Dust bedroom shelves". Has estimated minutes and a frequency.                                        |
| **Frequency**         | How often a task should be done, in days (for example every 7 or every 30 days).                                                            |
| **Due date**          | Last completion date plus frequency. It moves forward from when the task was actually done, not from a fixed calendar.                      |
| **Overdue ratio**     | Days past due divided by frequency. The scheduler's priority signal.                                                                        |
| **Proposal**          | An AI-generated set of tasks awaiting user review.                                                                                          |
| **Occurrence**        | One instance of a task assigned to a specific day. Status: scheduled, done, or skipped.                                                     |
| **Session**           | The set of occurrences for one day, within the daily budget. Maps to one calendar event.                                                    |
| **Daily budget**      | Maximum minutes of cleaning per day (default 30).                                                                                           |
| **Scheduling window** | Hours in which the session may be placed, per weekday.                                                                                      |
| **Streak**            | Consecutive days with the session completed.                                                                                                |

## Open questions

Answer these before the scheduler spec (004) is approved:

- **Scheduling windows**: default hours per weekday (for example weekdays 18:00 to 21:00, weekends 9:00 to 13:00) and any days off.
- **Rest days and weekends**: should there be rest days, or a different budget on weekends?
- **"Completed" threshold for the streak**: does it require all of the day's tasks, or is a partial session enough?
