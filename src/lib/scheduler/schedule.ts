import type { TaskKind } from "@/lib/tasks/limits";
import type { DayNumber } from "./dates";
import { availablePerDay, type Budgets, budgetFor } from "./settings";

export type SchedulerTask = {
  id: string;
  name: string;
  kind: TaskKind;
  minutes: number;
  frequencyDays: number;
};

/** A member with a schedule (ADR 0011). */
export type Person = {
  id: string;
  budgets: Budgets;
  /** First day this person may take new work; on earlier days they keep their planned tasks. */
  start: DayNumber;
};

/** An occurrence planned before its person's start, which stays and counts as handled. */
export type KeptOccurrence = { personId: string; taskId: string; day: DayNumber };

export type ScheduleInput = {
  tasks: readonly SchedulerTask[];
  people: readonly Person[];
  kept?: readonly KeptOccurrence[];
  /** Each task's latest completion before `from`; tasks without one are new. */
  lastDone: ReadonlyMap<string, DayNumber>;
  from: DayNumber;
  /** Last day to plan, inclusive. */
  to: DayNumber;
};

export type PlannedDay = {
  day: DayNumber;
  taskIds: string[];
  /** The same tasks, by the person they were given to. */
  byPerson: Map<string, string[]>;
};

export type ScheduleResult = {
  days: PlannedDay[];
  /** The first due day picked for each new cleaning task, to keep on later replans. */
  firstDues: Map<string, DayNumber>;
};

type State = { task: SchedulerTask; earliest: DayNumber; due: DayNumber };

/** A task can come back once three quarters of its frequency has passed (at least one day). */
function minimumGap(frequencyDays: number): number {
  return Math.max(1, Math.floor(frequencyDays * 0.75));
}

function stateAfter(task: SchedulerTask, last: DayNumber): State {
  return { task, earliest: last + minimumGap(task.frequencyDays), due: last + task.frequencyDays };
}

/** How far ahead new tasks are spread, in days. */
const PROJECTION_DAYS = 120;

/**
 * Gives each new cleaning task a first due day inside its first period, picking the day whose
 * projected load (this task's repetitions included) is lowest, so new tasks don't pile up.
 */
function cleaningStates(
  tasks: readonly SchedulerTask[],
  capacity: (day: DayNumber) => number,
  lastDone: ReadonlyMap<string, DayNumber>,
  from: DayNumber,
): State[] {
  const load = new Array<number>(PROJECTION_DAYS).fill(0);
  /** Average projected load on the task's repetition days; `add` books them. */
  const project = (task: SchedulerTask, due: DayNumber, add: boolean) => {
    let total = 0;
    let count = 0;
    for (let day = due - from; day < PROJECTION_DAYS; day += task.frequencyDays) {
      if (day >= 0) {
        total += load[day] ?? 0;
        count++;
        if (add) load[day] = (load[day] ?? 0) + task.minutes;
      }
    }
    return count === 0 ? 0 : total / count;
  };

  const states: State[] = [];
  const fresh: SchedulerTask[] = [];
  for (const task of tasks) {
    const last = lastDone.get(task.id);
    if (last === undefined) {
      fresh.push(task);
    } else {
      const state = stateAfter(task, last);
      project(task, Math.max(state.due, from), true);
      states.push(state);
    }
  }

  // Frequent tasks first, since they have the fewest days to choose from. Ties between equally
  // loaded days start at a different offset per task (golden-ratio stride), so infrequent tasks
  // spread over their whole period instead of filling the first days.
  fresh.sort(
    (a, b) => a.frequencyDays - b.frequencyDays || b.minutes - a.minutes || compareTasks(a, b),
  );
  for (const [index, task] of fresh.entries()) {
    const f = task.frequencyDays;
    const start = Math.floor(((index * 0.618_034) % 1) * f);
    let best = from;
    let bestLoad = Number.POSITIVE_INFINITY;
    for (let step = 0; step < f; step++) {
      const due = from + ((start + step) % f);
      if (capacity(due) === 0) continue;
      const projected = project(task, due, false);
      if (projected < bestLoad) {
        best = due;
        bestLoad = projected;
      }
    }
    project(task, best, true);
    states.push({ task, earliest: from, due: best });
  }
  return states;
}

function routineState(task: SchedulerTask, last: DayNumber | undefined, from: DayNumber): State {
  return last === undefined ? { task, earliest: from, due: from } : stateAfter(task, last);
}

function complete(state: State, day: DayNumber): void {
  state.earliest = day + minimumGap(state.task.frequencyDays);
  state.due = day + state.task.frequencyDays;
}

