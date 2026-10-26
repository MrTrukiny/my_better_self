import "server-only";
import { and, between, eq } from "drizzle-orm";
import { cacheTag } from "next/cache";
import { db } from "@/db";
import { item, occurrence, room, scheduleSettings, task } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { type DayNumber, toIsoDate, zonedNow } from "./dates";
import type { PlanOccurrence } from "./format";
import { ensureHorizon } from "./plan";
import { PLAN_DAYS, type ScheduleSettings } from "./settings";

/** Cache tag for one user's schedule settings. */
export function scheduleTag(userId: string): string {
  return `schedule:${userId}`;
}

/** The saved settings, or null until the owner saves them once. */
export async function getScheduleSettings(): Promise<ScheduleSettings | null> {
  const user = await getCurrentUser();
  return settingsForUser(user.id);
}

/**
 * The next `PLAN_DAYS` days of the plan, planning missing days first. Not cached: it depends
 * on the date, so call it after `io()`.
 */
export async function getPlanWeek(
  settings: ScheduleSettings,
  now: Date,
): Promise<{ today: DayNumber; occurrences: PlanOccurrence[] }> {
  const user = await getCurrentUser();
  await ensureHorizon(user.id, now);
  const today = zonedNow(settings.timeZone, now).day;
  const rows = await db
    .select({
      date: occurrence.date,
      id: task.id,
      kind: task.kind,
      name: task.name,
      minutes: task.minutes,
      roomName: room.name,
      itemName: item.name,
    })
    .from(occurrence)
    .innerJoin(task, eq(task.id, occurrence.taskId))
    .leftJoin(room, eq(room.id, task.roomId))
    .leftJoin(item, eq(item.id, task.itemId))
    .where(
      and(
        eq(occurrence.userId, user.id),
        between(occurrence.date, toIsoDate(today), toIsoDate(today + PLAN_DAYS - 1)),
      ),
    );
  return {
    today,
    occurrences: rows.map(({ date, kind, ...rest }) => ({
      date,
      task: { ...rest, kind: kind === "routine" ? "routine" : "cleaning" },
    })),
  };
}

// Not exported: callers must go through the getters above, which resolve the user first.
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
