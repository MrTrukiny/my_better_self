import { type DayNumber, zonedNow } from "./dates";
import { type PlanState, pendingRange, replanStart } from "./replan-start";
import { PLAN_DAYS, type ScheduleSettings } from "./settings";

export type PersonState = { id: string; settings: ScheduleSettings } & PlanState;

/** What a household replan covers: each person may only change days from their own `start`. */
export type HouseholdRange = {
  from: DayNumber;
  to: DayNumber;
  people: { id: string; settings: ScheduleSettings; start: DayNumber }[];
  /** Whether this is a full replan, which records the replanning day for everyone. */
  full: boolean;
};

/** A full replan: each person from their own first replan day (ADR 0008) through their week. */
export function fullRange(people: readonly PersonState[], now: Date): HouseholdRange | null {
  return toRange(
    people.map((p) => ({
      person: p,
      start: replanStart(p.settings, now, { todayStarted: p.todayStarted }),
      to: zonedNow(p.settings.timeZone, now).day + PLAN_DAYS - 1,
    })),
    true,
  );
}

/**
 * What `ensurePlan` has to plan for the household: a full replan when anyone is on a new day,
 * otherwise the days missing from anyone's horizon, keeping what each person already has.
 * Null when nothing is due.
 */
export function pendingHouseholdRange(
  people: readonly PersonState[],
  now: Date,
): HouseholdRange | null {
  const pending = people.map((p) => ({ person: p, range: pendingRange(p.settings, p, now) }));
  if (pending.some(({ range }) => range?.full)) {
    return fullRange(people, now);
  }
  if (pending.every(({ range }) => range === null)) {
    return null;
  }
  return toRange(
    pending.map(({ person, range }) => {
      const planned = person.plannedThrough ?? zonedNow(person.settings.timeZone, now).day;
      return range
        ? { person, start: range.from, to: range.to }
        : { person, start: planned + 1, to: planned };
    }),
    false,
  );
}

function toRange(
  spans: readonly { person: PersonState; start: DayNumber; to: DayNumber }[],
  full: boolean,
): HouseholdRange | null {
  if (spans.length === 0) {
    return null;
  }
  return {
    from: Math.min(...spans.map((s) => s.start)),
    to: Math.max(...spans.map((s) => s.to)),
    people: spans.map(({ person, start }) => ({ id: person.id, settings: person.settings, start })),
    full,
  };
}
