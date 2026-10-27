import type { OccurrenceStatus } from "@/db/schema";
import type { PlanTask } from "@/lib/scheduler/format";

export type TodayTask = PlanTask & {
  occurrenceId: string;
  status: OccurrenceStatus;
  /** Minutes the owner noted for a done task, or null. */
  actualMinutes: number | null;
};

export type DayCounts = { total: number; done: number; skipped: number };

/** A cleaning day is complete when every task was done or skipped, and at least one was done. */
export function isComplete({ total, done, skipped }: DayCounts): boolean {
  return total > 0 && done > 0 && done + skipped === total;
}

export type Progress = {
  doneMinutes: number;
  /** The session's minutes without skipped tasks. */
  totalMinutes: number;
  complete: boolean;
};

export function progressOf(tasks: readonly TodayTask[]): Progress {
  const cleaning = tasks.filter((t) => t.kind === "cleaning");
  const kept = cleaning.filter((t) => t.status !== "skipped");
  return {
    doneMinutes: kept.filter((t) => t.status === "done").reduce((sum, t) => sum + t.minutes, 0),
    totalMinutes: kept.reduce((sum, t) => sum + t.minutes, 0),
    complete: isComplete(countsOf(cleaning)),
  };
}

export function countsOf(cleaning: readonly TodayTask[]): DayCounts {
  return {
    total: cleaning.length,
    done: cleaning.filter((t) => t.status === "done").length,
    skipped: cleaning.filter((t) => t.status === "skipped").length,
  };
}
