import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { cacheTag } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import {
  notificationSettings,
  occurrence,
  pushSubscription,
  scheduleSettings,
  task,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { plannedMinutes } from "@/lib/scheduler/planned-minutes";
import type { ScheduleSettings } from "@/lib/scheduler/settings";
import { getCurrentUser } from "@/lib/session";
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs, type ReminderDay } from "./reminders";

/** Cache tag for one user's notification preferences. */
export function notificationsTag(userId: string): string {
  return `notifications:${userId}`;
}

/** The saved reminder preferences, or the defaults. */
export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const user = await getCurrentUser();
  return cachedPrefs(user.id);
}

async function cachedPrefs(userId: string): Promise<NotificationPrefs> {
  "use cache";
  cacheTag(notificationsTag(userId));
  return prefsFor(userId);
}

/** The id of this device's session, which its push subscription belongs to. */
export async function currentSessionId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.session.id ?? null;
}

/** Whether this device's session has a push subscription. Not cached: it's per device. */
export async function isDeviceSubscribed(): Promise<boolean> {
  const sessionId = await currentSessionId();
  if (!sessionId) {
    return false;
  }
  const [row] = await db
    .select({ id: pushSubscription.id })
    .from(pushSubscription)
    .where(eq(pushSubscription.sessionId, sessionId))
    .limit(1);
  return row !== undefined;
}

// The functions below take a user id for jobs without a signed-in user (the daily job and the
// send route); callers with a session must resolve the user first.

export async function prefsFor(userId: string): Promise<NotificationPrefs> {
  const [row] = await db
    .select({
      beforeEnabled: notificationSettings.beforeEnabled,
      beforeMinutes: notificationSettings.beforeMinutes,
      eveningEnabled: notificationSettings.eveningEnabled,
      eveningTime: notificationSettings.eveningTime,
    })
    .from(notificationSettings)
    .where(eq(notificationSettings.userId, userId));
  return row ?? DEFAULT_NOTIFICATION_PREFS;
}

export async function scheduleFor(userId: string): Promise<ScheduleSettings | null> {
  const [row] = await db
    .select({
      startTimes: scheduleSettings.startTimes,
      weekdayMinutes: scheduleSettings.weekdayMinutes,
      weekendMinutes: scheduleSettings.weekendMinutes,
      timeZone: scheduleSettings.timeZone,
    })
    .from(scheduleSettings)
    .where(eq(scheduleSettings.userId, userId));
  return row ?? null;
}

export async function subscriptionsOf(userId: string) {
  return db
    .select({
      id: pushSubscription.id,
      endpoint: pushSubscription.endpoint,
      p256dh: pushSubscription.p256dh,
      auth: pushSubscription.auth,
    })
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId));
}

export async function subscribedOwners(): Promise<string[]> {
  const rows = await db.selectDistinct({ userId: pushSubscription.userId }).from(pushSubscription);
  return rows.map((row) => row.userId);
}

/** A day's cleaning tasks, for the send-time decision. */
export async function reminderDay(userId: string, date: string): Promise<ReminderDay> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      open: sql<number>`(count(*) filter (where ${occurrence.status} = 'scheduled'))::int`,
      openMinutes: sql<number>`coalesce(sum(${plannedMinutes}) filter (where ${occurrence.status} = 'scheduled'), 0)::int`,
    })
    .from(occurrence)
    .innerJoin(task, eq(task.id, occurrence.taskId))
    .where(
      and(eq(occurrence.userId, userId), eq(task.kind, "cleaning"), eq(occurrence.date, date)),
    );
  return row ?? { total: 0, open: 0, openMinutes: 0 };
}
