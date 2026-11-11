import "server-only";
import { and, between, eq, inArray } from "drizzle-orm";
import { cacheTag } from "next/cache";
import { db } from "@/db";
import { item, occurrence, user as person, room, scheduleSettings, task } from "@/db/schema";
import { householdTag, peopleOf } from "@/lib/household/queries";
import { plannedMinutes } from "@/lib/scheduler/planned-minutes";
import { getCurrentUser } from "@/lib/session";
import { type DayNumber, toIsoDate, zonedNow } from "./dates";
import type { PlanOccurrence } from "./format";
import { ensurePlan } from "./plan";
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
 * The next `PLAN_DAYS` days of the plan, planning missing days first: the signed-in person's
 * tasks, or with `household`, everyone's, labeled with each person's first name (spec 015).
 * Not cached: it depends on the date, so call it after `io()`.
 */
export async function getPlanWeek(
  settings: ScheduleSettings,
  now: Date,
  { household = false }: { household?: boolean } = {},
): Promise<{ today: DayNumber; occurrences: PlanOccurrence[] }> {
  const user = await getCurrentUser();
  await ensurePlan(user.householdId, now);
  const today = zonedNow(settings.timeZone, now).day;
  const people = household ? await peopleOf(user.householdId) : [user.id];
  const rows = await db
    .select({
      date: occurrence.date,
      id: task.id,
      kind: task.kind,
      name: task.name,
      minutes: plannedMinutes,
      roomName: room.name,
      itemName: item.name,
      personName: person.name,
    })
    .from(occurrence)
    .innerJoin(task, eq(task.id, occurrence.taskId))
    .innerJoin(person, eq(person.id, occurrence.userId))
    .leftJoin(room, eq(room.id, task.roomId))
    .leftJoin(item, eq(item.id, task.itemId))
    .where(
      and(
        inArray(occurrence.userId, people),
        between(occurrence.date, toIsoDate(today), toIsoDate(today + PLAN_DAYS - 1)),
      ),
    );
  return {
    today,
    occurrences: rows.map(({ date, kind, personName, ...rest }) => ({
      date,
      task: {
        ...rest,
        kind: kind === "routine" ? "routine" : "cleaning",
        ...(household && { person: firstName(personName) }),
      },
    })),
  };
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** The schedules of everyone in the household who has one, for the load line. */
export async function getHouseholdSchedules(): Promise<ScheduleSettings[]> {
  const user = await getCurrentUser();
  return householdSchedules(user.householdId);
}

async function householdSchedules(householdId: string): Promise<ScheduleSettings[]> {
  "use cache";
  const people = await peopleOf(householdId);
  cacheTag(householdTag(householdId), ...people.map(scheduleTag));

  return db
    .select({
      startTimes: scheduleSettings.startTimes,
      weekdayMinutes: scheduleSettings.weekdayMinutes,
      weekendMinutes: scheduleSettings.weekendMinutes,
      timeZone: scheduleSettings.timeZone,
    })
    .from(scheduleSettings)
    .where(inArray(scheduleSettings.userId, people));
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
