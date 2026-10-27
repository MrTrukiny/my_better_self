import { describe, expect, it } from "vitest";
import { isComplete, progressOf, type TodayTask } from "./progress";

function task(
  id: string,
  minutes: number,
  status: TodayTask["status"],
  kind: TodayTask["kind"] = "cleaning",
): TodayTask {
  return {
    id,
    occurrenceId: `o-${id}`,
    kind,
    name: id,
    minutes,
    roomName: null,
    itemName: null,
    status,
    actualMinutes: null,
  };
}

describe("progressOf", () => {
  it("AC1: counts done minutes of the session's cleaning tasks", () => {
    const progress = progressOf([
      task("a", 15, "done"),
      task("b", 10, "scheduled"),
      task("c", 13, "scheduled"),
      task("bed", 2, "done", "routine"),
    ]);
    expect(progress).toEqual({
      doneMinutes: 15,
      totalMinutes: 38,
      tookMinutes: 0,
      complete: false,
    });
  });

  it("AC3: a skipped task leaves the session's total", () => {
    const progress = progressOf([task("a", 15, "done"), task("b", 10, "skipped")]);
    expect(progress).toEqual({
      doneMinutes: 15,
      totalMinutes: 15,
      tookMinutes: 0,
      complete: true,
    });
  });

  it("009 AC5: adds up the minutes noted on done cleaning tasks", () => {
    const progress = progressOf([
      { ...task("a", 10, "done"), actualMinutes: 12 },
      { ...task("b", 15, "done"), actualMinutes: 20 },
      task("c", 13, "done"),
      { ...task("bed", 2, "done", "routine"), actualMinutes: 5 },
    ]);
    expect(progress.tookMinutes).toBe(32);
    expect(progress.doneMinutes).toBe(38);
  });

  it("AC5: a day of only skips isn't complete", () => {
    expect(progressOf([task("a", 15, "skipped")]).complete).toBe(false);
  });
});

describe("isComplete", () => {
  it("needs every task handled and at least one done", () => {
    expect(isComplete({ total: 3, done: 2, skipped: 1 })).toBe(true);
    expect(isComplete({ total: 3, done: 2, skipped: 0 })).toBe(false);
    expect(isComplete({ total: 2, done: 0, skipped: 2 })).toBe(false);
    expect(isComplete({ total: 0, done: 0, skipped: 0 })).toBe(false);
  });
});
