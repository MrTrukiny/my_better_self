import { describe, expect, it } from "vitest";
import type { PlanDayView, PlanTask } from "@/lib/scheduler/format";
import { buildEvent, eventIdFor, zonedTimeToUtc } from "./events";
import { overlapsBusy } from "./overlap";

const task = (overrides: Partial<PlanTask>): PlanTask => ({
  id: "t",
  kind: "cleaning",
  name: "Task",
  minutes: 10,
  roomName: null,
  itemName: null,
  ...overrides,
});

const day = (overrides: Partial<PlanDayView> = {}): PlanDayView => ({
  date: "2026-10-27",
  isToday: false,
  off: false,
  start: "06:30",
  end: "07:15",
  budget: 45,
  total: 38,
  cleaning: [
    task({ id: "a", name: "Kitchen surface clean", minutes: 10, roomName: "Kitchen" }),
    task({ id: "b", name: "Window wipe", minutes: 28, roomName: "Kitchen", itemName: "Window" }),
  ],
  routines: [
    task({ id: "r1", kind: "routine", name: "Make the bed", minutes: 2 }),
    task({ id: "r2", kind: "routine", name: "Take out the trash", minutes: 3 }),
  ],
  ...overrides,
});

const options = {
  userId: "user-1",
  timeZone: "America/Bogota",
  appUrl: "https://example.com",
};

describe("zonedTimeToUtc", () => {
  it("turns a local date and time into the instant, across time zones", () => {
    expect(zonedTimeToUtc("2026-10-27", 390, "America/Bogota").toISOString()).toBe(
      "2026-10-27T11:30:00.000Z",
    );
    expect(zonedTimeToUtc("2026-10-27", 390, "UTC").toISOString()).toBe("2026-10-27T06:30:00.000Z");
    expect(zonedTimeToUtc("2026-10-27", 390, "Asia/Kolkata").toISOString()).toBe(
      "2026-10-27T01:00:00.000Z",
    );
  });

  it("follows daylight saving on both sides of the change", () => {
    // Madrid moves from UTC+2 to UTC+1 on 2026-10-25.
    expect(zonedTimeToUtc("2026-10-24", 390, "Europe/Madrid").toISOString()).toBe(
      "2026-10-24T04:30:00.000Z",
    );
    expect(zonedTimeToUtc("2026-10-26", 390, "Europe/Madrid").toISOString()).toBe(
      "2026-10-26T05:30:00.000Z",
    );
    // New York moves from UTC-5 to UTC-4 on 2026-03-08.
    expect(zonedTimeToUtc("2026-03-09", 390, "America/New_York").toISOString()).toBe(
      "2026-03-09T10:30:00.000Z",
    );
  });

  it("counts minutes past midnight into the next day", () => {
    expect(zonedTimeToUtc("2026-10-27", 1440 + 15, "UTC").toISOString()).toBe(
      "2026-10-28T00:15:00.000Z",
    );
  });
});

describe("eventIdFor", () => {
  it("AC2: is stable per user and date, and different otherwise", () => {
    const id = eventIdFor("user-1", "2026-10-27");
    expect(id).toBe(eventIdFor("user-1", "2026-10-27"));
    expect(id).not.toBe(eventIdFor("user-1", "2026-10-28"));
    expect(id).not.toBe(eventIdFor("user-2", "2026-10-27"));
  });

  it("uses only base32hex characters, as Google requires", () => {
    expect(eventIdFor("user-1", "2026-10-27")).toMatch(/^[0-9a-v]{5,1024}$/);
  });
});

describe("buildEvent", () => {
  it("spec 007 AC1: titles the event with the day's budget, weekday or weekend", () => {
    expect(buildEvent(day(), options)?.summary).toBe("Cleaning, 45 min");
    expect(buildEvent(day({ date: "2026-10-31", budget: 60 }), options)?.summary).toBe(
      "Cleaning, 60 min",
    );
  });

  it("spec 007 AC1: starts at the day's start time and lasts the budget, whatever the total", () => {
    const event = buildEvent(day(), options);
    expect(event?.start).toEqual({ dateTime: "2026-10-27T06:30:00", timeZone: "America/Bogota" });
    expect(event?.end).toEqual({ dateTime: "2026-10-27T07:15:00", timeZone: "America/Bogota" });
    expect(event?.startsAt.toISOString()).toBe("2026-10-27T11:30:00.000Z");
    expect(event?.endsAt.toISOString()).toBe("2026-10-27T12:15:00.000Z");

    const over = buildEvent(day({ total: 70 }), options);
    expect(over?.end.dateTime).toBe("2026-10-27T07:15:00");
  });

  it("ends on the next day when the session runs past midnight", () => {
    const event = buildEvent(day({ start: "23:40", end: "00:25" }), options);
    expect(event?.end.dateTime).toBe("2026-10-28T00:25:00");
  });

  it("spec 007 AC1: opens with the planned minutes, then the tasks, routines, and a link", () => {
    expect(buildEvent(day(), options)?.description).toBe(
      [
        "38 of 45 min planned",
        "",
        "Kitchen surface clean (Kitchen), 10 min",
        "Window wipe (Kitchen, Window), 28 min",
        "",
        "Also today: Make the bed, Take out the trash",
        "",
        "Open My Better Self: https://example.com/plan",
      ].join("\n"),
    );
  });

  it("leaves out the routines line when there are none", () => {
    expect(buildEvent(day({ routines: [] }), options)?.description).not.toContain("Also today");
  });

  it("AC2: gives no event to days off or days without cleaning", () => {
    expect(buildEvent(day({ off: true, start: null, end: null }), options)).toBeNull();
    expect(buildEvent(day({ cleaning: [], total: 0 }), options)).toBeNull();
  });

  it("AC3: keeps the digest while the content stays and changes it otherwise", () => {
    const digest = buildEvent(day(), options)?.digest;
    expect(buildEvent(day(), options)?.digest).toBe(digest);
    expect(buildEvent(day({ start: "07:00" }), options)?.digest).not.toBe(digest);
    expect(buildEvent(day({ routines: [] }), options)?.digest).not.toBe(digest);
  });

  it("spec 007 AC2: a different budget changes the digest but keeps the event id", () => {
    const before = buildEvent(day(), options);
    const after = buildEvent(day({ budget: 60, end: "07:30" }), options);
    expect(after?.digest).not.toBe(before?.digest);
    expect(after?.id).toBe(before?.id);
  });

  it("spec 007 AC3: overlaps a busy time after the planned tasks but within the budget", () => {
    const event = buildEvent(day(), options);
    // Planned tasks end at 12:08Z; the block runs to 12:15Z.
    const busy = [
      { start: new Date("2026-10-27T12:10:00Z"), end: new Date("2026-10-27T12:30:00Z") },
    ];
    expect(event && overlapsBusy(event, busy)).toBe(true);
  });

  it("carries the derived id and date", () => {
    const event = buildEvent(day(), options);
    expect(event?.id).toBe(eventIdFor("user-1", "2026-10-27"));
    expect(event?.date).toBe("2026-10-27");
  });
});
