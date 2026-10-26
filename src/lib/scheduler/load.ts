import type { TaskKind } from "@/lib/tasks/limits";
import { availablePerDay, type Budgets } from "./settings";

export type LoadSummary = {
  /** Average cleaning minutes the tasks need per calendar day. */
  neededPerDay: number;
  /** Average cleaning minutes the schedule provides per calendar day. */
  availablePerDay: number;
  overloaded: boolean;
};

export function loadSummary(
  tasks: readonly { kind: TaskKind; minutes: number; frequencyDays: number }[],
  settings: Budgets,
): LoadSummary {
  const neededPerDay = tasks
    .filter((t) => t.kind === "cleaning")
    .reduce((sum, t) => sum + t.minutes / t.frequencyDays, 0);
  const available = availablePerDay(settings);
  return { neededPerDay, availablePerDay: available, overloaded: neededPerDay > available };
}
