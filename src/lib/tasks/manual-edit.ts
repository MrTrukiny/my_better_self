import "server-only";
import { sql } from "drizzle-orm";
import { task } from "@/db/schema";
import type { TaskInput } from "./schemas";

/**
 * The update for task values the owner set: minutes set by hand restart calibration from this
 * edit and drop its note (ADR 0009), and since the frequency may change, a task that was never
 * done gets its first date picked again.
 */
export function manualEditSet(values: Partial<TaskInput>) {
  const minutes = values.minutes;
  if (minutes === undefined) {
    return { ...values, firstDue: null };
  }
  const sameMinutes = sql`${task.minutes} = ${minutes}`;
  return {
    ...values,
    firstDue: null,
    minutesSetAt: sql`case when ${sameMinutes} then ${task.minutesSetAt} else now() end`,
    calibratedFrom: sql`case when ${sameMinutes} then ${task.calibratedFrom} end`,
    calibratedSamples: sql`case when ${sameMinutes} then ${task.calibratedSamples} end`,
  };
}
