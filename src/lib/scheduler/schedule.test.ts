import { describe, expect, it } from "vitest";
import { type DayNumber, toDayNumber, weekdayIndex } from "./dates";
import { type SchedulerTask, schedule } from "./schedule";
import { availablePerDay, type Budgets, budgetFor } from "./settings";

const MONDAY = toDayNumber("2026-10-26");
const EVERY_DAY: Budgets = {
  startTimes: Array(7).fill("06:30"),
  weekdayMinutes: 45,
  weekendMinutes: 60,
};
const WEDNESDAY_OFF: Budgets = {
  ...EVERY_DAY,
  startTimes: EVERY_DAY.startTimes.map((time, i) => (i === 2 ? null : time)),
};

function cleaning(id: string, minutes: number, frequencyDays: number): SchedulerTask {
  return { id, name: id, kind: "cleaning", minutes, frequencyDays };
}

/** A home like the owner's: about 35 minutes of cleaning a day on average. */
const HOME: SchedulerTask[] = [
  cleaning("toilet-light", 5, 3),
  cleaning("toilet-deep", 15, 10),
  cleaning("sink", 5, 3),
  cleaning("mirror", 5, 7),
  cleaning("shower", 15, 7),
  cleaning("floor-touch-up", 15, 4),
  cleaning("counters", 5, 2),
  cleaning("stove", 10, 7),
  cleaning("fridge", 20, 30),
  cleaning("windows-living", 20, 30),
  cleaning("windows-bedroom", 15, 30),
  cleaning("closet-dust", 10, 14),
  cleaning("closet-empty", 30, 90),
  cleaning("shelves", 10, 14),
  cleaning("desk", 5, 7),
  cleaning("sofa", 15, 14),
  cleaning("balcony-quick", 10, 7),
  cleaning("balcony-deep", 30, 30),
  cleaning("lamps", 10, 30),
  cleaning("doors", 15, 30),
  cleaning("rug", 10, 14),
  cleaning("table", 5, 3),
];

function averageLoad(tasks: SchedulerTask[]): number {
  return tasks.reduce((sum, t) => sum + t.minutes / t.frequencyDays, 0);
}

function run(tasks: SchedulerTask[], budgets: Budgets, days: number, lastDone = new Map()) {
  return schedule({
    tasks,
    people: [{ id: "owner", budgets, start: MONDAY }],
    lastDone,
    from: MONDAY,
    to: MONDAY + days - 1,
  }).days;
}

function sessionsOf(plan: ReturnType<typeof run>, id: string): DayNumber[] {
  return plan.filter((day) => day.taskIds.includes(id)).map((day) => day.day);
}

function minutesOn(tasks: SchedulerTask[], taskIds: string[]): number {
  return taskIds.reduce((sum, id) => sum + (tasks.find((t) => t.id === id)?.minutes ?? 0), 0);
}

