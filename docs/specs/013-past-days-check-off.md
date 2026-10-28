# 013: Check off past days

- **Status**: Approved
- **Owner**: @mrtrukiny
- **Created**: 2026-10-28

## Goal

Check-offs only work for today (spec 006). When the owner cleans but forgets to check it in the app, the day counts as missed: the streak breaks and the scheduler plans the tasks again as if they weren't done. This spec lets the owner catch up on the last 7 days, so the history, the streak, and the plan reflect what really happened. It resolves the follow-up listed in spec 006's out-of-scope section.

## User stories

- As the owner, I want to check off tasks I did on an earlier day, so my streak and plan stay right.
- As the owner, I want to see which recent days I left unchecked, so I know what to catch up on.

## Acceptance criteria

- [ ] AC1: Given I'm on Today, then a link "Earlier days" opens the last 7 days before today, each with its date, its cleaning tasks, and how many are done ("2 of 5 done").
- [ ] AC2: Given a past day within the last 7 days, then I can check, uncheck, or skip its cleaning tasks and check its routines, and record or change the minutes a done task took (spec 009), the same way as on Today. Older days are read-only.
- [ ] AC3: Given I complete a past day, then the streak counts it, as if I had checked it on that day.
- [ ] AC4: Given I mark a past task done or skipped, then its last completion is that day, and the plan is rebuilt from the next replannable day, so the task isn't planned again too soon. Given I uncheck it, then the plan is rebuilt the same way.
- [ ] AC5: Changing a past day never changes its Google Calendar event.
- [ ] AC6: Given I'm offline, then changes on past days are kept on the device and sent when the connection returns, as on Today. Given a queued change is for a day that has meanwhile become older than 7 days, it is dropped with a notice.
- [ ] AC7: Given there are no past days with tasks (a new owner, or only days off), then the page says so.
- [ ] AC8: The page works at 360px and on desktop, in light and dark mode, and with the keyboard only; each day is a labeled section and each control has an accessible name that includes the task and the date.

## UX notes

- Days are listed newest first, each as a collapsible section that starts open when the day has unchecked tasks.
- A day shows its tasks in the session order of spec 009, without time slots (they are in the past).
- Days off show "Day off" and have no controls.
- The link on Today shows how many recent days have unchecked tasks ("Earlier days · 2 unchecked").

## Out of scope

- Days older than 7 days.
- Adding a task to a past day that wasn't planned for it.
- Changing future days early.
- Rewriting past calendar events to show what was done.

## Open questions

- None. Decided with the owner: the last 7 days can be changed.

---

## Technical plan

_Filled in by the `plan-feature` skill after the spec is approved._

### Approach

### Tasks

### Test plan
