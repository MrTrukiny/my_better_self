import { describe, expect, it } from "vitest";
import { toDayNumber } from "./dates";
import { buildWeek, dayLabel, loadLine, type PlanTask, planTarget } from "./format";
import { defaultSettings } from "./settings";

const MONDAY = toDayNumber("2026-10-26");

const task = (overrides: Partial<PlanTask>): PlanTask => ({
  id: "t",
  kind: "cleaning",
  name: "Task",
  minutes: 10,
  roomName: null,
  itemName: null,
  ...overrides,
});

describe("buildWeek", () => {
  const settings = {
    ...defaultSettings("UTC"),
    startTimes: ["07:00", "06:30", null, "06:30", "06:30", "09:00", "06:30"],
  };

  it("AC2: lists 7 days from today with times, totals, budgets, and routines apart", () => {
    const week = buildWeek(
      settings,
      [
        {
          date: "2026-10-26",
          task: task({ id: "a", name: "Mop", minutes: 20, roomName: "Kitchen" }),
        },
        { date: "2026-10-26", task: task({ id: "b", name: "Dust", minutes: 15 }) },
        {
          date: "2026-10-26",
          task: task({ id: "r", kind: "routine", name: "Dishes", minutes: 15 }),
        },
        {
          date: "2026-10-28",
          task: task({ id: "r", kind: "routine", name: "Dishes", minutes: 15 }),
        },
      ],
      MONDAY,
    );

    expect(week).toHaveLength(7);
    expect(week[0]).toMatchObject({
      date: "2026-10-26",
      isToday: true,
      off: false,
      start: "07:00",
      end: "07:35",
      budget: 45,
      total: 35,
    });
    expect(week[0]?.cleaning.map((t) => t.name)).toEqual(["Dust", "Mop"]);
    expect(week[0]?.routines.map((t) => t.name)).toEqual(["Dishes"]);

    expect(week[2]).toMatchObject({ off: true, start: null, end: null, budget: 0, total: 0 });
    expect(week[2]?.routines.map((t) => t.name)).toEqual(["Dishes"]);
    expect(week[5]).toMatchObject({ isToday: false, start: "09:00", budget: 60 });
  });
});

describe("format helpers", () => {
  it("labels days in English without depending on the server's time zone", () => {
    expect(dayLabel("2026-10-26")).toBe("Monday, Oct 26");
  });

  it("names what a task belongs to", () => {
    expect(planTarget(task({ roomName: "Kitchen", itemName: "Oven" }))).toBe("Kitchen, Oven");
    expect(planTarget(task({ roomName: "Kitchen" }))).toBe("Kitchen");
    expect(planTarget(task({}))).toBe("Whole home");
  });

  it("AC5: rounds the load summary to whole minutes", () => {
    expect(loadLine({ neededPerDay: 40.6, availablePerDay: 47.9, overloaded: false })).toBe(
      "Your tasks need about 41 min a day; you have about 48.",
    );
  });
});
