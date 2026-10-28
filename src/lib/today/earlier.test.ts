import { describe, expect, it } from "vitest";
import { toDayNumber } from "@/lib/scheduler/dates";
import { earlierDays, uncheckedDays } from "./earlier";
import type { TodayTask } from "./progress";

const TODAY = toDayNumber("2026-10-26");

function task(date: number, name: string, status: TodayTask["status"] = "scheduled") {
  return {
    day: date,
    task: {
      occurrenceId: `${date}-${name}`,
      status,
      actualMinutes: null,
      id: name,
      kind: "cleaning" as const,
      name,
      minutes: 10,
      roomId: "r1",
      roomName: "Kitchen",
      roomAddedAt: 1,
      itemName: null,
      itemType: null,
      itemAddedAt: null,
    },
  };
}

describe("earlierDays", () => {
  it("spec 013 AC1: lists days newest first, from the oldest day with tasks to yesterday", () => {
    const days = earlierDays(TODAY, [task(TODAY - 3, "Mop"), task(TODAY - 1, "Dust")], () => false);
    expect(days.map((d) => d.day)).toEqual([TODAY - 1, TODAY - 2, TODAY - 3]);
    expect(days.map((d) => d.tasks.map((t) => t.name))).toEqual([["Dust"], [], ["Mop"]]);
  });

  it("UX: marks days off", () => {
    const days = earlierDays(TODAY, [task(TODAY - 2, "Mop")], (day) => day === TODAY - 1);
    expect(days.map((d) => d.dayOff)).toEqual([true, false]);
  });

  it("ignores today and days beyond the window", () => {
    const days = earlierDays(TODAY, [task(TODAY, "Mop"), task(TODAY - 9, "Dust")], () => false);
    expect(days).toEqual([]);
  });

  it("spec 013 AC7: no days when nothing was planned", () => {
    expect(earlierDays(TODAY, [], () => false)).toEqual([]);
  });
});

describe("uncheckedDays", () => {
  it("UX: counts recent days with unchecked cleaning tasks", () => {
    const history = new Map([
      [TODAY - 1, { total: 3, done: 3, skipped: 0 }],
      [TODAY - 2, { total: 3, done: 1, skipped: 1 }],
      [TODAY - 5, { total: 2, done: 0, skipped: 0 }],
      [TODAY - 9, { total: 2, done: 0, skipped: 0 }],
    ]);
    expect(uncheckedDays(history, TODAY)).toBe(2);
  });
});
