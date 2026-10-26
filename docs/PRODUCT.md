# Product

## Vision

**My Better Self** turns keeping a home clean into a small daily habit. You describe your home once; AI proposes the cleaning tasks, how long each one takes, and how often it is needed. The app then spreads them into one 45-minute session per day, placed in a free slot of your Google Calendar, so cleaning never piles up.

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
- **Scheduler**: a deterministic algorithm packs due tasks into a daily budget (45 minutes on weekdays and 60 on weekends by default), prioritizing the most overdue relative to their frequency. Missed work is rebalanced over the following days without exceeding the daily budget.
- **Google Calendar sync**: one event per day ("Cleaning, 45 min") in a dedicated calendar the app creates, placed at the start time the user picks for that day, with the task checklist in the description and a link to the app.
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
- **Small and steady beats big and rare.** The daily budget (45 minutes by default) is a hard limit.
- **Forgiving by design.** Missing a day never creates a backlog spike; work is redistributed.
- **Respect the calendar.** The app writes only to its own calendar and only reads free/busy information from the others.
- Mobile-first and installable; works well on a 360px-wide screen and degrades gracefully offline.
- Accessible by default (WCAG 2.2 AA).

## Glossary

| Term                  | Meaning                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Home**              | The place being managed. One per user for now.                                                                                                                                       |
| **Room**              | A space in the home (kitchen, bedroom, bathroom, hallway...).                                                                                                                        |
| **Item**              | Something in a room that needs cleaning (window, closet, shelf, desk, mirror, floor...). Has a type, a name, a count, and an optional note. See the item fields below.               |
| **Task**              | A unit of work with estimated minutes and a frequency, such as "Dust bedroom shelves". It belongs to an item, a room, or the whole home, and is either a cleaning task or a routine. |
| **Routine**           | A recurring chore, such as "Make the bed" or "Do the laundry", tracked outside the daily cleaning budget.                                                                            |
| **Frequency**         | How often a task should be done, in days (for example every 7 or every 30 days).                                                                                                     |
| **Due date**          | Last completion date plus frequency. It moves forward from when the task was actually done, not from a fixed calendar.                                                               |
| **Overdue ratio**     | Days past due divided by frequency. The scheduler's priority signal.                                                                                                                 |
| **Proposal**          | An AI-suggested task awaiting the owner's review. Accepting it turns it into a task.                                                                                                 |
| **Home profile**      | What the AI should know about the home: the helpers it has and a free-text note.                                                                                                     |
| **Helper**            | A device that does part of the cleaning, such as a robot vacuum or a dishwasher. Helpers change which tasks are proposed.                                                            |
| **Occurrence**        | One instance of a task assigned to a specific day. Status: scheduled, done, or skipped.                                                                                              |
| **Session**           | The set of occurrences for one day, within the daily budget. Maps to one calendar event.                                                                                             |
| **Daily budget**      | Maximum minutes of cleaning per day: one value for weekdays (default 45) and one for weekends (default 60).                                                                          |
| **Start time**        | When the daily session begins, set per day of the week (default 06:30). Days can be turned off.                                                                                      |
| **Scheduling window** | Later: hours in which the app may look for a free slot in the calendar, mornings first.                                                                                              |
| **Streak**            | Consecutive cleaning days on which every cleaning task was done or skipped (not all skipped). Days off don't break it; routines don't count.                                         |

**Item fields.**

- **Type**: one of a fixed list (window, door, mirror, floor, rug, light fixture, shelf, desk, table, sofa, bed, closet, cabinet, countertop, appliance, sink, toilet, shower, bathtub, other). It drives the icon now and the AI prompt later.
- **Name**: defaults to the type's label, up to 60 characters.
- **Count**: a whole number from 1 to 99. It is shown as "Window x3".
- **Note**: optional, up to 200 characters.
