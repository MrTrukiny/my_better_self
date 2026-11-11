"use server";

import { and, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { homeProfile, scheduleSettings, task, taskAdjustment } from "@/db/schema";
import { preferredLanguage } from "@/lib/ai/locale";
import { getProposalOptions } from "@/lib/ai/model";
import { suggestAdjustments } from "@/lib/ai/task-adjustments";
import type { ActionState } from "@/lib/inventory/action-state";
import { parseInput } from "@/lib/inventory/schemas";
import { replanAfterChange } from "@/lib/scheduler/plan";
import { getCurrentUser } from "@/lib/session";
import { readReviewTasks } from "@/lib/tasks/adjustment-queries";
import type { GenerateState } from "@/lib/tasks/generate-state";
import { manualEditSet } from "@/lib/tasks/manual-edit";
import { tasksTag } from "@/lib/tasks/queries";
import { type TaskInput, taskInputSchema } from "@/lib/tasks/schemas";

const SUGGEST_FAILED = "Couldn't suggest adjustments. Try again.";
const SUGGEST_UNAVAILABLE = "Suggestions aren't available right now. Try again later.";
const SAVE_FAILED = "Couldn't save your changes. Try again.";
const DELETE_FAILED = "Couldn't discard it. Try again.";
const NOT_FOUND = "This no longer exists. Refresh the page.";

const TASK_FIELDS = ["name", "kind", "minutes", "frequencyDays"] as const;

/**
 * Asks the AI to review the tasks with recorded times or notes. New suggestions replace the
 * pending ones; nothing is written when nothing qualifies or the request fails.
 */
export async function suggestTaskAdjustments(): Promise<GenerateState> {
  const user = await getCurrentUser();
  try {
    const tasks = await readReviewTasks(user.id);
    // The page disables the button when nothing qualifies; this covers a stale page.
    if (tasks.length === 0) {
      return { status: "success", count: 0 };
    }
    const language = preferredLanguage((await headers()).get("accept-language"));
    const [existing, [profile], [schedule]] = await Promise.all([
      db
        .select({ roomId: task.roomId, itemId: task.itemId, name: task.name })
        .from(task)
        .where(eq(task.userId, user.id)),
      db
        .select({ note: homeProfile.note })
        .from(homeProfile)
        .where(eq(homeProfile.userId, user.id)),
      db
        .select({ timeZone: scheduleSettings.timeZone })
        .from(scheduleSettings)
        .where(eq(scheduleSettings.userId, user.id)),
    ]);
    const result = await suggestAdjustments(
      {
        tasks,
        existing,
        homeNote: profile?.note ?? null,
        locale: { language, timeZone: schedule?.timeZone ?? null },
      },
      getProposalOptions(),
    );
    if (!result.ok) {
      const formError = result.reason === "unavailable" ? SUGGEST_UNAVAILABLE : SUGGEST_FAILED;
      return { status: "error", formError };
    }
    await db.transaction(async (tx) => {
      await tx.delete(taskAdjustment).where(eq(taskAdjustment.userId, user.id));
      if (result.adjustments.length > 0) {
        await tx
          .insert(taskAdjustment)
          .values(result.adjustments.map((a) => ({ ...a, userId: user.id })));
      }
    });
    updateTag(tasksTag(user.id));
    return { status: "success", count: result.adjustments.length };
  } catch (error) {
    console.error("suggestTaskAdjustments failed", error);
    return { status: "error", formError: SUGGEST_FAILED };
  }
}

/** Applies a suggestion as it is. */
export async function acceptAdjustment(adjustmentId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  return applyAdjustment(user.id, adjustmentId, null);
}

/** Applies a suggestion with the values the owner edited in the task form. */
export async function acceptEditedAdjustment(
  adjustmentId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  const values = Object.fromEntries(
    TASK_FIELDS.map((field) => [field, String(formData.get(field) ?? "")]),
  );
  const parsed = parseInput(taskInputSchema, values);
  if (!parsed.ok) {
    return { status: "error", fieldErrors: parsed.fieldErrors, values };
  }
  const result = await applyAdjustment(user.id, adjustmentId, parsed.data);
  return result.status === "error" ? { ...result, values } : result;
}

/**
 * Deletes the suggestion and applies it in one transaction: new minutes or a new frequency on its
 * task, set as by hand, or a new task in the same place. `edited` replaces the suggested values.
 */
async function applyAdjustment(
  userId: string,
  adjustmentId: string,
  edited: TaskInput | null,
): Promise<ActionState> {
  try {
    const applied = await db.transaction(async (tx) => {
      const [adjustment] = await tx
        .delete(taskAdjustment)
        .where(and(eq(taskAdjustment.id, adjustmentId), eq(taskAdjustment.userId, userId)))
        .returning();
      if (!adjustment) {
        return false;
      }
      const ofTask = and(eq(task.id, adjustment.taskId), eq(task.userId, userId));
      if (adjustment.change === "new_task") {
        const [source] = await tx
          .select({ roomId: task.roomId, itemId: task.itemId })
          .from(task)
          .where(ofTask);
        if (!source) {
          return false;
        }
        await tx.insert(task).values({
          userId,
          ...source,
          kind: "cleaning",
          name: adjustment.name ?? "",
          minutes: adjustment.minutes ?? 1,
          frequencyDays: adjustment.frequencyDays ?? 1,
          ...edited,
        });
        return true;
      }
      const suggested =
        adjustment.change === "minutes"
          ? { minutes: adjustment.minutes ?? undefined }
          : { frequencyDays: adjustment.frequencyDays ?? undefined };
      const updated = await tx
        .update(task)
        .set(manualEditSet(edited ?? suggested))
        .where(ofTask)
        .returning({ id: task.id });
      return updated.length > 0;
    });
    if (!applied) {
      return { status: "error", formError: NOT_FOUND };
    }
    await replanAfterChange(userId);
    updateTag(tasksTag(userId));
    return { status: "success" };
  } catch (error) {
    console.error("acceptAdjustment failed", error);
    return { status: "error", formError: SAVE_FAILED };
  }
}

export async function discardAdjustment(adjustmentId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  try {
    await db
      .delete(taskAdjustment)
      .where(and(eq(taskAdjustment.id, adjustmentId), eq(taskAdjustment.userId, user.id)));
    updateTag(tasksTag(user.id));
    return { status: "success" };
  } catch (error) {
    console.error("discardAdjustment failed", error);
    return { status: "error", formError: DELETE_FAILED };
  }
}
