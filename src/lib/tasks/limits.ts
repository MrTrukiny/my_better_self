export const TASK_KINDS = ["cleaning", "routine"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

/** A cleaning task must fit in one daily session; bigger jobs are split into several tasks. */
export const CLEANING_MINUTES_MAX = 30;
/** Routines sit outside the daily cleaning budget, so they may run longer. */
export const ROUTINE_MINUTES_MAX = 120;
export const FREQUENCY_DAYS_MAX = 365;
export const TASK_NAME_MAX = 80;

export function minutesMax(kind: TaskKind): number {
  return kind === "cleaning" ? CLEANING_MINUTES_MAX : ROUTINE_MINUTES_MAX;
}
