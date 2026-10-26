import "server-only";
import { and, eq, gte, lt, max } from "drizzle-orm";
import { db } from "@/db";
import { occurrence, scheduleSettings, task } from "@/db/schema";
import { type DayNumber, toDayNumber, toIsoDate, zonedNow } from "./dates";
import { horizonRange, replanStart } from "./replan-start";
import { schedule } from "./schedule";
import { PLAN_DAYS, type ScheduleSettings } from "./settings";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Replaces the plan from today (or tomorrow, once today's session has started) through the
 * seventh day. Call after any change to tasks or settings. Does nothing without settings.
 */
export async function replan(userId: string, now: Date = new Date()): Promise<void> {
  if (!(await readSettings(db, userId))) {
    return;
  }
  await db.transaction(async (tx) => {
    const locked = await readSettings(tx, userId, { lock: true });
    if (!locked) {
      return;
    }
    const { settings } = locked;
    const to = zonedNow(settings.timeZone, now).day + PLAN_DAYS - 1;
    await planRange(tx, userId, settings, replanStart(settings, now), to);
  });
}

/**
 * For actions whose own change already succeeded: a failed replan is logged, not reported,
 * and the next change or settings save replans again.
 */
export async function replanAfterChange(userId: string): Promise<void> {
  try {
    await replan(userId);
  } catch (error) {
    console.error("replan failed", error);
  }
}

/** Plans the days missing from the next week, so the plan keeps moving as days pass. */
export async function ensureHorizon(userId: string, now: Date = new Date()): Promise<void> {
  const current = await readSettings(db, userId);
  if (!current || !horizonRange(current.settings, current.plannedThrough, now)) {
    return;
  }
  await db.transaction(async (tx) => {
    const locked = await readSettings(tx, userId, { lock: true });
    if (!locked) {
      return;
    }
    const range = horizonRange(locked.settings, locked.plannedThrough, now);
    if (range) {
      await planRange(tx, userId, locked.settings, range.from, range.to);
    }
  });
}

/**
 * Reads the settings row. Writers re-read it with `lock` inside their transaction, so
 * concurrent replans of one user run one at a time; the unlocked read only skips needless work.
 */
async function readSettings(
  executor: typeof db | Transaction,
  userId: string,
  { lock = false }: { lock?: boolean } = {},
): Promise<{ settings: ScheduleSettings; plannedThrough: DayNumber | null } | null> {
  const query = executor.select().from(scheduleSettings).where(eq(scheduleSettings.userId, userId));
  const [row] = lock ? await query.for("update") : await query;
  if (!row) {
    return null;
  }
  return {
    settings: {
      startTimes: row.startTimes,
      weekdayMinutes: row.weekdayMinutes,
      weekendMinutes: row.weekendMinutes,
      timeZone: row.timeZone,
    },
    plannedThrough: row.plannedThrough === null ? null : toDayNumber(row.plannedThrough),
  };
}

async function planRange(
  tx: Transaction,
  userId: string,
  settings: ScheduleSettings,
  from: DayNumber,
  to: DayNumber,
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
      })
      .from(task)
      .where(eq(task.userId, userId)),
    tx
      .select({ taskId: occurrence.taskId, last: max(occurrence.date) })
      .from(occurrence)
      .where(and(eq(occurrence.userId, userId), lt(occurrence.date, fromDate)))
      .groupBy(occurrence.taskId),
  ]);
  const lastDone = new Map(
    history.flatMap(({ taskId, last }) => (last ? [[taskId, toDayNumber(last)] as const] : [])),
  );
  const { days: plan } = schedule({
    tasks: tasks.map((t) => ({ ...t, kind: t.kind === "routine" ? "routine" : "cleaning" })),
    settings,
    lastDone,
    from,
    to,
  });

  await tx
    .delete(occurrence)
    .where(and(eq(occurrence.userId, userId), gte(occurrence.date, fromDate)));
  const rows = plan.flatMap(({ day, taskIds }) =>
    taskIds.map((taskId) => ({ userId, taskId, date: toIsoDate(day) })),
  );
  if (rows.length > 0) {
    await tx.insert(occurrence).values(rows).onConflictDoNothing();
  }
  await tx
    .update(scheduleSettings)
    .set({ plannedThrough: toIsoDate(to) })
    .where(eq(scheduleSettings.userId, userId));
}
