"use server";

import { updateTag } from "next/cache";
import { db } from "@/db";
import { scheduleSettings } from "@/db/schema";
import { scheduleCalendarSync } from "@/lib/calendar/sync";
import type { ActionState } from "@/lib/inventory/action-state";
import { parseInput } from "@/lib/inventory/schemas";
import { rescheduleReminders } from "@/lib/notifications/schedule-reminders";
import { replan } from "@/lib/scheduler/plan";
import { scheduleTag } from "@/lib/scheduler/queries";
import { scheduleFormValues, scheduleInputSchema } from "@/lib/scheduler/schemas";
import { getCurrentUser } from "@/lib/session";

const SAVE_FAILED = "Couldn't save your schedule. Try again.";

export async function saveSchedule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const values = scheduleFormValues(formData);
  const parsed = parseInput(scheduleInputSchema, values);
  if (!parsed.ok) {
    return { status: "error", fieldErrors: parsed.fieldErrors, values };
  }
  try {
    await db
      .insert(scheduleSettings)
      .values({ userId: user.id, ...parsed.data })
      .onConflictDoUpdate({ target: scheduleSettings.userId, set: parsed.data });
    updateTag(scheduleTag(user.id));
    await replan(user.id);
    scheduleCalendarSync(user.id);
    rescheduleReminders(user.id);
    return { status: "success" };
  } catch (error) {
    console.error("saveSchedule failed", error);
    return { status: "error", formError: SAVE_FAILED, values };
  }
}
