import { type DayNumber, parseTime, zonedNow } from "./dates";
import { PLAN_DAYS, type ScheduleSettings, startTimeFor } from "./settings";

type ClockSettings = Pick<ScheduleSettings, "startTimes" | "timeZone">;

/**
 * First day a replan may change: today while today's session hasn't started, otherwise
 * tomorrow. Today has started once its start time passes or something in it was checked or
 * skipped. A day off starts tomorrow, so today's routines stay as planned. See ADRs 0007 and 0008.
 */
export function replanStart(
  settings: ClockSettings,
  now: Date,
  { todayStarted = false }: { todayStarted?: boolean } = {},
): DayNumber {
  const { day, minutes } = zonedNow(settings.timeZone, now);
  if (todayStarted) {
    return day + 1;
  }
  const start = startTimeFor(settings, day);
  const startMinutes = start === null ? null : parseTime(start);
  return startMinutes !== null && minutes < startMinutes ? day : day + 1;
}

/** Days to plan so the plan covers the next `PLAN_DAYS` days, or null when it already does. */
export function horizonRange(
  settings: ClockSettings,
  plannedThrough: DayNumber | null,
  now: Date,
): { from: DayNumber; to: DayNumber } | null {
  const today = zonedNow(settings.timeZone, now).day;
  const to = today + PLAN_DAYS - 1;
  if (plannedThrough !== null && plannedThrough >= to) {
    return null;
  }
  const from =
    plannedThrough === null ? replanStart(settings, now) : Math.max(plannedThrough + 1, today);
  return { from, to };
}

export type PlanState = {
  plannedThrough: DayNumber | null;
  /** The owner's date of the last full replan. */
  replannedOn: DayNumber | null;
  /** Whether any of today's occurrences was checked or skipped. */
  todayStarted: boolean;
};

/**
 * What `ensurePlan` has to plan: a full replan on the first visit of a new day, so what wasn't
 * done comes back; otherwise only the days missing from the horizon. Null when nothing is due.
 */
export function pendingRange(
  settings: ClockSettings,
  state: PlanState,
  now: Date,
): { from: DayNumber; to: DayNumber; full: boolean } | null {
  const today = zonedNow(settings.timeZone, now).day;
  if (state.replannedOn === null || state.replannedOn < today) {
    return {
      from: replanStart(settings, now, { todayStarted: state.todayStarted }),
      to: today + PLAN_DAYS - 1,
      full: true,
    };
  }
  const range = horizonRange(settings, state.plannedThrough, now);
  return range && { ...range, full: false };
}
