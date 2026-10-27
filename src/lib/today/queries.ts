import "server-only";
import { and, between, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { item, occurrence, room, task } from "@/db/schema";
import { type DayNumber, toDayNumber, toIsoDate, zonedNow } from "@/lib/scheduler/dates";
import { byPlace } from "@/lib/scheduler/format";
import { ensurePlan } from "@/lib/scheduler/plan";
import type { ScheduleSettings } from "@/lib/scheduler/settings";
import { getCurrentUser } from "@/lib/session";
import { sessionOrder } from "./order";
import type { DayCounts, TodayTask } from "./progress";

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
    db
      .select({
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
      .where(and(eq(occurrence.userId, user.id), eq(occurrence.date, toIsoDate(today)))),
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
  const tasks = rows.map(({ kind, roomCreatedAt, itemCreatedAt, ...rest }) => ({
    ...rest,
    kind: kind === "routine" ? ("routine" as const) : ("cleaning" as const),
    roomAddedAt: roomCreatedAt?.getTime() ?? null,
    itemAddedAt: itemCreatedAt?.getTime() ?? null,
  }));
  return {
    today,
    tasks: [
      ...sessionOrder(tasks.filter((t) => t.kind === "cleaning")),
      ...tasks.filter((t) => t.kind === "routine").sort(byPlace),
    ],
    history: new Map(counts.map(({ date, ...c }) => [toDayNumber(date), c])),
  };
}
