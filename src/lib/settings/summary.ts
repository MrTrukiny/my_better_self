import type { CalendarStatus } from "@/db/schema/calendar";
import type { Budgets } from "@/lib/scheduler/settings";

const WEEKEND = new Set([5, 6]);

/** One line for the Settings page: which days, the start time if they share one, the minutes. */
export function scheduleSummary(settings: Budgets | null): string {
  if (!settings) {
    return "Not set";
  }
  const on = settings.startTimes.flatMap((time, weekday) => (time === null ? [] : [weekday]));
  if (on.length === 0) {
    return "No cleaning days";
  }
  const weekdaysOn = on.filter((weekday) => !WEEKEND.has(weekday));
  const weekendsOn = on.filter((weekday) => WEEKEND.has(weekday));
  const days =
    on.length === 7
      ? "Every day"
      : weekdaysOn.length === 5 && weekendsOn.length === 0
        ? "Weekdays"
        : weekendsOn.length === 2 && weekdaysOn.length === 0
          ? "Weekends"
          : `${on.length} ${on.length === 1 ? "day" : "days"} a week`;
  const times = new Set(on.map((weekday) => settings.startTimes[weekday]));
  const when = times.size === 1 ? `${days} ${[...times][0]}` : days;
  const budgets = [
    ...(weekdaysOn.length > 0 ? [settings.weekdayMinutes] : []),
    ...(weekendsOn.length > 0 ? [settings.weekendMinutes] : []),
  ];
  const low = Math.min(...budgets);
  const high = Math.max(...budgets);
  return `${when} · ${low === high ? low : `${low}–${high}`} min`;
}

export function calendarSummary(connection: { status: CalendarStatus } | null): string {
  if (!connection) {
    return "Not connected";
  }
  switch (connection.status) {
    case "ok":
      return "Connected";
    case "reauth":
      return "Needs reconnecting";
    case "error":
      return "Sync problem";
  }
}

export function homeProfileSummary(profile: { helpers: readonly string[]; note: string | null }) {
  const count = profile.helpers.length;
  const helpers = count === 0 ? "No helpers" : `${count} ${count === 1 ? "helper" : "helpers"}`;
  return profile.note ? `${helpers} · Note added` : helpers;
}
