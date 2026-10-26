import { describe, expect, it } from "vitest";
import { zonedTimeToUtc } from "./events";
import { createFakeCalendarClient, FAKE_BUSY, FAKE_PRIMARY_ID } from "./fake";
import { CalendarError } from "./google";

const event = {
  id: "abc123",
  summary: "Cleaning, 38 min",
  description: "",
  start: { dateTime: "2026-10-27T06:30:00", timeZone: "UTC" },
  end: { dateTime: "2026-10-27T07:08:00", timeZone: "UTC" },
};

describe("createFakeCalendarClient", () => {
  it("keeps calendars and events per owner", async () => {
    const owner = createFakeCalendarClient(`owner-${crypto.randomUUID()}`);
    const other = createFakeCalendarClient(`other-${crypto.randomUUID()}`);
    const calendar = await owner.createCalendar({ summary: "Cleaning", timeZone: "UTC" });
    await owner.putEvent(calendar.id, event);

    await expect(owner.getCalendar(calendar.id)).resolves.toEqual(calendar);
    await expect(other.getCalendar(calendar.id)).rejects.toBeInstanceOf(CalendarError);
    expect(await owner.listCalendars()).toEqual([
      { id: FAKE_PRIMARY_ID, summary: "Fake primary", selected: true },
      { id: calendar.id, summary: "Cleaning", selected: true },
    ]);
  });

  it("AC6: reports a deleted calendar as gone", async () => {
    const client = createFakeCalendarClient(`owner-${crypto.randomUUID()}`);
    const calendar = await client.createCalendar({ summary: "Cleaning", timeZone: "UTC" });
    await client.deleteCalendar(calendar.id);
    await expect(client.getCalendar(calendar.id)).rejects.toMatchObject({ kind: "gone" });
    await expect(client.putEvent(calendar.id, event)).rejects.toMatchObject({ kind: "gone" });
  });

  it("AC4: has a fixed busy block every day in the primary calendar only", async () => {
    const client = createFakeCalendarClient(`owner-${crypto.randomUUID()}`);
    const range = {
      timeMin: zonedTimeToUtc("2026-10-27", 0, "America/Bogota"),
      timeMax: zonedTimeToUtc("2026-10-29", 0, "America/Bogota"),
      timeZone: "America/Bogota",
    };

    expect(await client.queryBusy({ ...range, calendarIds: ["cleaning"] })).toEqual([]);
    expect(await client.queryBusy({ ...range, calendarIds: [FAKE_PRIMARY_ID] })).toEqual([
      {
        start: zonedTimeToUtc("2026-10-27", FAKE_BUSY.start, "America/Bogota"),
        end: zonedTimeToUtc("2026-10-27", FAKE_BUSY.end, "America/Bogota"),
      },
      {
        start: zonedTimeToUtc("2026-10-28", FAKE_BUSY.start, "America/Bogota"),
        end: zonedTimeToUtc("2026-10-28", FAKE_BUSY.end, "America/Bogota"),
      },
    ]);
  });
});
