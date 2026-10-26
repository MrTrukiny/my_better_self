import type { CalendarEvent } from "./events";

/** A `calendar_day` row: the event last written for a date. */
export type StoredDay = { date: string; eventId: string; digest: string; overlap: boolean };

export type SyncPlan = { puts: CalendarEvent[]; deletes: StoredDay[] };

/**
 * What to write so the calendar matches the plan from `from` through `to` (ISO dates): put new
 * and changed days, delete days that lost their cleaning. Days outside the range are left alone.
 */
export function planSync({
  desired,
  stored,
  from,
  to,
}: {
  desired: readonly CalendarEvent[];
  stored: readonly StoredDay[];
  from: string;
  to: string;
}): SyncPlan {
  const inRange = (date: string) => date >= from && date <= to;
  const wanted = new Map<string, CalendarEvent>();
  for (const event of desired) {
    if (inRange(event.date) && !wanted.has(event.date)) {
      wanted.set(event.date, event);
    }
  }
  const puts: CalendarEvent[] = [];
  const deletes: StoredDay[] = [];
  const storedByDate = new Map<string, StoredDay>();
  for (const day of stored) {
    if (!inRange(day.date)) {
      continue;
    }
    storedByDate.set(day.date, day);
    const event = wanted.get(day.date);
    if (!event || event.id !== day.eventId) {
      deletes.push(day);
    }
  }
  for (const event of wanted.values()) {
    const day = storedByDate.get(event.date);
    if (!day || day.eventId !== event.id || day.digest !== event.digest) {
      puts.push(event);
    }
  }
  return { puts, deletes };
}
