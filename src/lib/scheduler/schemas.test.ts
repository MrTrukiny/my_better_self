import { describe, expect, it } from "vitest";
import { parseInput } from "@/lib/inventory/schemas";
import { scheduleFormValues, scheduleInputSchema } from "./schemas";

function form(overrides: Record<string, string | null> = {}): FormData {
  const data = new FormData();
  for (let day = 0; day < 7; day++) {
    data.set(`on${day}`, "on");
    data.set(`start${day}`, "06:30");
  }
  data.set("weekdayMinutes", "45");
  data.set("weekendMinutes", "60");
  data.set("timeZone", "Europe/Madrid");
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) {
      data.delete(key);
    } else {
      data.set(key, value);
    }
  }
  return data;
}

const parse = (data: FormData) => parseInput(scheduleInputSchema, scheduleFormValues(data));

describe("scheduleInputSchema", () => {
  it("AC1: turns the form into start times per weekday, budgets, and the time zone", () => {
    const result = parse(form({ on2: null, start5: "08:15", weekendMinutes: " 90 " }));
    expect(result).toEqual({
      ok: true,
      data: {
        startTimes: ["06:30", "06:30", null, "06:30", "06:30", "08:15", "06:30"],
        weekdayMinutes: 45,
        weekendMinutes: 90,
        timeZone: "Europe/Madrid",
      },
    });
  });

  it("AC1: ignores the time of a day that is off, even when it is invalid", () => {
    const result = parse(form({ on0: null, start0: "" }));
    expect(result.ok && result.data.startTimes[0]).toBeNull();
  });

  it("AC1: rejects an invalid start time on a day that is on", () => {
    expect(parse(form({ start3: "25:00" }))).toEqual({
      ok: false,
      fieldErrors: { start3: "Enter a time like 06:30." },
    });
  });

  it("AC1: rejects budgets outside 30 to 120 whole minutes", () => {
    for (const value of ["29", "121", "45.5", "", "abc"]) {
      expect(parse(form({ weekdayMinutes: value }))).toEqual({
        ok: false,
        fieldErrors: { weekdayMinutes: "Enter whole minutes from 30 to 120." },
      });
    }
    expect(parse(form({ weekendMinutes: "30" })).ok).toBe(true);
    expect(parse(form({ weekendMinutes: "120" })).ok).toBe(true);
  });

  it("AC1: requires at least one day on", () => {
    const allOff = Object.fromEntries(Array.from({ length: 7 }, (_, day) => [`on${day}`, null]));
    expect(parse(form(allOff))).toEqual({
      ok: false,
      fieldErrors: { days: "Turn on at least one day." },
    });
  });

  it("rejects an unknown time zone", () => {
    expect(parse(form({ timeZone: "Mars/Olympus" })).ok).toBe(false);
  });
});
