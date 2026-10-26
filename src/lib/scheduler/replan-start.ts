import { type DayNumber, parseTime, zonedNow } from "./dates";
import { PLAN_DAYS, type ScheduleSettings, startTimeFor } from "./settings";

type ClockSettings = Pick<ScheduleSettings, "startTimes" | "timeZone">;

/**
 * First day a replan may change: today while today's session hasn't started, otherwise
 * tomorrow. A day off starts tomorrow, so today's routines stay as planned. See ADR 0007.
 */
export function replanStart(settings: ClockSettings, now: Date): DayNumber {
  const { day, minutes } = zonedNow(settings.timeZone, now);
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
