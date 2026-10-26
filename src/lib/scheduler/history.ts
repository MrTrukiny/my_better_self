import type { DayNumber } from "./dates";

export type PastOccurrence = {
  taskId: string;
  day: DayNumber;
  status: "scheduled" | "done" | "skipped";
};

export type HistoryTask = {
  id: string;
  frequencyDays: number;
  /** The first due day picked while the task was never done, if any. */
  firstDue: DayNumber | null;
};

/**
 * Each task's last completion as the scheduler sees it, from the occurrences before the
 * replanning date. Done and skipped count as completions. A task that was planned but never
 * handled counts as due on its first missed day, and one that was never planned keeps its saved
 * first due day; both are expressed as a completion one period earlier. Tasks missing from the
 * result are new. See ADR 0008.
 */
export function lastCompletions(
  tasks: readonly HistoryTask[],
  past: readonly PastOccurrence[],
): Map<string, DayNumber> {
  const handled = new Map<string, DayNumber>();
  const firstPlanned = new Map<string, DayNumber>();
  for (const { taskId, day, status } of past) {
    if (status !== "scheduled") {
      handled.set(taskId, Math.max(day, handled.get(taskId) ?? day));
    }
    firstPlanned.set(taskId, Math.min(day, firstPlanned.get(taskId) ?? day));
  }

  const result = new Map<string, DayNumber>();
  for (const task of tasks) {
    const done = handled.get(task.id);
    const due = firstPlanned.get(task.id) ?? task.firstDue;
    if (done !== undefined) {
      result.set(task.id, done);
    } else if (due !== undefined && due !== null) {
      result.set(task.id, due - task.frequencyDays);
    }
  }
  return result;
}
