import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { notificationLog, pushSubscription } from "@/db/schema";
import { ensurePlan } from "@/lib/scheduler/plan";
import { sendPush } from "./push";
import { prefsFor, reminderDay, scheduleFor, subscriptionsOf } from "./queries";
import { type ReminderDecision, type ReminderMessage, reminderDecision } from "./reminders";

export type DeliveryResult =
  | "sent"
  | "already-sent"
  | "no-devices"
  | Extract<ReminderDecision, { send: false }>["reason"];

/** Sends a queued reminder to every device of the owner if it still applies. */
export async function deliverReminder(
  userId: string,
  message: ReminderMessage,
  now: Date = new Date(),
): Promise<DeliveryResult> {
  const settings = await scheduleFor(userId);
  if (!settings) {
    return "stale";
  }
  await ensurePlan(userId, now);
  const [prefs, day, subscriptions] = await Promise.all([
    prefsFor(userId),
    reminderDay(userId, message.date),
    subscriptionsOf(userId),
  ]);
  const decision = reminderDecision(message, { settings, prefs, now, day });
  if (!decision.send) {
    return decision.reason;
  }
  if (subscriptions.length === 0) {
    return "no-devices";
  }
  const logged = await db
    .insert(notificationLog)
    .values({ userId, date: message.date, kind: message.kind })
    .onConflictDoNothing()
    .returning({ kind: notificationLog.kind });
  if (logged.length === 0) {
    return "already-sent";
  }
  const payload = { title: decision.title, body: decision.body, url: "/", tag: message.kind };
  const results = await Promise.all(subscriptions.map((target) => sendPush(target, payload)));
  const gone = subscriptions.filter((_, index) => results[index] === "gone").map((s) => s.id);
  if (gone.length > 0) {
    await db.delete(pushSubscription).where(inArray(pushSubscription.id, gone));
  }
  return "sent";
}
