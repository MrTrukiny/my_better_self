import "server-only";
import { and, asc, eq, gte, inArray, lt, min, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { occurrence, scheduleSettings, task } from "@/db/schema";
import { scheduleCalendarSync } from "@/lib/calendar/sync";
import { peopleOf } from "@/lib/household/queries";
import { toDayNumber, toIsoDate, zonedNow } from "./dates";
import { lastCompletions, type PastOccurrence } from "./history";
import {
  fullRange,
  type HouseholdRange,
  type PersonState,
  pendingHouseholdRange,
} from "./household-range";
import { schedule } from "./schedule";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Transaction;

/**
 * Replaces the household's plan from each person's first replan day (today, or tomorrow once
 * their session has started) through their seventh day. Call after any change to tasks or
 * settings. Only people with settings get tasks; does nothing when nobody has them. See ADR 0011.
 */
export async function replan(householdId: string, now: Date = new Date()): Promise<void> {
  const people = await peopleOf(householdId);
  if ((await readStates(db, people, now)).length === 0) {
    return;
  }
  await db.transaction(async (tx) => {
    const range = fullRange(await readStates(tx, people, now, { lock: true }), now);
    if (range) {
      await planRange(tx, householdId, range, now);
    }
  });
}

/**
 * For actions whose own change already succeeded: a failed replan is logged, not reported,
 * and the next change or settings save replans again. Every member's calendar follows.
 */
export async function replanAfterChange(householdId: string): Promise<void> {
  try {
    await replan(householdId);
    await syncHouseholdCalendars(householdId);
  } catch (error) {
    console.error("replan failed", error);
  }
}

/** Schedules a calendar sync after the response for everyone in the household but `except`. */
export async function syncHouseholdCalendars(
  householdId: string,
  { except }: { except?: string } = {},
): Promise<void> {
  for (const person of await peopleOf(householdId)) {
    if (person !== except) scheduleCalendarSync(person);
  }
}

/**
 * Keeps the plan current as days pass: the first call on anyone's new day replans the household
 * from today, so what wasn't done comes back, and later calls only plan the days missing from
 * someone's week.
 */
export async function ensurePlan(householdId: string, now: Date = new Date()): Promise<void> {
  const people = await peopleOf(householdId);
  if (!pendingHouseholdRange(await readStates(db, people, now), now)) {
    return;
  }
  await db.transaction(async (tx) => {
    const range = pendingHouseholdRange(await readStates(tx, people, now, { lock: true }), now);
    if (range) {
      await planRange(tx, householdId, range, range.full ? now : null);
    }
  });
}

/**
 * Reads the settings rows of the people who have them, and whether each one's today has started.
 * Writers re-read them with `lock` inside their transaction, in user id order, so concurrent
 * replans of one household run one at a time without deadlocks; the unlocked read only skips
 * needless work.
 */
async function readStates(
  executor: Executor,
  people: readonly string[],
  now: Date,
  { lock = false }: { lock?: boolean } = {},
): Promise<PersonState[]> {
  const query = executor
    .select()
    .from(scheduleSettings)
    .where(inArray(scheduleSettings.userId, [...people]))
    .orderBy(asc(scheduleSettings.userId));
  const rows = lock ? await query.for("update") : await query;
  return Promise.all(
    rows.map(async (row) => {
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
            eq(occurrence.userId, row.userId),
            eq(occurrence.date, today),
            ne(occurrence.status, "scheduled"),
          ),
        )
        .limit(1);
      return {
        id: row.userId,
        settings,
        plannedThrough: row.plannedThrough === null ? null : toDayNumber(row.plannedThrough),
        replannedOn: row.replannedOn === null ? null : toDayNumber(row.replannedOn),
        todayStarted: handled !== undefined,
      };
    }),
  );
}

/**
 * Plans the range for everyone in it; pass `replannedAt` when this is a full replan. Each
 * person's occurrences before their own start stay and count as handled.
 */
async function planRange(
  tx: Transaction,
  householdId: string,
  range: HouseholdRange,
  replannedAt: Date | null,
): Promise<void> {
  const { from, to, people } = range;
  const fromDate = toIsoDate(from);
  const ofHousehold = eq(task.userId, householdId);
  const [tasks, history, upcoming] = await Promise.all([
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
      .where(ofHousehold),
    // Every member's history counts, since the tasks are shared.
    tx
      .select({
        taskId: occurrence.taskId,
        lastHandled: sql<
          string | null
        >`max(${occurrence.date}) filter (where ${occurrence.status} <> 'scheduled')`,
        first: min(occurrence.date),
      })
      .from(occurrence)
      .innerJoin(task, eq(task.id, occurrence.taskId))
      .where(and(ofHousehold, lt(occurrence.date, fromDate)))
      .groupBy(occurrence.taskId),
    tx
      .select({ userId: occurrence.userId, taskId: occurrence.taskId, date: occurrence.date })
      .from(occurrence)
      .innerJoin(task, eq(task.id, occurrence.taskId))
      .where(and(ofHousehold, gte(occurrence.date, fromDate))),
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
  const startOf = new Map(people.map((p) => [p.id, p.start]));
  const kept = upcoming.flatMap(({ userId, taskId, date }) => {
    const day = toDayNumber(date);
    const start = startOf.get(userId);
    return start !== undefined && day < start ? [{ personId: userId, taskId, day }] : [];
  });
  const { days, firstDues } = schedule({
    tasks: tasks.map((t) => ({ ...t, kind: t.kind === "routine" ? "routine" : "cleaning" })),
    people: people.map((p) => ({ id: p.id, budgets: p.settings, start: p.start })),
    kept,
    lastDone,
    from,
    to,
  });

  for (const person of people) {
    await tx
      .delete(occurrence)
      .where(
        and(
          eq(occurrence.userId, person.id),
          gte(occurrence.date, toIsoDate(person.start)),
          eq(occurrence.status, "scheduled"),
        ),
      );
  }
  const minutesOf = new Map(tasks.map((t) => [t.id, t.minutes]));
  const rows = days.flatMap(({ day, byPerson }) =>
    [...byPerson].flatMap(([userId, taskIds]) =>
      taskIds.map((taskId) => ({
        userId,
        taskId,
        date: toIsoDate(day),
        plannedMinutes: minutesOf.get(taskId) ?? null,
      })),
    ),
  );
  if (rows.length > 0) {
    await tx.insert(occurrence).values(rows).onConflictDoNothing();
  }
  for (const [taskId, due] of firstDues) {
    await tx
      .update(task)
      .set({ firstDue: toIsoDate(due) })
      .where(and(eq(task.id, taskId), ofHousehold));
  }
  for (const person of people) {
    await tx
      .update(scheduleSettings)
      .set({
        plannedThrough: toIsoDate(to),
        ...(replannedAt && {
          replannedOn: toIsoDate(zonedNow(person.settings.timeZone, replannedAt).day),
        }),
      })
      .where(eq(scheduleSettings.userId, person.id));
  }
}
