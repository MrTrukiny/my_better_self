import type { TaskKind } from "@/lib/tasks/limits";
import { type DayNumber, formatTime, parseTime, toIsoDate } from "./dates";
import type { LoadSummary } from "./load";
import { type Budgets, budgetFor, PLAN_DAYS, startTimeFor } from "./settings";

export type PlanTask = {
  id: string;
  kind: TaskKind;
  name: string;
  minutes: number;
  roomName: string | null;
  itemName: string | null;
};

export type PlanOccurrence = { date: string; task: PlanTask };

export type PlanDayView = {
  date: string;
  isToday: boolean;
  off: boolean;
  start: string | null;
  end: string | null;
  budget: number;
  total: number;
  cleaning: PlanTask[];
  routines: PlanTask[];
};

/** The plan's days from `today`, with tasks ordered by where they are, then by name. */
export function buildWeek(
  settings: Budgets,
  occurrences: readonly PlanOccurrence[],
  today: DayNumber,
): PlanDayView[] {
  return Array.from({ length: PLAN_DAYS }, (_, offset) => {
    const day = today + offset;
    const date = toIsoDate(day);
    const tasks = occurrences
      .filter((o) => o.date === date)
      .map((o) => o.task)
      .sort(byPlace);
    const cleaning = tasks.filter((t) => t.kind === "cleaning");
    const total = cleaning.reduce((sum, t) => sum + t.minutes, 0);
    const start = startTimeFor(settings, day);
    const startMinutes = start === null ? null : parseTime(start);
    return {
      date,
      isToday: offset === 0,
      off: start === null,
      start,
      end: startMinutes === null ? null : formatTime(startMinutes + total),
      budget: budgetFor(settings, day),
      total,
      cleaning,
      routines: tasks.filter((t) => t.kind === "routine"),
    };
  });
}

function byPlace(a: PlanTask, b: PlanTask): number {
  return (
    (a.roomName ?? "").localeCompare(b.roomName ?? "") ||
    (a.itemName ?? "").localeCompare(b.itemName ?? "") ||
    a.name.localeCompare(b.name) ||
    a.id.localeCompare(b.id)
  );
}

const DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** "Monday, Oct 26" for an ISO date. */
export function dayLabel(isoDate: string): string {
  return DAY_FORMAT.format(new Date(`${isoDate}T00:00:00Z`));
}

export function planTarget(task: PlanTask): string {
  if (!task.roomName) {
    return "Whole home";
  }
  return task.itemName ? `${task.roomName}, ${task.itemName}` : task.roomName;
}

export function loadLine(summary: LoadSummary): string {
  return `Your tasks need about ${Math.round(summary.neededPerDay)} min a day; you have about ${Math.round(summary.availablePerDay)}.`;
}
