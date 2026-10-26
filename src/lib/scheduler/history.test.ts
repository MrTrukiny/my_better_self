import { describe, expect, it } from "vitest";
import { type DayNumber, toDayNumber } from "./dates";
import { type HistoryTask, lastCompletions, type PastOccurrence } from "./history";
import { type SchedulerTask, schedule } from "./schedule";
import { type Budgets, budgetFor } from "./settings";

const MONDAY = toDayNumber("2026-10-26");

describe("lastCompletions", () => {
  const weekly: HistoryTask = { id: "weekly", frequencyDays: 7, firstDue: null };

  it("uses the latest done or skipped occurrence", () => {
    const past: PastOccurrence[] = [
      { taskId: "weekly", day: MONDAY, status: "done" },
      { taskId: "weekly", day: MONDAY + 7, status: "skipped" },
    ];
    expect(lastCompletions([weekly], past).get("weekly")).toBe(MONDAY + 7);
  });

  it("keeps the last completion when later occurrences were missed", () => {
    const past: PastOccurrence[] = [
      { taskId: "weekly", day: MONDAY, status: "done" },
      { taskId: "weekly", day: MONDAY + 7, status: "scheduled" },
    ];
    expect(lastCompletions([weekly], past).get("weekly")).toBe(MONDAY);
  });

  it("makes a never-handled task due on its first missed day", () => {
    const past: PastOccurrence[] = [
      { taskId: "weekly", day: MONDAY + 2, status: "scheduled" },
      { taskId: "weekly", day: MONDAY + 3, status: "scheduled" },
    ];
    expect(lastCompletions([weekly], past).get("weekly")).toBe(MONDAY + 2 - 7);
  });

  it("keeps the saved first due day of a task that was never planned", () => {
    const anchored = { ...weekly, firstDue: MONDAY + 20 };
    expect(lastCompletions([anchored], []).get("weekly")).toBe(MONDAY + 13);
  });

  it("leaves new tasks out", () => {
    expect(lastCompletions([weekly], []).has("weekly")).toBe(false);
  });
});

const BUDGETS: Budgets = {
  startTimes: Array(7).fill("07:00"),
  weekdayMinutes: 45,
  weekendMinutes: 60,
};

function cleaning(id: string, minutes: number, frequencyDays: number): SchedulerTask {
  return { id, name: id, kind: "cleaning", minutes, frequencyDays };
}

const HOME: SchedulerTask[] = [
  cleaning("toilet", 5, 3),
  cleaning("sink", 5, 3),
  cleaning("shower", 15, 7),
  cleaning("floor", 15, 4),
  cleaning("counters", 5, 2),
  cleaning("stove", 10, 7),
  cleaning("fridge", 20, 30),
  cleaning("windows", 20, 30),
  cleaning("closet", 30, 90),
  cleaning("shelves", 10, 14),
  cleaning("sofa", 15, 14),
  cleaning("lamps", 10, 30),
  cleaning("doors", 15, 30),
  cleaning("bed", 10, 3),
  cleaning("mop", 20, 7),
  cleaning("tub", 20, 7),
  cleaning("laundry", 15, 5),
  cleaning("bins", 10, 7),
  cleaning("dust", 10, 3),
  cleaning("oven", 30, 30),
  cleaning("curtains", 30, 60),
];

type Row = { taskId: string; day: DayNumber; status: PastOccurrence["status"] };

/**
 * Replans every morning like `ensurePlan` does, then marks the day's tasks done when `works`
 * says so and leaves them unchecked otherwise.
 */
function simulate(days: number, works: (day: DayNumber) => boolean, settings: Budgets = BUDGETS) {
  let rows: Row[] = [];
  const firstDues = new Map<string, DayNumber>();
  const planned = new Map<DayNumber, string[]>();
  for (let day = MONDAY; day < MONDAY + days; day++) {
    const past = rows.filter((r) => r.day < day);
    const lastDone = lastCompletions(
      HOME.map((t) => ({ ...t, firstDue: firstDues.get(t.id) ?? null })),
      past,
    );
    const result = schedule({ tasks: HOME, settings, lastDone, from: day, to: day + 6 });
    for (const [id, due] of result.firstDues) firstDues.set(id, due);
    const future = result.days.flatMap((d) =>
      d.taskIds.map((taskId) => ({ taskId, day: d.day, status: "scheduled" as const })),
    );
    rows = [...past, ...future];
    const today = rows.filter((r) => r.day === day);
    planned.set(
      day,
      today.map((r) => r.taskId),
    );
    if (works(day)) {
      for (const row of today) row.status = "done";
    }
  }
  return planned;
}

function minutesOf(ids: readonly string[]): number {
  return ids.reduce((sum, id) => sum + (HOME.find((t) => t.id === id)?.minutes ?? 0), 0);
}

describe("daily replanning with history", () => {
  it("doesn't keep postponing new infrequent tasks, even when the budget is short", () => {
    const short = { ...BUDGETS, weekdayMinutes: 30, weekendMinutes: 30 };
    const planned = simulate(120, () => true, short);
    for (const task of HOME) {
      const sessions = [...planned].filter(([, ids]) => ids.includes(task.id));
      expect(sessions.length, task.id).toBeGreaterThan(0);
    }
  });

  it("brings missed tasks back within the budget, most overdue first", () => {
    const away = (day: DayNumber) => day >= MONDAY + 10 && day < MONDAY + 14;
    const planned = simulate(40, (day) => !away(day));
    for (const [day, ids] of planned) {
      expect(minutesOf(ids), `day ${day - MONDAY}`).toBeLessThanOrEqual(budgetFor(BUDGETS, day));
    }

    const missed = new Set([...planned].filter(([day]) => away(day)).flatMap(([, ids]) => ids));
    expect(missed.size).toBeGreaterThan(0);
    const back = MONDAY + 14;
    for (const id of missed) {
      const again = [...planned].find(([day, ids]) => day >= back && ids.includes(id));
      expect(again?.[0], id).toBeLessThan(back + 7);
    }
    const counters = planned.get(back) ?? [];
    expect(counters).toContain("counters");
  });
});
