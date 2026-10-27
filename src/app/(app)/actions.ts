"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { occurrence, scheduleSettings, task } from "@/db/schema";
import { toIsoDate, zonedNow } from "@/lib/scheduler/dates";
import { getCurrentUser } from "@/lib/session";
import {
  actualMinutesUpdate,
  type CheckOffResult,
  checkOffDecision,
  checkOffInputSchema,
} from "@/lib/today/schemas";

/**
 * Sets the status of one of today's occurrences. Setting rather than toggling makes a queued
 * change safe to send twice. Doesn't replan: see ADR 0008.
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
      .select({ date: occurrence.date, kind: task.kind, timeZone: scheduleSettings.timeZone })
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
    return "ok";
  } catch (error) {
    console.error("setOccurrenceStatus failed", error);
    return "failed";
  }
}
