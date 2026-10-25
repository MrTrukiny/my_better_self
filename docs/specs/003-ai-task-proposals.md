# 003: AI task proposals

- **Status**: Draft
- **Owner**: @mrtrukiny
- **Created**: 2026-10-25

## Goal

Turn the home inventory (spec 002) into a reviewed list of cleaning tasks without the owner having to work out what to clean, how long it takes, or how often. Gemini proposes tasks at three levels:

- **Item tasks**: "Clean the kitchen windows".
- **Room tasks**: a quick "Bathroom surface clean" and a less frequent "Bathroom deep clean".
- **Home-wide routines**: "Make the bed", "Wash the dishes", "Do the laundry".

The proposals take the home's helpers into account. With a robot vacuum, for example, floor tasks cover only the corners and edges it can't reach. The owner reviews every proposal; nothing becomes a task without approval. See "AI task proposals" in [`PRODUCT.md`](../PRODUCT.md#mvp-phase-1) and the principle "AI proposes, the user decides, code schedules".

## User stories

- As the owner, I want to tell the app which cleaning helpers I have (robot vacuum, dishwasher...) and anything else about my home, so that proposals fit how I actually clean.
- As the owner, I want the AI to propose tasks for my items, my rooms, and my home as a whole, with minutes and a frequency, so that I don't have to plan them myself.
- As the owner, I want a mix of small, specific tasks and broader ones (surface clean vs deep clean), so that work fits into short daily sessions.
- As the owner, I want to accept, edit, or discard each proposal, so that I stay in control of what ends up in my routine.
- As the owner, I want daily chores like making the bed kept as routines, separate from the 30-minute cleaning budget, so that they don't crowd out actual cleaning.
- As the owner, I want to propose again after changing my inventory without getting duplicates of tasks I already have.

## Acceptance criteria

Each criterion is testable and maps to at least one test.

- [ ] AC1: Given I open the home profile, when I mark helpers from a fixed list (robot vacuum, dishwasher, washing machine, dryer, other) and write an optional note of up to 500 characters, then they are saved and shown the next time I open it; a longer note shows a field message and is not saved.
- [ ] AC2: Given I have at least one room with items, when I choose "Propose tasks", then I see a busy state that can't be triggered twice, followed by a proposal list grouped by room, with a "Whole home" group. Each proposal shows a name, what it belongs to (an item, a room, or the whole home), estimated minutes, a frequency, and whether it is a cleaning task or a routine. Given I have no rooms, the action is unavailable and explains that the inventory comes first.
- [ ] AC3: Given the proposals are shown, then:
  - Every cleaning task takes 1 to 30 minutes, so it fits in one daily session. Bigger jobs come as several smaller tasks.
  - Every frequency is a whole number of days from 1 to 365.
  - Proposals that the response doesn't link to one of my rooms or items are not shown.
- [ ] AC4: Given I marked helpers or wrote a note, when proposals are generated, then they reflect it. For example, with a robot vacuum marked, floor tasks cover only the spots it can't reach instead of full vacuuming. With a dishwasher, dish tasks are about loading and unloading it.
- [ ] AC5: Given a proposal list, when I accept, edit (name, minutes, frequency, cleaning task or routine), or discard each proposal, or choose "Accept all", then accepted proposals become tasks and discarded ones disappear. Nothing is accepted by default, and leaving the page keeps the pending proposals for later.
- [ ] AC6: Given I already have tasks, when I propose again, for the whole home or for a single room, then the new proposals don't repeat existing tasks, and the existing tasks are unchanged.
- [ ] AC7: Given I have tasks, when I open the task list, then I see the cleaning tasks grouped by room and "Whole home", and the routines in their own section, each with minutes and frequency. I can edit or delete each task, and deleting asks for confirmation.
- [ ] AC8: Given the AI request fails, times out, or returns something invalid, then I see a message with "Try again" and nothing is saved. Given I am offline, "Propose tasks" and all edits are disabled with a visible reason, and the task list and pending proposals stay readable.
- [ ] AC9: The home profile, the proposal review, and the task list work at 360px wide and on desktop, in light and dark mode, and with the keyboard only. Every control and list has an accessible name, and completion of a generation is announced to screen readers.

## UX notes

- **Entry points:** the room list and each room page offer "Propose tasks", for the whole home or for that room. A "Tasks" link in the header opens the task list. The home profile is reachable from the task list and from the proposal screen ("Tell us about your home").
- **Review screen:** proposals are grouped like the task list. Each one is a compact card with accept and discard buttons, plus an edit action that opens the same sheet or dialog pattern as the inventory forms. A sticky "Accept all" bar sits at the bottom on mobile.
- **Granularity:** the prompt asks for a mix of tasks:
  - Small, specific item tasks ("Wipe the bathroom mirror", 3 min, every 7 days).
  - Room-level passes at two depths ("Bathroom surface clean", 10 min, every 3 days; "Bathroom deep clean", 30 min, every 30 days).
  - Home-wide routines.
- **Routines** are chores with their own frequency, from daily ("Make the bed") to every few days ("Do the laundry"). They are tracked outside the daily cleaning budget. This spec only proposes and stores them; showing and checking them off daily belongs to the Today view (spec 006).
- **Loading:** generating can take several seconds. Show progress text ("Reading your inventory...", then "Proposing tasks...") rather than a bare spinner.
- **Errors:** keep the user's context (selected scope, profile) and offer "Try again".
- **Offline:** online-only for generating and editing, read-only otherwise, consistent with spec 002.

## Out of scope

- Scheduling tasks into daily sessions (spec 004) or the calendar (spec 005).
- Showing or checking off routines and tasks day to day (spec 006).
- Calibrating minutes from actual completion times, and natural-language adjustments (later phases).
- Re-proposing or changing tasks automatically when the inventory changes; proposing again is always the owner's action.
- Size, material, or dirtiness attributes of items (phase 2), and photos or video (phase 3).
- Choosing the AI model or provider from the UI (ADR 0003 sets it by configuration).

## Open questions

- None.

---

## Technical plan

_Filled in by the `plan-feature` skill after the spec is approved._
