"use server";

import { and, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { db } from "@/db";
import { notificationSettings, pushSubscription } from "@/db/schema";
import type { ActionState } from "@/lib/inventory/action-state";
import { parseInput } from "@/lib/inventory/schemas";
import { isPushConfigured } from "@/lib/notifications/config";
import { currentSessionId, notificationsTag } from "@/lib/notifications/queries";
import { rescheduleReminders } from "@/lib/notifications/schedule-reminders";
import {
  notificationPrefsSchema,
  prefsFormValues,
  subscriptionSchema,
} from "@/lib/notifications/schemas";
import { getCurrentUser } from "@/lib/session";

const SAVE_FAILED = "Couldn't save your reminders. Try again.";

/** Registers this device's browser subscription under the current session. */
export async function saveSubscription(subscription: unknown): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  const sessionId = await currentSessionId();
  const parsed = subscriptionSchema.safeParse(subscription);
  if (!sessionId || !parsed.success || !isPushConfigured()) {
    return { ok: false };
  }
  const { endpoint, keys } = parsed.data;
  const values = { userId: user.id, sessionId, p256dh: keys.p256dh, auth: keys.auth };
  try {
    await db
      .insert(pushSubscription)
      .values({ endpoint, ...values })
      .onConflictDoUpdate({ target: pushSubscription.endpoint, set: values });
    rescheduleReminders(user.id);
    return { ok: true };
  } catch (error) {
    console.error("saveSubscription failed", error);
    return { ok: false };
  }
}

/** Stops notifications on this device: its session's subscription goes away. */
export async function removeSubscription(): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  const sessionId = await currentSessionId();
  if (!sessionId) {
    return { ok: false };
  }
  try {
    await db
      .delete(pushSubscription)
      .where(and(eq(pushSubscription.userId, user.id), eq(pushSubscription.sessionId, sessionId)));
    return { ok: true };
  } catch (error) {
    console.error("removeSubscription failed", error);
    return { ok: false };
  }
}

export async function saveNotificationPrefs(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  const values = prefsFormValues(formData);
  const parsed = parseInput(notificationPrefsSchema, values);
  if (!parsed.ok) {
    return { status: "error", fieldErrors: parsed.fieldErrors, values };
  }
  try {
    await db
      .insert(notificationSettings)
      .values({ userId: user.id, ...parsed.data })
      .onConflictDoUpdate({ target: notificationSettings.userId, set: parsed.data });
    updateTag(notificationsTag(user.id));
    rescheduleReminders(user.id);
    return { status: "success" };
  } catch (error) {
    console.error("saveNotificationPrefs failed", error);
    return { status: "error", formError: SAVE_FAILED, values };
  }
}
