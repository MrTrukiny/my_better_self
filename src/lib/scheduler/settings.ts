import { DAILY_CLEANING_MINUTES } from "@/lib/app-config";
import { type DayNumber, isWeekend, weekdayIndex } from "./dates";

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const BUDGET_MIN = 30;
export const BUDGET_MAX = 120;
export const DEFAULT_START_TIME = "06:30";
export const DEFAULT_WEEKDAY_MINUTES = DAILY_CLEANING_MINUTES;
export const DEFAULT_WEEKEND_MINUTES = 60;

/** How many days the plan shows and keeps planned ahead, today included. */
export const PLAN_DAYS = 7;

export type ScheduleSettings = {
  /** One "HH:MM" per weekday, Monday first; null means a day off. */
  startTimes: (string | null)[];
  weekdayMinutes: number;
  weekendMinutes: number;
  timeZone: string;
};

export type Budgets = Pick<ScheduleSettings, "startTimes" | "weekdayMinutes" | "weekendMinutes">;

export function defaultSettings(timeZone: string): ScheduleSettings {
  return {
    startTimes: WEEKDAYS.map(() => DEFAULT_START_TIME),
    weekdayMinutes: DEFAULT_WEEKDAY_MINUTES,
    weekendMinutes: DEFAULT_WEEKEND_MINUTES,
    timeZone,
  };
}

export function startTimeFor(settings: Budgets, day: DayNumber): string | null {
  return settings.startTimes[weekdayIndex(day)] ?? null;
}

/** The day's cleaning budget in minutes, or 0 on a day off. */
export function budgetFor(settings: Budgets, day: DayNumber): number {
  if (startTimeFor(settings, day) === null) {
    return 0;
  }
  return isWeekend(day) ? settings.weekendMinutes : settings.weekdayMinutes;
}

/** Average minutes available per calendar day: the week's budgets on days that are on, over 7. */
export function availablePerDay(settings: Budgets): number {
  let total = 0;
  for (let weekday = 0; weekday < 7; weekday++) {
    if (settings.startTimes[weekday] != null) {
      total += weekday >= 5 ? settings.weekendMinutes : settings.weekdayMinutes;
    }
  }
  return total / 7;
}
