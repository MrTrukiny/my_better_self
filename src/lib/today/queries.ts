import "server-only";
import { and, between, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { item, occurrence, room, task } from "@/db/schema";
import { type DayNumber, toDayNumber, toIsoDate, zonedNow } from "@/lib/scheduler/dates";
import { byPlace } from "@/lib/scheduler/format";
import { ensurePlan } from "@/lib/scheduler/plan";
import { budgetFor, type ScheduleSettings } from "@/lib/scheduler/settings";
import { getCurrentUser } from "@/lib/session";
import { type EarlierDay, type EarlierTask, earlierDays } from "./earlier";
import { sessionOrder } from "./order";
import type { DayCounts, TodayTask } from "./progress";
import { EDITABLE_PAST_DAYS } from "./schemas";

/** How far back the streak looks. */
const STREAK_WINDOW_DAYS = 400;

export type TodayData = {
  today: DayNumber;
  /** Cleaning tasks in the recommended order (`sessionOrder`), then routines. */
  tasks: TodayTask[];
  /** Cleaning counts of past days, for the streak. */
  history: Map<DayNumber, DayCounts>;
};

/**
 * Today's occurrences with their status, and the streak's history. Plans first, like the plan
 * page. Not cached: it depends on the date, so call it after `io()`.
 */
export async function getToday(settings: ScheduleSettings, now: Date): Promise<TodayData> {
  const user = await getCurrentUser();
  await ensurePlan(user.id, now);
  const today = zonedNow(settings.timeZone, now).day;
  const [rows, counts] = await Promise.all([
    occurrenceRows(user.id, toIsoDate(today), toIsoDate(today)),
    db
      .select({
        date: occurrence.date,
        total: sql<number>`count(*)::int`,
        done: sql<number>`(count(*) filter (where ${occurrence.status} = 'done'))::int`,
        skipped: sql<number>`(count(*) filter (where ${occurrence.status} = 'skipped'))::int`,
      })
      .from(occurrence)
      .innerJoin(task, eq(task.id, occurrence.taskId))
      .where(
        and(
          eq(occurrence.userId, user.id),
          eq(task.kind, "cleaning"),
          between(occurrence.date, toIsoDate(today - STREAK_WINDOW_DAYS), toIsoDate(today - 1)),
        ),
      )
      .groupBy(occurrence.date),
  ]);
  const tasks = rows.map((row) => row.task);
  return {
    today,
    tasks: [
      ...sessionOrder(tasks.filter((t) => t.kind === "cleaning")),
      ...tasks.filter((t) => t.kind === "routine").sort(byPlace),
    ],
    history: new Map(counts.map(({ date, ...c }) => [toDayNumber(date), c])),
  };
}

/**
 * The editable days before today with their occurrences (spec 013). Not cached: it depends on
 * the date, so call it after `io()`.
 */
export async function getEarlierDays(
  settings: ScheduleSettings,
  now: Date,
): Promise<{ today: DayNumber; days: EarlierDay[] }> {
  const user = await getCurrentUser();
  await ensurePlan(user.id, now);
  const today = zonedNow(settings.timeZone, now).day;
  const rows = await occurrenceRows(
    user.id,
    toIsoDate(today - EDITABLE_PAST_DAYS),
    toIsoDate(today - 1),
  );
  return { today, days: earlierDays(today, rows, (day) => budgetFor(settings, day) === 0) };
}

async function occurrenceRows(
  userId: string,
  from: string,
  to: string,
): Promise<{ day: DayNumber; task: EarlierTask }[]> {
  const rows = await db
    .select({
      date: occurrence.date,
      occurrenceId: occurrence.id,
      status: occurrence.status,
      id: task.id,
      kind: task.kind,
      name: task.name,
      minutes: task.minutes,
      actualMinutes: occurrence.actualMinutes,
      roomId: room.id,
      roomName: room.name,
      roomCreatedAt: room.createdAt,
      itemName: item.name,
      itemType: item.type,
      itemCreatedAt: item.createdAt,
    })
    .from(occurrence)
    .innerJoin(task, eq(task.id, occurrence.taskId))
    .leftJoin(room, eq(room.id, task.roomId))
    .leftJoin(item, eq(item.id, task.itemId))
    .where(and(eq(occurrence.userId, userId), between(occurrence.date, from, to)));
  return rows.map(({ date, kind, roomCreatedAt, itemCreatedAt, ...rest }) => ({
    day: toDayNumber(date),
    task: {
      ...rest,
      kind: kind === "routine" ? ("routine" as const) : ("cleaning" as const),
      roomAddedAt: roomCreatedAt?.getTime() ?? null,
      itemAddedAt: itemCreatedAt?.getTime() ?? null,
    },
  }));
}
