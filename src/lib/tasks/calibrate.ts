import "server-only";
import { and, desc, eq, gt, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { occurrence, task } from "@/db/schema";
import { CALIBRATION, calibrate } from "./calibration";

/**
 * Recalibrates one task from its recorded times since its baseline (ADR 0009). Returns whether
 * its estimate changed, so the caller can refresh caches and replan. The task is shared, so every
 * member's times count (ADR 0011).
 */
export async function calibrateTask(householdId: string, taskId: string): Promise<boolean> {
  const [current] = await db
    .select({ minutes: task.minutes, kind: task.kind, minutesSetAt: task.minutesSetAt })
    .from(task)
    .where(and(eq(task.id, taskId), eq(task.userId, householdId)));
  if (current?.kind !== "cleaning") {
    return false;
  }
  const times = await db
    .select({ minutes: occurrence.actualMinutes })
    .from(occurrence)
    .where(
      and(
        eq(occurrence.taskId, taskId),
        eq(occurrence.status, "done"),
        isNotNull(occurrence.actualMinutes),
        current.minutesSetAt ? gt(occurrence.completedAt, current.minutesSetAt) : undefined,
      ),
    )
    .orderBy(desc(occurrence.date))
    .limit(CALIBRATION.window);
  const result = calibrate({
    minutes: current.minutes,
    kind: "cleaning",
    times: times.flatMap((t) => (t.minutes === null ? [] : [t.minutes])),
  });
  if (!result) {
    return false;
  }
  const updated = await db
    .update(task)
    .set({
      minutes: result.minutes,
      calibratedFrom: current.minutes,
      calibratedSamples: result.samples,
    })
    // Only if nothing changed the minutes meanwhile, such as a manual edit.
    .where(
      and(eq(task.id, taskId), eq(task.userId, householdId), eq(task.minutes, current.minutes)),
    )
    .returning({ id: task.id });
  return updated.length > 0;
}
