import type { DayNumber } from "@/lib/scheduler/dates";

export const FRESHNESS_STATES = ["fresh", "good", "due", "overdue"] as const;
export type FreshnessState = (typeof FRESHNESS_STATES)[number];

export type FreshnessTask = {
  frequencyDays: number;
  /** The day the task was added, which a task never done counts from. */
  addedOn: DayNumber;
  /** The latest day it was done; skips don't count, since they don't clean the room. */
  lastDone: DayNumber | null;
};

export type RoomFreshness = { state: FreshnessState; lastCleaned: DayNumber | null };

/** Upper bounds of the time since the last completion over the frequency (spec 014). */
const LIMITS: readonly [number, FreshnessState][] = [
  [0.5, "fresh"],
  [1, "good"],
  [1.5, "due"],
];

/** A room's freshness from its cleaning tasks and its items', or null when it has none. */
export function roomFreshness(
  tasks: readonly FreshnessTask[],
  today: DayNumber,
): RoomFreshness | null {
  if (tasks.length === 0) {
    return null;
  }
  const behind = Math.max(
    ...tasks.map((t) => (today - (t.lastDone ?? t.addedOn)) / Math.max(t.frequencyDays, 1)),
  );
  const done = tasks.flatMap((t) => (t.lastDone === null ? [] : [t.lastDone]));
  return {
    state: LIMITS.find(([limit]) => behind < limit)?.[1] ?? "overdue",
    lastCleaned: done.length === 0 ? null : Math.max(...done),
  };
}

export function lastCleanedLabel(lastCleaned: DayNumber | null, today: DayNumber): string {
  if (lastCleaned === null) {
    return "Not cleaned yet";
  }
  const days = today - lastCleaned;
  if (days <= 0) {
    return "Last cleaned today";
  }
  return days === 1 ? "Last cleaned yesterday" : `Last cleaned ${days} days ago`;
}
