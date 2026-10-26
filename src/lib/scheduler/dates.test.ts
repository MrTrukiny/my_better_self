import { describe, expect, it } from "vitest";
import {
  formatTime,
  isValidTimeZone,
  isWeekend,
  parseTime,
  toDayNumber,
  toIsoDate,
  weekdayIndex,
  zonedNow,
} from "./dates";

describe("day numbers", () => {
  it("round-trips ISO dates", () => {
    for (const iso of ["1970-01-01", "2026-02-28", "2028-02-29", "2026-12-31"]) {
      expect(toIsoDate(toDayNumber(iso))).toBe(iso);
    }
    expect(toDayNumber("1970-01-02")).toBe(1);
  });

  it("knows the weekday, Monday first", () => {
    expect(weekdayIndex(toDayNumber("2026-10-26"))).toBe(0);
    expect(weekdayIndex(toDayNumber("2026-10-31"))).toBe(5);
    expect(weekdayIndex(toDayNumber("2026-11-01"))).toBe(6);
    expect(isWeekend(toDayNumber("2026-10-30"))).toBe(false);
    expect(isWeekend(toDayNumber("2026-10-31"))).toBe(true);
  });
});

describe("times", () => {
  it("parses and formats HH:MM", () => {
    expect(parseTime("06:30")).toBe(390);
    expect(parseTime("23:59")).toBe(1439);
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("6:30")).toBeNull();
    expect(formatTime(390)).toBe("06:30");
    expect(formatTime(1440 + 15)).toBe("00:15");
  });
});

describe("zonedNow", () => {
  const instant = new Date("2026-10-26T03:15:00Z");

  it("gives the date and minutes in the owner's time zone", () => {
    expect(zonedNow("America/Bogota", instant)).toEqual({
      day: toDayNumber("2026-10-25"),
      minutes: 22 * 60 + 15,
    });
    expect(zonedNow("Asia/Tokyo", instant)).toEqual({
      day: toDayNumber("2026-10-26"),
      minutes: 12 * 60 + 15,
    });
    expect(zonedNow("UTC", instant)).toEqual({
      day: toDayNumber("2026-10-26"),
      minutes: 3 * 60 + 15,
    });
  });

  it("validates time zones", () => {
    expect(isValidTimeZone("America/Bogota")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});
