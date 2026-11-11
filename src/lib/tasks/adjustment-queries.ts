import "server-only";
import { and, desc, eq, gt, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { item, occurrence, room, task } from "@/db/schema";
import { ADJUSTMENTS, qualifies, type ReviewTask } from "./adjustments";

/**
 * The owner's cleaning tasks worth reviewing (spec 017): 3 or more recorded times or a note on
 * done occurrences completed after the minutes were last set by hand, with the most data first.
 * Not cached: it follows check-offs, so call it after `io()` or from a Server Action.
 */
export async function readReviewTasks(userId: string): Promise<ReviewTask[]> {
  const rows = await db
    .select({
      id: task.id,
      name: task.name,
      minutes: task.minutes,
      frequencyDays: task.frequencyDays,
      roomId: task.roomId,
      roomName: room.name,
      itemId: task.itemId,
      itemName: item.name,
      date: occurrence.date,
      actualMinutes: occurrence.actualMinutes,
      note: occurrence.note,
    })
    .from(task)
    .innerJoin(occurrence, eq(occurrence.taskId, task.id))
    .leftJoin(room, eq(room.id, task.roomId))
    .leftJoin(item, eq(item.id, task.itemId))
    .where(
      and(
        eq(task.userId, userId),
        eq(task.kind, "cleaning"),
        eq(occurrence.status, "done"),
        or(isNotNull(occurrence.actualMinutes), isNotNull(occurrence.note)),
        or(isNull(task.minutesSetAt), gt(occurrence.completedAt, task.minutesSetAt)),
      ),
    )
    .orderBy(desc(occurrence.date));

  const byTask = new Map<string, ReviewTask>();
  for (const { date, actualMinutes, note, ...row } of rows) {
    let entry = byTask.get(row.id);
    if (!entry) {
      entry = { ...row, history: { times: [], notes: [] } };
      byTask.set(row.id, entry);
    }
    const { times, notes } = entry.history;
    if (actualMinutes !== null && times.length < ADJUSTMENTS.timesWindow) {
      times.push({ date, minutes: actualMinutes });
    }
    if (note !== null && notes.length < ADJUSTMENTS.notesWindow) {
      notes.push({ date, note });
    }
  }
  const weight = (t: ReviewTask) => t.history.times.length + t.history.notes.length;
  return [...byTask.values()]
    .filter((t) => qualifies(t.history))
    .sort((a, b) => weight(b) - weight(a))
    .slice(0, ADJUSTMENTS.tasksMax);
}
