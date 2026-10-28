import "server-only";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { occurrence, task } from "@/db/schema";
import { type DayNumber, toDayNumber, zonedNow } from "@/lib/scheduler/dates";
import { getScheduleSettings } from "@/lib/scheduler/queries";
import { getCurrentUser } from "@/lib/session";
import { type FreshnessTask, type RoomFreshness, roomFreshness } from "./freshness";

/**
 * Each room's freshness from its cleaning tasks and its items' (spec 014), by room id; rooms
 * without cleaning tasks are missing. Not cached: it depends on the date and on check-offs, so
 * call it after `io()`.
 */
export async function getRoomFreshness(
  now: Date,
): Promise<{ today: DayNumber; rooms: Map<string, RoomFreshness> }> {
  const user = await getCurrentUser();
  const settings = await getScheduleSettings();
  const timeZone = settings?.timeZone ?? "UTC";
  const rows = await db
    .select({
      roomId: task.roomId,
      frequencyDays: task.frequencyDays,
      createdAt: task.createdAt,
      lastDone: sql<
        string | null
      >`max(${occurrence.date}) filter (where ${occurrence.status} = 'done')`,
    })
    .from(task)
    .leftJoin(occurrence, eq(occurrence.taskId, task.id))
    .where(and(eq(task.userId, user.id), eq(task.kind, "cleaning"), isNotNull(task.roomId)))
    .groupBy(task.id);

  const byRoom = new Map<string, FreshnessTask[]>();
  for (const { roomId, frequencyDays, createdAt, lastDone } of rows) {
    if (roomId === null) continue;
    byRoom.set(roomId, [
      ...(byRoom.get(roomId) ?? []),
      {
        frequencyDays,
        addedOn: zonedNow(timeZone, createdAt).day,
        lastDone: lastDone === null ? null : toDayNumber(lastDone),
      },
    ]);
  }
  const today = zonedNow(timeZone, now).day;
  const rooms = new Map<string, RoomFreshness>();
  for (const [roomId, tasks] of byRoom) {
    const freshness = roomFreshness(tasks, today);
    if (freshness) rooms.set(roomId, freshness);
  }
  return { today, rooms };
}
