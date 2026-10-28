"use server";

import { and, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { db } from "@/db";
import { occurrence, scheduleSettings, task } from "@/db/schema";
import { toIsoDate, zonedNow } from "@/lib/scheduler/dates";
import { replanAfterChange } from "@/lib/scheduler/plan";
import { getCurrentUser } from "@/lib/session";
import { calibrateTask } from "@/lib/tasks/calibrate";
import { tasksTag } from "@/lib/tasks/queries";
import {
  actualMinutesUpdate,
  type CheckOffResult,
  checkOffDecision,
  checkOffInputSchema,
} from "@/lib/today/schemas";

/** A failed calibration is logged, not reported: the check-off itself was saved. */
async function calibrateSafely(userId: string, taskId: string): Promise<boolean> {
  try {
    return await calibrateTask(userId, taskId);
  } catch (error) {
    console.error("calibrateTask failed", error);
    return false;
  }
}

/**
 * Sets the status of an occurrence from today or the 7 days before (spec 013). Setting rather
 * than toggling makes a queued change safe to send twice. Today's changes don't replan (ADR 0008);
 * a past day's do, since they move the task's last completion. Cleaning changes recalibrate the
 * task's estimate from its recorded times (ADR 0009), which replans too when it changes.
 */
export async function setOccurrenceStatus(input: unknown): Promise<CheckOffResult> {
  const user = await getCurrentUser();
  const parsed = checkOffInputSchema.safeParse(input);
  if (!parsed.success) {
    return "invalid";
  }
  const { occurrenceId, status, actualMinutes } = parsed.data;
  try {
    const [stored] = await db
      .select({
        date: occurrence.date,
        taskId: occurrence.taskId,
        kind: task.kind,
        timeZone: scheduleSettings.timeZone,
      })
      .from(occurrence)
      .innerJoin(task, eq(task.id, occurrence.taskId))
      .innerJoin(scheduleSettings, eq(scheduleSettings.userId, occurrence.userId))
      .where(and(eq(occurrence.id, occurrenceId), eq(occurrence.userId, user.id)));
    const today = stored ? toIsoDate(zonedNow(stored.timeZone, new Date()).day) : "";
    const decision = checkOffDecision(
      stored
        ? { date: stored.date, kind: stored.kind === "routine" ? "routine" : "cleaning" }
        : null,
      today,
      status,
      actualMinutes,
    );
    if (decision !== "apply") {
      return decision;
    }
    await db
      .update(occurrence)
      .set({
        status,
        completedAt: status === "scheduled" ? null : new Date(),
        ...actualMinutesUpdate(status, actualMinutes),
      })
      .where(and(eq(occurrence.id, occurrenceId), eq(occurrence.userId, user.id)));
    const calibrated =
      stored?.kind === "cleaning" && (await calibrateSafely(user.id, stored.taskId));
    if (calibrated) {
      updateTag(tasksTag(user.id));
    }
    // A past day moves the task's last completion, and calibration its minutes.
    if (calibrated || (stored && stored.date < today)) {
      await replanAfterChange(user.id);
    }
    return "ok";
  } catch (error) {
    console.error("setOccurrenceStatus failed", error);
    return "failed";
  }
}
