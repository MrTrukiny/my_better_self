import { describe, expect, it } from "vitest";
import { planSync, type StoredDay } from "./diff";
import type { CalendarEvent } from "./events";

const event = (date: string, digest = `digest-${date}`): CalendarEvent => ({
  id: `id${date.replaceAll("-", "")}`,
  date,
  summary: "Cleaning, 30 min",
  description: "",
  start: { dateTime: `${date}T06:30:00`, timeZone: "UTC" },
  end: { dateTime: `${date}T07:00:00`, timeZone: "UTC" },
  startsAt: new Date(`${date}T06:30:00Z`),
  endsAt: new Date(`${date}T07:00:00Z`),
  digest,
});

const stored = (date: string, digest = `digest-${date}`, overlap = false): StoredDay => ({
  date,
  eventId: `id${date.replaceAll("-", "")}`,
  digest,
  overlap,
});

const range = { from: "2026-10-27", to: "2026-11-02" };

describe("planSync", () => {
  it("AC2: creates events for days that don't have one yet", () => {
    const result = planSync({ ...range, desired: [event("2026-10-27")], stored: [] });
    expect(result.puts.map((e) => e.date)).toEqual(["2026-10-27"]);
    expect(result.deletes).toEqual([]);
  });

  it("AC3: updates only the days whose content changed", () => {
    const result = planSync({
      ...range,
      desired: [event("2026-10-27"), event("2026-10-28", "new")],
      stored: [stored("2026-10-27"), stored("2026-10-28", "old")],
    });
    expect(result.puts.map((e) => e.date)).toEqual(["2026-10-28"]);
    expect(result.deletes).toEqual([]);
  });

  it("AC3: deletes the events of days that lost their cleaning", () => {
    const result = planSync({
      ...range,
      desired: [event("2026-10-27")],
      stored: [stored("2026-10-27"), stored("2026-10-29")],
    });
    expect(result.puts).toEqual([]);
    expect(result.deletes.map((d) => d.date)).toEqual(["2026-10-29"]);
  });

  it("AC3: leaves days before the range alone, so past and started days don't change", () => {
    const result = planSync({
      ...range,
      desired: [event("2026-10-26", "new")],
      stored: [stored("2026-10-25"), stored("2026-10-26", "old")],
    });
    expect(result).toEqual({ puts: [], deletes: [] });
  });

  it("AC3: never leaves two events on a day when the stored id differs", () => {
    const legacy = { ...stored("2026-10-27"), eventId: "legacyid" };
    const result = planSync({ ...range, desired: [event("2026-10-27")], stored: [legacy] });
    expect(result.deletes).toEqual([legacy]);
    expect(result.puts.map((e) => e.id)).toEqual(["id20261027"]);
  });

  it("AC3: keeps one event per day even if a day is asked for twice", () => {
    const result = planSync({
      ...range,
      desired: [event("2026-10-27", "a"), event("2026-10-27", "b")],
      stored: [],
    });
    expect(result.puts).toHaveLength(1);
  });
});