describe("schedule", () => {
  it("returns one entry per day in the range", () => {
    const plan = run(HOME, EVERY_DAY, 7);
    expect(plan.map((d) => d.day)).toEqual([0, 1, 2, 3, 4, 5, 6].map((i) => MONDAY + i));
  });

  it("AC3: never exceeds the day's budget and leaves days off empty", () => {
    for (const budgets of [EVERY_DAY, WEDNESDAY_OFF]) {
      const plan = run(HOME, budgets, 120);
      for (const day of plan) {
        expect(minutesOn(HOME, day.taskIds)).toBeLessThanOrEqual(budgetFor(budgets, day.day));
        if (budgetFor(budgets, day.day) === 0) {
          expect(day.taskIds).toEqual([]);
        }
      }
    }
  });

  it("AC4: staggers new tasks into their first period and keeps every gap within bounds", () => {
    expect(averageLoad(HOME)).toBeLessThan(45);
    for (const budgets of [EVERY_DAY, WEDNESDAY_OFF]) {
      const plan = run(HOME, budgets, 120);
      for (const task of HOME) {
        const sessions = sessionsOf(plan, task.id);
        const f = task.frequencyDays;
        expect(sessions[0], task.id).toBeLessThan(MONDAY + f);
        for (let i = 1; i < sessions.length; i++) {
          const gap = (sessions[i] ?? 0) - (sessions[i - 1] ?? 0);
          expect(gap, `${task.id} gap`).toBeGreaterThanOrEqual(Math.max(1, Math.floor(f * 0.75)));
          expect(gap, `${task.id} gap`).toBeLessThanOrEqual(f);
        }
      }
    }
  });

  it("AC4: spreads new tasks instead of filling the first day", () => {
    const plan = run(HOME, EVERY_DAY, 7);
    const first = minutesOn(HOME, plan[0]?.taskIds ?? []);
    expect(first).toBeLessThan(45);
    expect(first).toBeGreaterThan(0);
  });

  it("AC4: puts daily tasks on every cleaning day", () => {
    const tasks = [...HOME.slice(0, 5), cleaning("daily", 5, 1)];
    const plan = run(tasks, WEDNESDAY_OFF, 21);
    for (const day of plan) {
      expect(day.taskIds.includes("daily")).toBe(weekdayIndex(day.day) !== 2);
    }
  });

  it("AC5: under overload, the higher overdue ratio goes first", () => {
    const tasks = [cleaning("every-30", 30, 30), cleaning("every-3", 30, 3)];
    const lastDone = new Map([
      ["every-30", MONDAY - 32],
      ["every-3", MONDAY - 5],
    ]);
    const tight: Budgets = { ...EVERY_DAY, weekdayMinutes: 30 };
    const plan = run(tasks, tight, 1, lastDone);
    expect(plan[0]?.taskIds).toEqual(["every-3"]);
  });

  it("AC5: under overload, every task still appears within twice its frequency", () => {
    const heavy = [...HOME, ...HOME.map((t) => ({ ...t, id: `${t.id}-2`, name: `${t.name} 2` }))];
    expect(averageLoad(heavy)).toBeGreaterThan(45);
    const plan = run(heavy, EVERY_DAY, 120);
    for (const task of heavy) {
      const sessions = sessionsOf(plan, task.id);
      const f = task.frequencyDays;
      expect(sessions[0], task.id).toBeLessThan(MONDAY + 2 * f);
      for (let i = 1; i < sessions.length; i++) {
        expect((sessions[i] ?? 0) - (sessions[i - 1] ?? 0), task.id).toBeLessThanOrEqual(2 * f);
      }
    }
  });

  /**
   * Random homes whose average load is at most 60% of the time available. The scheduler packs
   * whole tasks greedily, so it can't promise every repetition is on time; these bounds are what
   * it achieves. Budgets of 45 or more, since a cleaning task takes at most 30 minutes.
   */
  function randomHomes(daysOff: boolean) {
    let seed = 42;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    const pick = <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)] as T;
    const homes: { budgets: Budgets; tasks: SchedulerTask[] }[] = [];
    while (homes.length < 200) {
      const budgets: Budgets = {
        startTimes: Array.from({ length: 7 }, () => (daysOff && random() < 0.2 ? null : "06:30")),
        weekdayMinutes: pick([45, 60, 90]),
        weekendMinutes: pick([45, 60, 90]),
      };
      if (budgets.startTimes.every((time) => time === null)) continue;
      const tasks: SchedulerTask[] = [];
      while (true) {
        const next = cleaning(
          `t${tasks.length}`,
          pick([5, 10, 15, 20, 30]),
          pick([2, 3, 4, 7, 10, 14, 30, 60, 90]),
        );
        if (averageLoad([...tasks, next]) > availablePerDay(budgets) * 0.6) break;
        tasks.push(next);
      }
      homes.push({ budgets, tasks });
    }
    return homes;
  }

  /** How often, and by how many days at most, a repetition (first ones included) runs late. */
  function lateness(daysOff: boolean) {
    const late: number[] = [];
    let repetitions = 0;
    for (const { budgets, tasks } of randomHomes(daysOff)) {
      const plan = run(tasks, budgets, 120);
      for (const day of plan) {
        expect(minutesOn(tasks, day.taskIds)).toBeLessThanOrEqual(budgetFor(budgets, day.day));
      }
      for (const task of tasks) {
        const sessions = [MONDAY - 1, ...sessionsOf(plan, task.id)];
        for (let i = 1; i < sessions.length; i++) {
          repetitions++;
          const over = (sessions[i] ?? 0) - (sessions[i - 1] ?? 0) - task.frequencyDays;
          if (over > 0) late.push(over);
        }
      }
    }
    return { share: late.length / repetitions, worst: Math.max(0, ...late) };
  }

  it("AC3 and AC4: random homes cleaning every day are almost always on time", () => {
    const { share, worst } = lateness(false);
    expect(share).toBeLessThan(0.001);
    expect(worst).toBeLessThanOrEqual(1);
  });

  it("AC3 and AC4: random homes with days off stay close to their frequency", () => {
    const { share, worst } = lateness(true);
    expect(share).toBeLessThan(0.05);
    expect(worst).toBeLessThanOrEqual(3);
  });

  it("AC6: the same input gives the same plan, whatever the task order", () => {
    const a = run(HOME, WEDNESDAY_OFF, 60);
    const b = run([...HOME].reverse(), WEDNESDAY_OFF, 60);
    expect(b).toEqual(a);
  });

  it("continues from the last completion", () => {
    const tasks = [cleaning("weekly", 10, 7)];
    const plan = run(tasks, EVERY_DAY, 14, new Map([["weekly", MONDAY - 2]]));
    expect(sessionsOf(plan, "weekly")[0]).toBeGreaterThanOrEqual(MONDAY + 3);
    expect(sessionsOf(plan, "weekly")[0]).toBeLessThanOrEqual(MONDAY + 5);
  });

  it("places routines on every day they are due, including days off, outside the budget", () => {
    const tasks: SchedulerTask[] = [
      { id: "bed", name: "Make the bed", kind: "routine", minutes: 2, frequencyDays: 1 },
      { id: "laundry", name: "Laundry", kind: "routine", minutes: 60, frequencyDays: 3 },
      cleaning("counters", 5, 2),
    ];
    const plan = run(tasks, WEDNESDAY_OFF, 9);
    expect(sessionsOf(plan, "bed")).toHaveLength(9);
    expect(sessionsOf(plan, "laundry")).toEqual([MONDAY, MONDAY + 3, MONDAY + 6]);
  });

  it("reports the first due day picked for new cleaning tasks only", () => {
    const tasks = [
      cleaning("monthly", 20, 30),
      cleaning("weekly", 10, 7),
      { ...cleaning("bed", 2, 1), kind: "routine" as const },
    ];
    const { firstDues } = schedule({
      tasks,
      people: [{ id: "owner", budgets: EVERY_DAY, start: MONDAY }],
      lastDone: new Map([["weekly", MONDAY - 3]]),
      from: MONDAY,
      to: MONDAY + 6,
    });
    expect([...firstDues.keys()]).toEqual(["monthly"]);
    expect(firstDues.get("monthly")).toBeGreaterThanOrEqual(MONDAY);
    expect(firstDues.get("monthly")).toBeLessThan(MONDAY + 30);
  });
});