function compareTasks(a: SchedulerTask, b: SchedulerTask): number {
  return (
    a.frequencyDays - b.frequencyDays ||
    a.name.localeCompare(b.name) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** Slack relative to frequency; negative values are the overdue ratio. Lower goes first. */
function bySlack(day: DayNumber) {
  return (a: State, b: State) =>
    (a.due - day) / a.task.frequencyDays - (b.due - day) / b.task.frequencyDays ||
    compareTasks(a.task, b.task);
}

/** One person's room on one cleaning day. */
type Bin = { personId: string; budget: number; limit: number; used: number };

/** Planned and available cleaning minutes per person over the range, to balance the split. */
type Shares = { planned: Map<string, number>; available: Map<string, number> };

function household(people: readonly Person[]) {
  const sorted = [...people].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const active = (day: DayNumber) => sorted.filter((p) => p.start <= day);
  const capacity = (day: DayNumber) =>
    active(day).reduce((sum, p) => sum + budgetFor(p.budgets, day), 0);
  return {
    people: sorted,
    active,
    capacity,
    availablePerDay: sorted.reduce((sum, p) => sum + availablePerDay(p.budgets), 0),
    bins: (day: DayNumber, ratio: number): Bin[] =>
      active(day).flatMap((p) => {
        const budget = budgetFor(p.budgets, day);
        return budget > 0
          ? [{ personId: p.id, budget, limit: Math.ceil(budget * ratio), used: 0 }]
          : [];
      }),
    nextCleaningDay: (day: DayNumber): DayNumber => {
      for (let next = day + 1; next <= day + 7; next++) {
        if (capacity(next) > 0) {
          return next;
        }
      }
      return Number.POSITIVE_INFINITY;
    },
  };
}

type Household = ReturnType<typeof household>;

/**
 * The bin a task goes in: among those with room for it under `cap`, the person whose share of
 * the planned minutes is furthest below their share of the available minutes.
 */
function pickBin(
  bins: readonly Bin[],
  minutes: number,
  cap: "budget" | "limit",
  shares: Shares,
): Bin | undefined {
  let best: Bin | undefined;
  let bestRatio = Number.POSITIVE_INFINITY;
  for (const bin of bins) {
    if (bin.used + minutes > bin[cap]) continue;
    const ratio =
      (shares.planned.get(bin.personId) ?? 0) / (shares.available.get(bin.personId) ?? 1);
    if (ratio < bestRatio) {
      best = bin;
      bestRatio = ratio;
    }
  }
  return best;
}

/** Early work fills a bit past the average load, to build slack before busy days. */
const HEADROOM = 1.15;

/**
 * The share of each day's budget that the average load needs, so bigger budgets (weekends) take
 * proportionally more and sessions stay even instead of full.
 */
function fillRatio(tasks: readonly SchedulerTask[], available: number): number {
  const needed = tasks.reduce((sum, t) => sum + t.minutes / t.frequencyDays, 0);
  return available === 0 ? 0 : Math.min(1, (needed / available) * HEADROOM);
}

/** How many upcoming cleaning days are checked for deadlines that won't fit. */
const LOOKAHEAD_CLEANING_DAYS = 6;

/** Packs the tasks that can't wait for the next cleaning day; returns the ones that didn't fit. */
function packMustDo(
  states: readonly State[],
  bins: readonly Bin[],
  day: DayNumber,
  next: DayNumber,
  shares: Shares,
  take: (state: State, bin: Bin) => void,
): State[] {
  const mustDo = states.filter((s) => s.earliest <= day && s.due < next).sort(bySlack(day));
  const skipped: State[] = [];
  for (const state of mustDo) {
    const bin = pickBin(bins, state.task.minutes, "budget", shares);
    if (bin) {
      take(state, bin);
    } else {
      skipped.push(state);
    }
  }
  return skipped;
}

/**
 * Dry-runs the next cleaning days with only the work that can't wait, and returns the first day
 * on which some of it wouldn't fit, with the tasks that would be late.
 */
function firstCollision(
  states: readonly State[],
  home: Household,
  day: DayNumber,
  shares: Shares,
): { day: DayNumber; late: Set<string> } | null {
  const copies = states.map((s) => ({ ...s }));
  let current = day;
  for (let i = 0; i < LOOKAHEAD_CLEANING_DAYS; i++) {
    current = home.nextCleaningDay(current);
    if (!Number.isFinite(current)) return null;
    const on = current;
    const skipped = packMustDo(
      copies,
      home.bins(on, 1),
      on,
      home.nextCleaningDay(on),
      shares,
      (state, bin) => {
        bin.used += state.task.minutes;
        complete(state, on);
      },
    );
    if (skipped.length > 0) {
      return { day: current, late: new Set(skipped.map((s) => s.task.id)) };
    }
  }
  return null;
}

/**
 * Plans each day from `from` to `to` for every person with a schedule (ADR 0011). Cleaning tasks
 * are packed into each person's budget for the day: first the ones that can't wait for the next
 * cleaning day, by overdue ratio; then work that a coming day couldn't fit; then early work up to
 * the day's share of the average load. Each task goes to the person with room whose planned
 * share is furthest below their available share. Routines go on every day they are due, outside
 * the budgets, to the person with the fewest routine minutes, preferring people with a session.
 * Deterministic: ties break by frequency, name, and id, and between people by id. See ADR 0007.
 */
export function schedule({
  tasks,
  people,
  kept = [],
  lastDone,
  from,
  to,
}: ScheduleInput): ScheduleResult {
  const home = household(people);
  const cleaning = tasks.filter((t) => t.kind === "cleaning");
  const routines = tasks
    .filter((t) => t.kind === "routine")
    .map((t) => routineState(t, lastDone.get(t.id), from))
    .sort((a, b) => compareTasks(a.task, b.task));
  const states = cleaningStates(cleaning, home.capacity, lastDone, from);
  const firstDues = new Map(
    states.filter((s) => !lastDone.has(s.task.id)).map((s) => [s.task.id, s.due] as const),
  );
  const ratio = fillRatio(cleaning, home.availablePerDay);
  const shares: Shares = { planned: new Map(), available: new Map() };
  for (const person of home.people) {
    let available = 0;
    for (let day = from; day <= to; day++) available += budgetFor(person.budgets, day);
    shares.available.set(person.id, available);
  }
  const routineMinutes = new Map<string, number>();
  const stateOf = new Map([...states, ...routines].map((s) => [s.task.id, s]));
  const add = (map: Map<string, number>, id: string, minutes: number) =>
    map.set(id, (map.get(id) ?? 0) + minutes);
  const plan: PlannedDay[] = [];

  for (let day = from; day <= to; day++) {
    for (const occurrence of kept) {
      const state = occurrence.day === day ? stateOf.get(occurrence.taskId) : undefined;
      if (!state) continue;
      const minutes = state.task.minutes;
      add(
        state.task.kind === "routine" ? routineMinutes : shares.planned,
        occurrence.personId,
        minutes,
      );
      complete(state, day);
    }

    const taskIds: string[] = [];
    const byPerson = new Map<string, string[]>();
    const assign = (personId: string, state: State) => {
      taskIds.push(state.task.id);
      byPerson.set(personId, [...(byPerson.get(personId) ?? []), state.task.id]);
      complete(state, day);
    };
    const bins = home.bins(day, ratio);

    if (bins.length > 0) {
      const take = (state: State, bin: Bin) => {
        bin.used += state.task.minutes;
        add(shares.planned, bin.personId, state.task.minutes);
        assign(bin.personId, state);
      };
      packMustDo(states, bins, day, home.nextCleaningDay(day), shares, take);
      const early = () =>
        states.filter((s) => s.earliest <= day && !taskIds.includes(s.task.id)).sort(bySlack(day));
      const fits = (s: State) => pickBin(bins, s.task.minutes, "budget", shares);

      // While a coming day would bump work past its due date, do some of that day's work now:
      // the tasks that would be late if they can be done today, otherwise others due by then.
      for (let attempt = 0; attempt < LOOKAHEAD_CLEANING_DAYS; attempt++) {
        const collision = firstCollision(states, home, day, shares);
        if (!collision) break;
        const candidates = early().filter((s) => s.due <= collision.day);
        const pick =
          candidates.find((s) => collision.late.has(s.task.id) && fits(s)) ??
          candidates.find((s) => fits(s));
        const bin = pick && fits(pick);
        if (!pick || !bin) break;
        take(pick, bin);
      }

      for (const state of early()) {
        const bin = pickBin(bins, state.task.minutes, "limit", shares);
        if (bin) take(state, bin);
      }
    }

    const present = home.active(day);
    for (const state of routines) {
      if (state.due > day || present.length === 0) continue;
      const person = routinePerson(present, day, routineMinutes);
      add(routineMinutes, person.id, state.task.minutes);
      assign(person.id, state);
    }

    plan.push({ day, taskIds, byPerson });
  }
  return { days: plan, firstDues };
}

/** Who does a routine: people with a session that day first, then the fewest routine minutes. */
function routinePerson(
  present: readonly Person[],
  day: DayNumber,
  routineMinutes: ReadonlyMap<string, number>,
): Person {
  const working = present.filter((p) => budgetFor(p.budgets, day) > 0);
  const pool = working.length > 0 ? working : present;
  return pool.reduce((best, p) =>
    (routineMinutes.get(p.id) ?? 0) < (routineMinutes.get(best.id) ?? 0) ? p : best,
  );
}
