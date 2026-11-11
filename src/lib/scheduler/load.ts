import type { TaskKind } from "@/lib/tasks/limits";
import { availablePerDay, type Budgets } from "./settings";

export type LoadSummary = {
  /** Average cleaning minutes the tasks need per calendar day. */
  neededPerDay: number;
  /** Average cleaning minutes the schedules provide per calendar day. */
  availablePerDay: number;
  overloaded: boolean;
  /** Whether several people's schedules count (spec 015). */
  shared: boolean;
};

export function loadSummary(
  tasks: readonly { kind: TaskKind; minutes: number; frequencyDays: number }[],
  schedules: Budgets | readonly Budgets[],
): LoadSummary {
  const all: readonly Budgets[] = Array.isArray(schedules) ? schedules : [schedules];
  const neededPerDay = tasks
    .filter((t) => t.kind === "cleaning")
    .reduce((sum, t) => sum + t.minutes / t.frequencyDays, 0);
  const available = all.reduce((sum, budgets) => sum + availablePerDay(budgets), 0);
  return {
    neededPerDay,
    availablePerDay: available,
    overloaded: neededPerDay > available,
    shared: all.length > 1,
  };
}
