# 017: AI time and task adjustments

- **Status**: Approved
- **Owner**: @mrtrukiny
- **Created**: 2026-10-28

## Goal

Spec 011 adjusts a task's minutes automatically from the median of its recorded times, but it can't tell why a time was off: a note like "full deep clean, took longer" (spec 016) means the task may need a separate deep variant, not more minutes every time. This spec lets the owner ask the AI to review tasks with recorded times and notes and suggest changes: new minutes, a new frequency, or an extra task (for example a monthly deep version). As with task proposals, the AI only suggests; the owner reviews, edits, and accepts each change, and nothing changes without approval. See "AI proposes, the user decides, code schedules" in [`PRODUCT.md`](../PRODUCT.md) and "Time calibration" in [`ROADMAP.md`](../ROADMAP.md#phase-2-smarter-routine).

## User stories

- As the owner, I want the AI to look at how long my tasks really took and what I noted, so that my tasks match how I actually clean.
- As the owner, I want each suggestion to say why, quoting my times and notes, so that I can judge it quickly.
- As the owner, I want to accept, edit, or discard each suggestion, so that I stay in control of my plan.

## Acceptance criteria

Each criterion is testable and maps to at least one test.

- [ ] AC1: Given at least one cleaning task has 3 or more recorded times, or at least one note, since its minutes were last set by hand, then the Tasks page offers "Suggest adjustments" with how many tasks it will review ("Reviews 4 tasks with recorded times or notes"). Given none qualifies, then it explains "Record times or add notes to get suggestions." and makes no AI request.
- [ ] AC2: When I ask for suggestions, then the AI receives each qualifying task with its estimate, frequency, place, its recorded times with dates, and its notes, and returns zero or more suggestions. Each suggestion is one of: change the minutes, change the frequency, or add a new task for the same place (with its name, minutes, and frequency). Suggestions that fail validation (minutes or frequency out of the usual limits, an unknown task) are dropped.
- [ ] AC3: Then each suggestion shows the task, the change ("10 → 15 min", "Every 7 → 14 days", or "New: Deep clean the oven, 30 min, every 30 days"), and a one or two sentence reason that refers to the times or notes it came from.
- [ ] AC4: Given a suggestion, when I accept it, then the change is applied: new minutes count as set by hand (spec 011 starts calibrating that task again from there), a new frequency applies from the next replan, and a new task joins the plan like an accepted proposal. I can edit the values before accepting, and discard a suggestion instead. Accepting or discarding one leaves the others.
- [ ] AC5: Given the AI finds nothing to change, then the page says "Your tasks match your times. Nothing to adjust." Given the request fails, then I see "Try again", and nothing changes.
- [ ] AC6: Given there are pending suggestions, when I ask again, then they are replaced by the new ones; accepted changes stay. Pending suggestions survive reloads until I accept or discard them.
- [ ] AC7: The review works at 360px and on desktop, in light and dark mode, and with the keyboard only; the busy state is announced, each action button names its task, and asking for suggestions is disabled offline.

## UX notes

- Lives on the Tasks page next to "Propose tasks", as its own section "Adjustments", grouped by room like proposals.
- The reason is shown in full under the change; times and notes it cites appear in muted text ("Last 5: 14, 16, 15, 22, 15 min · Note on Oct 20: full deep clean").
- Editing reuses the task form fields of spec 003.

## Out of scope

- Running suggestions automatically or on a schedule.
- Suggestions that delete, merge, or move tasks between places.
- Changing how automatic calibration (spec 011) works.
- Suggestions for routines.

## Open questions

- None. Decided with the owner: the AI suggests and the owner approves each change; automatic calibration stays as it is.

---

## Technical plan

_Filled in by the `plan-feature` skill after the spec is approved._

### Approach

### Tasks

### Test plan
