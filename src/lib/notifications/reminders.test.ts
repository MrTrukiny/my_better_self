import { describe, expect, it } from "vitest";
import { toDayNumber } from "@/lib/scheduler/dates";
import { defaultSettings, type ScheduleSettings } from "@/lib/scheduler/settings";
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
  reminderDecision,
  remindersOf,
  upcomingReminders,
  zonedInstant,
} from "./reminders";

const BOGOTA = "America/Bogota";
// 2026-10-28 is a Wednesday.
const WEDNESDAY = toDayNumber("2026-10-28");

function settings(overrides: Partial<ScheduleSettings> = {}): ScheduleSettings {
  return { ...defaultSettings(BOGOTA), ...overrides };
}

function prefs(overrides: Partial<NotificationPrefs> = {}): NotificationPrefs {
  return { ...DEFAULT_NOTIFICATION_PREFS, ...overrides };
}

describe("zonedInstant", () => {
  it("converts a local time to the UTC instant", () => {
    expect(zonedInstant(BOGOTA, WEDNESDAY, 6 * 60 + 15).toISOString()).toBe(
      "2026-10-28T11:15:00.000Z",
    );
  });

  it("follows daylight saving changes", () => {
    const beforeChange = toDayNumber("2026-03-07");
    const afterChange = toDayNumber("2026-03-09");
    expect(zonedInstant("America/New_York", beforeChange, 20 * 60).toISOString()).toBe(
      "2026-03-08T01:00:00.000Z",
    );
    expect(zonedInstant("America/New_York", afterChange, 20 * 60).toISOString()).toBe(
      "2026-03-10T00:00:00.000Z",
    );
  });
});

describe("remindersOf", () => {
  it("has both reminders by default, 15 minutes before the start and at 20:00", () => {
    expect(remindersOf(settings(), prefs(), WEDNESDAY)).toEqual([
      { kind: "before", time: "06:15" },
      { kind: "evening", time: "20:00" },
    ]);
  });

  it("uses the chosen lead, including at the start time", () => {
    const at = (beforeMinutes: number) =>
      remindersOf(settings(), prefs({ beforeMinutes, eveningEnabled: false }), WEDNESDAY);
    expect(at(0)).toEqual([{ kind: "before", time: "06:30" }]);
    expect(at(30)).toEqual([{ kind: "before", time: "06:00" }]);
  });

  it("never goes before midnight", () => {
    const early = settings({ startTimes: Array(7).fill("00:10") });
    expect(remindersOf(early, prefs({ beforeMinutes: 30 }), WEDNESDAY)[0]).toEqual({
      kind: "before",
      time: "00:00",
    });
  });

  it("has no session reminder on a day off, but keeps the evening one", () => {
    const off = settings({ startTimes: Array(7).fill(null) });
    expect(remindersOf(off, prefs(), WEDNESDAY)).toEqual([{ kind: "evening", time: "20:00" }]);
  });

  it("leaves out reminders that are off", () => {
    expect(
      remindersOf(settings(), prefs({ beforeEnabled: false, eveningEnabled: false }), WEDNESDAY),
    ).toEqual([]);
  });
});

describe("upcomingReminders", () => {
  it("lists the reminders of the next 26 hours with their dates and instants", () => {
    // 04:00 in Bogota, when the daily job runs.
    const now = new Date("2026-10-28T09:00:00Z");
    expect(upcomingReminders(settings(), prefs(), now)).toEqual([
      { kind: "before", date: "2026-10-28", time: "06:15", at: new Date("2026-10-28T11:15:00Z") },
      { kind: "evening", date: "2026-10-28", time: "20:00", at: new Date("2026-10-29T01:00:00Z") },
    ]);
  });

  it("skips reminders whose time has passed and includes tomorrow's within the window", () => {
    const now = new Date("2026-10-28T20:00:00Z");
    expect(upcomingReminders(settings(), prefs(), now).map((r) => `${r.date} ${r.kind}`)).toEqual([
      "2026-10-28 evening",
      "2026-10-29 before",
    ]);
  });
});

describe("reminderDecision", () => {
  const before = { kind: "before" as const, date: "2026-10-28", time: "06:15" };
  const evening = { kind: "evening" as const, date: "2026-10-28", time: "20:00" };
  const onTime = (iso: string) => ({
    settings: settings(),
    prefs: prefs(),
    now: new Date(iso),
    day: { total: 4, open: 4, openMinutes: 45 },
  });

  it("announces the session with its open tasks and minutes", () => {
    expect(reminderDecision(before, onTime("2026-10-28T11:15:30Z"))).toEqual({
      send: true,
      title: "Cleaning in 15 min",
      body: "4 tasks, 45 min",
    });
  });

  it("says the session starts now when the lead is zero", () => {
    const context = { ...onTime("2026-10-28T11:30:00Z"), prefs: prefs({ beforeMinutes: 0 }) };
    expect(
      reminderDecision(
        { ...before, time: "06:30" },
        { ...context, day: { total: 1, open: 1, openMinutes: 10 } },
      ),
    ).toEqual({ send: true, title: "Cleaning starts now", body: "1 task, 10 min" });
  });

  it("sends the evening reminder when nothing was handled", () => {
    expect(reminderDecision(evening, onTime("2026-10-29T01:00:00Z"))).toEqual({
      send: true,
      title: "Your streak is waiting",
      body: "4 tasks left today",
    });
  });

  it("skips the evening reminder once a task was done or skipped", () => {
    const context = {
      ...onTime("2026-10-29T01:00:00Z"),
      day: { total: 4, open: 3, openMinutes: 30 },
    };
    expect(reminderDecision(evening, context)).toEqual({ send: false, reason: "handled" });
  });

  it("skips days with nothing to clean", () => {
    const empty = { total: 0, open: 0, openMinutes: 0 };
    expect(reminderDecision(before, { ...onTime("2026-10-28T11:15:00Z"), day: empty })).toEqual({
      send: false,
      reason: "nothing",
    });
    expect(reminderDecision(evening, { ...onTime("2026-10-29T01:00:00Z"), day: empty })).toEqual({
      send: false,
      reason: "nothing",
    });
    const allDone = { total: 2, open: 0, openMinutes: 0 };
    expect(reminderDecision(before, { ...onTime("2026-10-28T11:15:00Z"), day: allDone })).toEqual({
      send: false,
      reason: "nothing",
    });
  });

  it("drops a message whose time no longer matches the settings", () => {
    const context = { ...onTime("2026-10-28T11:15:00Z"), prefs: prefs({ beforeMinutes: 30 }) };
    expect(reminderDecision(before, context)).toEqual({ send: false, reason: "stale" });
  });

  it("drops a reminder that was turned off", () => {
    const context = { ...onTime("2026-10-29T01:00:00Z"), prefs: prefs({ eveningEnabled: false }) };
    expect(reminderDecision(evening, context)).toEqual({ send: false, reason: "stale" });
  });

  it("drops a message more than 30 minutes late", () => {
    expect(reminderDecision(before, onTime("2026-10-28T11:46:00Z"))).toEqual({
      send: false,
      reason: "late",
    });
  });

  it("drops a message that arrives early", () => {
    expect(reminderDecision(before, onTime("2026-10-28T11:00:00Z"))).toEqual({
      send: false,
      reason: "early",
    });
  });
});
