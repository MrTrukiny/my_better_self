import "server-only";
import { and, eq, gte, lt, min, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { occurrence, scheduleSettings, task } from "@/db/schema";
import { scheduleCalendarSync } from "@/lib/calendar/sync";
import { type DayNumber, toDayNumber, toIsoDate, zonedNow } from "./dates";
import { lastCompletions, type PastOccurrence } from "./history";
import { type PlanState, pendingRange, replanStart } from "./replan-start";
import { schedule } from "./schedule";
import { PLAN_DAYS, type ScheduleSettings } from "./settings";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Transaction;

/**
 * Replaces the plan from today (or tomorrow, once today's session has started) through the
 * seventh day. Call after any change to tasks or settings. Does nothing without settings.
 */
export async function replan(userId: string, now: Date = new Date()): Promise<void> {
  if (!(await readState(db, userId, now))) {
    return;
  }
  await db.transaction(async (tx) => {
    const locked = await readState(tx, userId, now, { lock: true });
    if (!locked) {
      return;
    }
    const { settings, todayStarted } = locked;
    const to = zonedNow(settings.timeZone, now).day + PLAN_DAYS - 1;
    const from = replanStart(settings, now, { todayStarted });
    await planRange(tx, userId, settings, from, to, now);
  });
}

/**
 * For actions whose own change already succeeded: a failed replan is logged, not reported,
 * and the next change or settings save replans again.
 */
export async function replanAfterChange(userId: string): Promise<void> {
  try {
    await replan(userId);
    scheduleCalendarSync(userId);
  } catch (error) {
    console.error("replan failed", error);
  }
}

/**
 * Keeps the plan current as days pass: the first call on a new day replans from today, so
 * what wasn't done comes back, and later calls only plan the days missing from the week.
 */
export async function ensurePlan(userId: string, now: Date = new Date()): Promise<void> {
  const current = await readState(db, userId, now);
  if (!current || !pendingRange(current.settings, current, now)) {
    return;
  }
  await db.transaction(async (tx) => {
    const locked = await readState(tx, userId, now, { lock: true });
    if (!locked) {
      return;
    }
    const range = pendingRange(locked.settings, locked, now);
    if (range) {
      await planRange(tx, userId, locked.settings, range.from, range.to, range.full ? now : null);
    }
  });
}

/**
 * Reads the settings row and whether today has started. Writers re-read it with `lock` inside
 * their transaction, so concurrent replans of one user run one at a time; the unlocked read
 * only skips needless work.
 */
async function readState(
  executor: Executor,
  userId: string,
  now: Date,
  { lock = false }: { lock?: boolean } = {},
): Promise<({ settings: ScheduleSettings } & PlanState) | null> {
  const query = executor.select().from(scheduleSettings).where(eq(scheduleSettings.userId, userId));
  const [row] = lock ? await query.for("update") : await query;
  if (!row) {
    return null;
  }
  const settings = {
    startTimes: row.startTimes,
    weekdayMinutes: row.weekdayMinutes,
    weekendMinutes: row.weekendMinutes,
    timeZone: row.timeZone,
  };
  const today = toIsoDate(zonedNow(settings.timeZone, now).day);
  const [handled] = await executor
    .select({ id: occurrence.id })
    .from(occurrence)
    .where(
      and(
        eq(occurrence.userId, userId),
        eq(occurrence.date, today),
        ne(occurrence.status, "scheduled"),
      ),
    )
    .limit(1);
  return {
    settings,
    plannedThrough: row.plannedThrough === null ? null : toDayNumber(row.plannedThrough),
    replannedOn: row.replannedOn === null ? null : toDayNumber(row.replannedOn),
    todayStarted: handled !== undefined,
  };
}

/** Plans `from` through `to`; pass `replannedAt` when this is a full replan. */
async function planRange(
  tx: Transaction,
  userId: string,
  settings: ScheduleSettings,
  from: DayNumber,
  to: DayNumber,
  replannedAt: Date | null,
): Promise<void> {
  const fromDate = toIsoDate(from);
  const [tasks, history] = await Promise.all([
    tx
      .select({
        id: task.id,
        name: task.name,
        kind: task.kind,
        minutes: task.minutes,
        frequencyDays: task.frequencyDays,
        firstDue: task.firstDue,
      })
      .from(task)
      .where(eq(task.userId, userId)),
    tx
      .select({
        taskId: occurrence.taskId,
        lastHandled: sql<
          string | null
        >`max(${occurrence.date}) filter (where ${occurrence.status} <> 'scheduled')`,
        first: min(occurrence.date),
      })
      .from(occurrence)
      .where(and(eq(occurrence.userId, userId), lt(occurrence.date, fromDate)))
      .groupBy(occurrence.taskId),
  ]);
  // The latest handled and the earliest planned day are all `lastCompletions` needs.
  const past: PastOccurrence[] = history.flatMap(({ taskId, lastHandled, first }) => [
    ...(lastHandled ? [{ taskId, day: toDayNumber(lastHandled), status: "done" as const }] : []),
    ...(first ? [{ taskId, day: toDayNumber(first), status: "scheduled" as const }] : []),
  ]);
  const lastDone = lastCompletions(
    tasks.map((t) => ({ ...t, firstDue: t.firstDue === null ? null : toDayNumber(t.firstDue) })),
    past,
  );
  const { days, firstDues } = schedule({
    tasks: tasks.map((t) => ({ ...t, kind: t.kind === "routine" ? "routine" : "cleaning" })),
    settings,
    lastDone,
    from,
    to,
  });

  await tx
    .delete(occurrence)
    .where(
      and(
        eq(occurrence.userId, userId),
        gte(occurrence.date, fromDate),
        eq(occurrence.status, "scheduled"),
      ),
    );
  const minutesOf = new Map(tasks.map((t) => [t.id, t.minutes]));
  const rows = days.flatMap(({ day, taskIds }) =>
    taskIds.map((taskId) => ({
      userId,
      taskId,
      date: toIsoDate(day),
      plannedMinutes: minutesOf.get(taskId) ?? null,
    })),
  );
  if (rows.length > 0) {
    await tx.insert(occurrence).values(rows).onConflictDoNothing();
  }
  for (const [taskId, due] of firstDues) {
    await tx
      .update(task)
      .set({ firstDue: toIsoDate(due) })
      .where(and(eq(task.id, taskId), eq(task.userId, userId)));
  }
  await tx
    .update(scheduleSettings)
    .set({
      plannedThrough: toIsoDate(to),
      ...(replannedAt && {
        replannedOn: toIsoDate(zonedNow(settings.timeZone, replannedAt).day),
      }),
    })
    .where(eq(scheduleSettings.userId, userId));
}
