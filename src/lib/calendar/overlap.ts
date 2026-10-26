import type { BusyInterval, CalendarListEntry } from "./google";

/** Whether any busy time overlaps the session; touching an edge doesn't count. */
export function overlapsBusy(
  session: { startsAt: Date; endsAt: Date },
  busy: readonly BusyInterval[],
): boolean {
  return busy.some(
    (interval) => interval.start < session.endsAt && interval.end > session.startsAt,
  );
}

/** Calendars to read busy times from: every selected one except the app's own. */
export function busyCalendarIds(
  calendars: readonly CalendarListEntry[],
  cleaningCalendarId: string,
): string[] {
  return calendars.filter((c) => c.selected && c.id !== cleaningCalendarId).map((c) => c.id);
}