describe("schedule for a household", () => {
  const SHORT: Budgets = { ...EVERY_DAY, weekdayMinutes: 30, weekendMinutes: 30 };
  const LONG: Budgets = { ...EVERY_DAY, weekdayMinutes: 90, weekendMinutes: 90 };

  function household(
    people: { id: string; budgets: Budgets; start?: DayNumber }[],
    days: number,
    options: {
      tasks?: SchedulerTask[];
      kept?: { personId: string; taskId: string; day: DayNumber }[];
    } = {},
  ) {
    return schedule({
      tasks: options.tasks ?? HOME,
      people: people.map((p) => ({ ...p, start: p.start ?? MONDAY })),
      kept: options.kept,
      lastDone: new Map(),
      from: MONDAY,
      to: MONDAY + days - 1,
    }).days;
  }

  function minutesBy(plan: ReturnType<typeof household>, tasks: SchedulerTask[] = HOME) {
    const totals = new Map<string, number>();
    for (const day of plan) {
      for (const [person, ids] of day.byPerson) {
        totals.set(person, (totals.get(person) ?? 0) + minutesOn(tasks, ids));
      }
    }
    return totals;
  }

  it("AC5: gives every task to one person and never exceeds anyone's budget", () => {
    const people = [
      { id: "a", budgets: EVERY_DAY },
      { id: "b", budgets: WEDNESDAY_OFF },
    ];
    const plan = household(people, 60);
    for (const day of plan) {
      const given = [...day.byPerson.values()].flat();
      expect(given.toSorted()).toEqual(day.taskIds.toSorted());
      for (const person of people) {
        const minutes = minutesOn(HOME, day.byPerson.get(person.id) ?? []);
        expect(minutes).toBeLessThanOrEqual(budgetFor(person.budgets, day.day));
      }
    }
  });

  it("AC5: splits the minutes in proportion to each person's available time", () => {
    const even = minutesBy(
      household(
        [
          { id: "a", budgets: EVERY_DAY },
          { id: "b", budgets: EVERY_DAY },
        ],
        28,
      ),
    );
    const a = even.get("a") ?? 0;
    const b = even.get("b") ?? 0;
    expect(Math.abs(a - b) / (a + b)).toBeLessThan(0.1);

    const uneven = minutesBy(
      household(
        [
          { id: "a", budgets: SHORT },
          { id: "b", budgets: LONG },
        ],
        28,
      ),
    );
    const short = uneven.get("a") ?? 0;
    const long = uneven.get("b") ?? 0;
    expect(short / (short + long)).toBeGreaterThan(0.25 * 0.8);
    expect(short / (short + long)).toBeLessThan(0.25 * 1.2);
  });

  it("AC5: plans the whole home with two people as with one person with both budgets", () => {
    const plan = household(
      [
        { id: "a", budgets: SHORT },
        { id: "b", budgets: SHORT },
      ],
      90,
    );
    for (const task of HOME) {
      const sessions = sessionsOf(plan, task.id);
      for (let i = 1; i < sessions.length; i++) {
        expect((sessions[i] ?? 0) - (sessions[i - 1] ?? 0), task.id).toBeLessThanOrEqual(
          task.frequencyDays + 1,
        );
      }
    }
  });

  it("AC5: gives nothing to a person on a day off", () => {
    const plan = household(
      [
        { id: "a", budgets: EVERY_DAY },
        { id: "b", budgets: WEDNESDAY_OFF },
      ],
      14,
    );
    for (const day of plan.filter((d) => weekdayIndex(d.day) === 2)) {
      expect(day.byPerson.get("b") ?? []).toEqual([]);
    }
  });

  it("keeps a person's tasks before their start and counts them as handled", () => {
    const tasks = [cleaning("counters", 5, 2), cleaning("sink", 10, 7)];
    const plan = household(
      [
        { id: "a", budgets: EVERY_DAY },
        { id: "b", budgets: EVERY_DAY, start: MONDAY + 1 },
      ],
      7,
      { tasks, kept: [{ personId: "b", taskId: "counters", day: MONDAY }] },
    );
    expect(plan[0]?.byPerson.get("b")).toBeUndefined();
    expect(plan[0]?.taskIds).not.toContain("counters");
    expect(sessionsOf(plan, "counters")[0]).toBeGreaterThanOrEqual(MONDAY + 1);
  });

  it("shares routines, preferring people with a session that day", () => {
    const tasks: SchedulerTask[] = [
      { id: "bed", name: "Make the bed", kind: "routine", minutes: 2, frequencyDays: 1 },
      { id: "dishes", name: "Dishes", kind: "routine", minutes: 15, frequencyDays: 1 },
    ];
    const plan = household(
      [
        { id: "a", budgets: EVERY_DAY },
        { id: "b", budgets: WEDNESDAY_OFF },
      ],
      14,
      {
        tasks,
      },
    );
    const routineMinutes = minutesBy(plan, tasks);
    expect(routineMinutes.get("a")).toBeGreaterThan(0);
    expect(routineMinutes.get("b")).toBeGreaterThan(0);
    for (const day of plan.filter((d) => weekdayIndex(d.day) === 2)) {
      expect(day.byPerson.get("b") ?? []).toEqual([]);
      expect(day.byPerson.get("a")).toHaveLength(2);
    }
  });

  it("plans nothing without people", () => {
    const plan = household([], 7);
    expect(plan.every((day) => day.taskIds.length === 0)).toBe(true);
  });

  it("gives the same plan whatever the order of people", () => {
    const people = [
      { id: "a", budgets: EVERY_DAY },
      { id: "b", budgets: WEDNESDAY_OFF },
    ];
    expect(household([...people].reverse(), 30)).toEqual(household(people, 30));
  });
});
