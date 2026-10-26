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

export type ScheduleInput = {
  tasks: readonly SchedulerTask[];
  settings: Budgets;
  /** Each task's latest completion before `from`; tasks without one are new. */
  lastDone: ReadonlyMap<string, DayNumber>;
  from: DayNumber;
  /** Last day to plan, inclusive. */
  to: DayNumber;
};

export type PlannedDay = { day: DayNumber; taskIds: string[] };

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
  settings: Budgets,
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
      if (budgetFor(settings, due) === 0) continue;
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

function nextCleaningDay(settings: Budgets, day: DayNumber): DayNumber {
  for (let next = day + 1; next <= day + 7; next++) {
    if (budgetFor(settings, next) > 0) {
      return next;
    }
  }
  return Number.POSITIVE_INFINITY;
}

/** Early work fills a bit past the average load, to build slack before busy days. */
const HEADROOM = 1.15;

/**
 * The share of each day's budget that the average load needs, so bigger budgets (weekends) take
 * proportionally more and sessions stay even instead of full.
 */
function fillRatio(tasks: readonly SchedulerTask[], settings: Budgets): number {
  const needed = tasks.reduce((sum, t) => sum + t.minutes / t.frequencyDays, 0);
  const available = availablePerDay(settings);
  return available === 0 ? 0 : Math.min(1, (needed / available) * HEADROOM);
}

/** How many upcoming cleaning days are checked for deadlines that won't fit. */
const LOOKAHEAD_CLEANING_DAYS = 6;

/** Packs the tasks that can't wait for the next cleaning day; returns the ones that didn't fit. */
function packMustDo(
  states: readonly State[],
  settings: Budgets,
  day: DayNumber,
  taken: string[],
): { used: number; skipped: State[] } {
  const budget = budgetFor(settings, day);
  const next = nextCleaningDay(settings, day);
  const mustDo = states.filter((s) => s.earliest <= day && s.due < next).sort(bySlack(day));
  let used = 0;
  const skipped: State[] = [];
  for (const state of mustDo) {
    if (used + state.task.minutes <= budget) {
      used += state.task.minutes;
      taken.push(state.task.id);
      complete(state, day);
    } else {
      skipped.push(state);
    }
  }
  return { used, skipped };
}

/**
 * Dry-runs the next cleaning days with only the work that can't wait, and returns the first day
 * on which some of it wouldn't fit, with the tasks that would be late.
 */
function firstCollision(
  states: readonly State[],
  settings: Budgets,
  day: DayNumber,
): { day: DayNumber; late: Set<string> } | null {
  const copies = states.map((s) => ({ ...s }));
  let current = day;
  for (let i = 0; i < LOOKAHEAD_CLEANING_DAYS; i++) {
    current = nextCleaningDay(settings, current);
    if (!Number.isFinite(current)) return null;
    const { skipped } = packMustDo(copies, settings, current, []);
    if (skipped.length > 0) {
      return { day: current, late: new Set(skipped.map((s) => s.task.id)) };
    }
  }
  return null;
}

/**
 * Plans each day from `from` to `to`. Cleaning tasks are packed into each cleaning day's budget:
 * first the ones that can't wait for the next cleaning day, by overdue ratio; then work that a
 * coming day couldn't fit; then early work up to the day's share of the average load. Routines go
 * on every day they are due, outside the budget.
 * Deterministic: ties break by frequency, name, and id. See ADR 0007.
 */
export function schedule({ tasks, settings, lastDone, from, to }: ScheduleInput): PlannedDay[] {
  const cleaning = tasks.filter((t) => t.kind === "cleaning");
  const routines = tasks
    .filter((t) => t.kind === "routine")
    .map((t) => routineState(t, lastDone.get(t.id), from))
    .sort((a, b) => compareTasks(a.task, b.task));
  const states = cleaningStates(cleaning, settings, lastDone, from);
  const ratio = fillRatio(cleaning, settings);
  const plan: PlannedDay[] = [];

  for (let day = from; day <= to; day++) {
    const taskIds: string[] = [];
    const budget = budgetFor(settings, day);

    if (budget > 0) {
      let { used } = packMustDo(states, settings, day, taskIds);
      const take = (state: State) => {
        used += state.task.minutes;
        taskIds.push(state.task.id);
        complete(state, day);
      };
      const early = () =>
        states.filter((s) => s.earliest <= day && !taskIds.includes(s.task.id)).sort(bySlack(day));

      // While a coming day would bump work past its due date, do some of that day's work now:
      // the tasks that would be late if they can be done today, otherwise others due by then.
      for (let attempt = 0; attempt < LOOKAHEAD_CLEANING_DAYS; attempt++) {
        const collision = firstCollision(states, settings, day);
        if (!collision) break;
        const candidates = early().filter((s) => s.due <= collision.day);
        const pick =
          candidates.find(
            (s) => collision.late.has(s.task.id) && used + s.task.minutes <= budget,
          ) ?? candidates.find((s) => used + s.task.minutes <= budget);
        if (!pick) break;
        take(pick);
      }

      const limit = Math.ceil(budget * ratio);
      for (const state of early()) {
        if (used + state.task.minutes <= limit) take(state);
      }
    }

    for (const state of routines) {
      if (state.due <= day) {
        taskIds.push(state.task.id);
        complete(state, day);
      }
    }

    plan.push({ day, taskIds });
  }
  return plan;
}
