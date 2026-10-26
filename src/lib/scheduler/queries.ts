import "server-only";
import { eq } from "drizzle-orm";
import { cacheTag } from "next/cache";
import { db } from "@/db";
import { scheduleSettings } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import type { ScheduleSettings } from "./settings";

/** Cache tag for one user's schedule settings. */
export function scheduleTag(userId: string): string {
  return `schedule:${userId}`;
}

/** The saved settings, or null until the owner saves them once. */
export async function getScheduleSettings(): Promise<ScheduleSettings | null> {
  const user = await getCurrentUser();
  return settingsForUser(user.id);
}

// Not exported: callers must go through the getter above, which resolves the user first.
async function settingsForUser(userId: string): Promise<ScheduleSettings | null> {
  "use cache";
  cacheTag(scheduleTag(userId));

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
