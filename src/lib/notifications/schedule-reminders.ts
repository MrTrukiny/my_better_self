import "server-only";
import { after } from "next/server";
import { isPushConfigured } from "./config";
import { queueReminder } from "./qstash";
import { prefsFor, scheduleFor, subscriptionsOf } from "./queries";
import { upcomingReminders } from "./reminders";

/**
 * Queues the owner's reminders of the next hours, if any device of theirs is subscribed.
 * Returns how many were queued. Earlier messages are never cancelled: the send route drops
 * the ones that no longer match the settings (ADR 0010).
 */
export async function scheduleReminders(userId: string, now: Date = new Date()): Promise<number> {
  if (!isPushConfigured()) {
    return 0;
  }
  const [settings, prefs, subscriptions] = await Promise.all([
    scheduleFor(userId),
    prefsFor(userId),
    subscriptionsOf(userId),
  ]);
  if (!settings || subscriptions.length === 0) {
    return 0;
  }
  const reminders = upcomingReminders(settings, prefs, now);
  for (const reminder of reminders) {
    await queueReminder(userId, reminder);
  }
  return reminders.length;
}

/** Reschedules after the response, so a settings save doesn't wait for QStash. */
export function rescheduleReminders(userId: string): void {
  after(async () => {
    try {
      await scheduleReminders(userId);
    } catch (error) {
      console.error("scheduling reminders failed", { userId, error });
    }
  });
}
