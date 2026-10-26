import { toIsoDate, zonedNow } from "@/lib/scheduler/dates";
import { zonedTimeToUtc } from "./events";
import { type CalendarClient, CalendarError, type EventInput } from "./google";

/** The fake's primary calendar, which is busy every day during `FAKE_BUSY`. */
export const FAKE_PRIMARY_ID = "fake-primary";
/** Minutes past local midnight: 06:00 to 07:00, so a session at the default 06:30 overlaps. */
export const FAKE_BUSY = { start: 360, end: 420 } as const;

type FakeCalendar = { summary: string; timeZone: string; events: Map<string, EventInput> };
type FakeAccount = { calendars: Map<string, FakeCalendar> };

// On globalThis so every route bundle in the server process shares one store.
const holder = globalThis as { __fakeCalendarStore?: Map<string, FakeAccount> };
holder.__fakeCalendarStore ??= new Map();
const store = holder.__fakeCalendarStore;

/**
 * An in-memory Google Calendar for e2e and CI (`CALENDAR_FAKE=1`), one account per owner.
 * Calendars and events last as long as the server process.
 */
export function createFakeCalendarClient(owner: string): CalendarClient {
  const account = () => {
    let found = store.get(owner);
    if (!found) {
      found = { calendars: new Map() };
      store.set(owner, found);
    }
    return found;
  };
  const calendar = (calendarId: string) => {
    const found = account().calendars.get(calendarId);
    if (!found) {
      throw new CalendarError("gone", `No fake calendar ${calendarId}`, 404);
    }
    return found;
  };

  return {
    async createCalendar({ summary, timeZone }) {
      const id = `fake-${crypto.randomUUID()}@group.calendar.google.com`;
      account().calendars.set(id, { summary, timeZone, events: new Map() });
      return { id, summary };
    },
    async getCalendar(calendarId) {
      return { id: calendarId, summary: calendar(calendarId).summary };
    },
    async deleteCalendar(calendarId) {
      calendar(calendarId);
      account().calendars.delete(calendarId);
    },
    async listCalendars() {
      return [
        { id: FAKE_PRIMARY_ID, summary: "Fake primary", selected: true },
        ...[...account().calendars].map(([id, { summary }]) => ({ id, summary, selected: true })),
      ];
    },
    async putEvent(calendarId, event) {
      calendar(calendarId).events.set(event.id, event);
    },
    async deleteEvent(calendarId, eventId) {
      calendar(calendarId).events.delete(eventId);
    },
    async queryBusy({ calendarIds, timeMin, timeMax, timeZone }) {
      if (!calendarIds.includes(FAKE_PRIMARY_ID)) {
        return [];
      }
      const busy = [];
      const first = zonedNow(timeZone, timeMin).day - 1;
      const last = zonedNow(timeZone, timeMax).day;
      for (let day = first; day <= last; day++) {
        const date = toIsoDate(day);
        const start = zonedTimeToUtc(date, FAKE_BUSY.start, timeZone);
        const end = zonedTimeToUtc(date, FAKE_BUSY.end, timeZone);
        if (start < timeMax && end > timeMin) {
          busy.push({ start, end });
        }
      }
      return busy;
    },
    async revoke() {},
  };
}
