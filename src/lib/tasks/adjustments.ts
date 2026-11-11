import type { AdjustmentChange } from "@/db/schema/tasks";

/** Spec 017. */
export const ADJUSTMENTS = {
  /** Recorded times that make a task worth reviewing, like calibration (spec 011). */
  minTimes: 3,
  /** How many of the latest times and notes the AI sees per task. */
  timesWindow: 10,
  notesWindow: 5,
  /** Tasks per request; the ones with the most data go first. */
  tasksMax: 40,
  /** What a card shows of what the AI saw. */
  evidenceTimes: 5,
  evidenceNotes: 2,
} as const;

/** A cleaning task's done times and notes since its baseline, newest first. */
export type TaskHistory = {
  times: { date: string; minutes: number }[];
  notes: { date: string; note: string }[];
};

/** A cleaning task with its history, as the AI reviews it. */
export type ReviewTask = {
  id: string;
  name: string;
  minutes: number;
  frequencyDays: number;
  roomId: string | null;
  roomName: string | null;
  itemId: string | null;
  itemName: string | null;
  history: TaskHistory;
};

export function qualifies(history: TaskHistory): boolean {
  return history.times.length >= ADJUSTMENTS.minTimes || history.notes.length > 0;
}

export function reviewLine(count: number): string {
  if (count === 0) {
    return "Record times or add notes to get suggestions.";
  }
  return `Reviews ${count} ${count === 1 ? "task" : "tasks"} with recorded times or notes`;
}

const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function shortDate(isoDate: string): string {
  return DAY.format(new Date(`${isoDate}T00:00:00Z`));
}

/** "Last 5: 14, 16, 15, 22, 15 min · Note on Oct 20: full deep clean". */
export function evidenceLine(history: TaskHistory): string {
  const parts: string[] = [];
  const times = history.times.slice(0, ADJUSTMENTS.evidenceTimes);
  if (times.length > 0) {
    const values = times.map((t) => t.minutes).reverse();
    parts.push(`Last ${times.length}: ${values.join(", ")} min`);
  }
  for (const { date, note } of history.notes.slice(0, ADJUSTMENTS.evidenceNotes)) {
    parts.push(`Note on ${shortDate(date)}: ${note}`);
  }
  return parts.join(" · ");
}

export type AdjustmentValues = {
  change: AdjustmentChange;
  name?: string | null;
  minutes?: number | null;
  frequencyDays?: number | null;
};

function every(days: number): string {
  return days === 1 ? "every day" : `every ${days} days`;
}

/** "10 → 15 min", "Every 7 → 14 days", or "New: Deep clean the oven, 30 min, every 30 days". */
export function changeLabel(
  adjustment: AdjustmentValues,
  current: { minutes: number; frequencyDays: number },
): string {
  switch (adjustment.change) {
    case "minutes":
      return `${current.minutes} → ${adjustment.minutes} min`;
    case "frequency": {
      const to = adjustment.frequencyDays ?? current.frequencyDays;
      return current.frequencyDays === 1 || to === 1
        ? `Every ${current.frequencyDays === 1 ? "day" : `${current.frequencyDays} days`} → ${every(to)}`
        : `Every ${current.frequencyDays} → ${to} days`;
    }
    case "new_task":
      return `New: ${adjustment.name}, ${adjustment.minutes} min, ${every(adjustment.frequencyDays ?? 1)}`;
  }
}
