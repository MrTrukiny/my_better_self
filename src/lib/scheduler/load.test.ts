import { describe, expect, it } from "vitest";
import { loadSummary } from "./load";
import type { Budgets } from "./settings";

const EVERY_DAY: Budgets = {
  startTimes: Array(7).fill("06:30"),
  weekdayMinutes: 45,
  weekendMinutes: 60,
};

const task = (kind: "cleaning" | "routine", minutes: number, frequencyDays: number) => ({
  kind,
  minutes,
  frequencyDays,
});

describe("loadSummary", () => {
  it("adds up cleaning minutes per day and ignores routines", () => {
    const summary = loadSummary(
      [task("cleaning", 10, 2), task("cleaning", 30, 30), task("routine", 60, 1)],
      EVERY_DAY,
    );
    expect(summary.neededPerDay).toBeCloseTo(6);
    expect(summary.availablePerDay).toBeCloseTo((5 * 45 + 2 * 60) / 7);
    expect(summary.overloaded).toBe(false);
  });

  it("AC5: flags an overload when the tasks need more than the days that are on provide", () => {
    const weekendsOnly: Budgets = {
      ...EVERY_DAY,
      startTimes: EVERY_DAY.startTimes.map((time, i) => (i >= 5 ? time : null)),
    };
    const summary = loadSummary([task("cleaning", 20, 1)], weekendsOnly);
    expect(summary.availablePerDay).toBeCloseTo(120 / 7);
    expect(summary.overloaded).toBe(true);
  });
});
