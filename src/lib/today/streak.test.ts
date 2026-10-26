import { describe, expect, it } from "vitest";
import { toDayNumber } from "@/lib/scheduler/dates";
import type { DayCounts } from "./progress";
import { streakLine, streakOf } from "./streak";

const TODAY = toDayNumber("2026-10-26");
const COMPLETE: DayCounts = { total: 3, done: 3, skipped: 0 };
const MISSED: DayCounts = { total: 3, done: 1, skipped: 0 };
const PENDING: DayCounts = { total: 3, done: 0, skipped: 0 };

function history(entries: [offset: number, counts: DayCounts][]) {
  return new Map(entries.map(([offset, counts]) => [TODAY + offset, counts]));
}

describe("streakOf", () => {
  it("AC5: counts consecutive complete cleaning days ending yesterday", () => {
    const days = history([
      [-1, COMPLETE],
      [-2, COMPLETE],
      [-3, MISSED],
      [-4, COMPLETE],
    ]);
    expect(streakOf(days, TODAY, PENDING)).toBe(2);
  });

  it("AC5: days off and empty days don't break it", () => {
    const days = history([
      [-1, COMPLETE],
      [-3, COMPLETE],
      [-4, { total: 0, done: 0, skipped: 0 }],
      [-5, COMPLETE],
    ]);
    expect(streakOf(days, TODAY, PENDING)).toBe(3);
  });

  it("AC5: today extends it once complete, and doesn't break it before", () => {
    const days = history([[-1, COMPLETE]]);
    expect(streakOf(days, TODAY, PENDING)).toBe(1);
    expect(streakOf(days, TODAY, COMPLETE)).toBe(2);
  });

  it("AC5: skipped tasks count, but a day of only skips breaks it", () => {
    const days = history([
      [-1, { total: 2, done: 1, skipped: 1 }],
      [-2, { total: 2, done: 0, skipped: 2 }],
      [-3, COMPLETE],
    ]);
    expect(streakOf(days, TODAY, PENDING)).toBe(1);
  });

  it("ignores today's entry in the history", () => {
    expect(streakOf(history([[0, COMPLETE]]), TODAY, PENDING)).toBe(0);
  });
});

describe("streakLine", () => {
  it("AC5: invites to start at zero", () => {
    expect(streakLine(0)).toBe("Start a streak today");
    expect(streakLine(5)).toBe("5-day streak");
  });
});
