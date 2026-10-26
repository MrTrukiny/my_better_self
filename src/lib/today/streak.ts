import type { DayNumber } from "@/lib/scheduler/dates";
import { type DayCounts, isComplete } from "./progress";

/**
 * Consecutive complete cleaning days, counting back from today. Days without cleaning tasks
 * (days off, empty days) neither break nor extend it, and an unfinished today doesn't break
 * it while the day is still going.
 */
export function streakOf(
  days: ReadonlyMap<DayNumber, DayCounts>,
  today: DayNumber,
  todayCounts: DayCounts,
): number {
  let streak = isComplete(todayCounts) ? 1 : 0;
  const past = [...days.entries()]
    .filter(([day, counts]) => day < today && counts.total > 0)
    .sort(([a], [b]) => b - a);
  for (const [, counts] of past) {
    if (!isComplete(counts)) {
      break;
    }
    streak++;
  }
  return streak;
}

export function streakLine(streak: number): string {
  return streak === 0 ? "Start a streak today" : `${streak}-day streak`;
}
