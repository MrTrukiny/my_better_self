import { describe, expect, it } from "vitest";
import { dailyMinutes, formatFrequency, groupByTarget, targetLabel } from "./format";
import type { TaskEntry } from "./queries";

function entry(overrides: Partial<TaskEntry>): TaskEntry {
  return {
    id: "t",
    kind: "cleaning",
    name: "Task",
    minutes: 5,
    frequencyDays: 7,
    roomId: null,
    roomName: null,
    itemId: null,
    itemName: null,
    ...overrides,
  };
}

describe("formatFrequency", () => {
  it.each([
    [1, "Every day"],
    [3, "Every 3 days"],
    [7, "Every week"],
    [14, "Every 2 weeks"],
    [10, "Every 10 days"],
    [30, "Every month"],
    [90, "Every 3 months"],
    [45, "Every 45 days"],
    [365, "Every year"],
  ])("%i days reads as %s", (days, label) => {
    expect(formatFrequency(days)).toBe(label);
  });
});

describe("targetLabel", () => {
  it("AC2: names the item, the whole room, or the whole home", () => {
    expect(
      targetLabel(entry({ roomId: "r", roomName: "Bath", itemId: "i", itemName: "Mirror" })),
    ).toBe("Mirror");
    expect(targetLabel(entry({ roomId: "r", roomName: "Bath" }))).toBe("Whole room");
    expect(targetLabel(entry({}))).toBe("Whole home");
  });
});

describe("dailyMinutes", () => {
  it("averages minutes per day over each task's frequency, rounded", () => {
    expect(
      dailyMinutes([
        entry({ minutes: 5, frequencyDays: 1 }),
        entry({ minutes: 14, frequencyDays: 7 }),
        entry({ minutes: 10, frequencyDays: 4 }),
      ]),
    ).toBe(10);
    expect(dailyMinutes([])).toBe(0);
  });
});

describe("groupByTarget", () => {
  it("AC2: puts the whole home first, then rooms in inventory order", () => {
    const groups = groupByTarget(
      [
        entry({ id: "1", roomId: "bath", roomName: "Bath" }),
        entry({ id: "2" }),
        entry({ id: "3", roomId: "kitchen", roomName: "Kitchen" }),
        entry({ id: "4", roomId: "bath", roomName: "Bath", itemId: "m", itemName: "Mirror" }),
      ],
      ["kitchen", "bath"],
    );
    expect(groups.map((g) => [g.title, g.entries.map((e) => e.id)])).toEqual([
      ["Whole home", ["2"]],
      ["Kitchen", ["3"]],
      ["Bath", ["1", "4"]],
    ]);
  });

  it("leaves out empty groups", () => {
    expect(groupByTarget([], ["kitchen"])).toEqual([]);
  });
});
