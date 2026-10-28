import type { DayNumber } from "@/lib/scheduler/dates";
import { byPlace } from "@/lib/scheduler/format";
import { type OrderableTask, sessionOrder } from "./order";
import type { DayCounts, TodayTask } from "./progress";
import { EDITABLE_PAST_DAYS } from "./schemas";

export type EarlierTask = TodayTask & OrderableTask;

export type EarlierDay = {
  day: DayNumber;
  dayOff: boolean;
  /** Cleaning tasks in session order, then routines. */
  tasks: EarlierTask[];
};

/**
 * The editable days before today, newest first, starting at the oldest one with tasks so days
 * before the owner's first plan aren't listed.
 */
export function earlierDays(
  today: DayNumber,
  rows: readonly { day: DayNumber; task: EarlierTask }[],
  isDayOff: (day: DayNumber) => boolean,
): EarlierDay[] {
  const byDay = new Map<DayNumber, EarlierTask[]>();
  for (const { day, task } of rows) {
    if (day < today && day >= today - EDITABLE_PAST_DAYS) {
      byDay.set(day, [...(byDay.get(day) ?? []), task]);
    }
  }
  if (byDay.size === 0) {
    return [];
  }
  const oldest = Math.min(...byDay.keys());
  const days: EarlierDay[] = [];
  for (let day = today - 1; day >= oldest; day--) {
    const tasks = byDay.get(day) ?? [];
    days.push({
      day,
      dayOff: tasks.length === 0 && isDayOff(day),
      tasks: [
        ...sessionOrder(tasks.filter((t) => t.kind === "cleaning")),
        ...tasks.filter((t) => t.kind === "routine").sort(byPlace),
      ],
    });
  }
  return days;
}

/** How many of the editable days before today still have unchecked cleaning tasks. */
export function uncheckedDays(
  history: ReadonlyMap<DayNumber, DayCounts>,
  today: DayNumber,
): number {
  let count = 0;
  for (const [day, { total, done, skipped }] of history) {
    if (day < today && day >= today - EDITABLE_PAST_DAYS && done + skipped < total) {
      count++;
    }
  }
  return count;
}
