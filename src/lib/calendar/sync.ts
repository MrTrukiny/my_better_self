import "server-only";
import { and, between, eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import {
  type CalendarStatus,
  calendarConnection,
  calendarDay,
  item,
  occurrence,
  room,
  scheduleSettings,
  task,
} from "@/db/schema";
import { getEnv } from "@/lib/env";
import { toDayNumber, toIsoDate, zonedNow } from "@/lib/scheduler/dates";
import { buildWeek, type PlanOccurrence } from "@/lib/scheduler/format";
import { plannedMinutes } from "@/lib/scheduler/planned-minutes";
import { replanStart } from "@/lib/scheduler/replan-start";
import { PLAN_DAYS, type ScheduleSettings } from "@/lib/scheduler/settings";
import { getCalendarClient } from "./client";
import { planSync } from "./diff";
import { buildEvent, type CalendarEvent, zonedTimeToUtc } from "./events";
import { type CalendarClient, CalendarError } from "./google";
import { busyCalendarIds, overlapsBusy } from "./overlap";

export const CLEANING_CALENDAR_NAME = "Cleaning";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type SyncResult = "skipped" | CalendarStatus;

/**
 * Runs `syncCalendar` once the response is sent, so saving tasks or settings doesn't wait for
 * Google. Only for Server Actions and route handlers; the daily job awaits `syncCalendar`.
 */
export function scheduleCalendarSync(userId: string): void {
  after(() => syncCalendar(userId));
}

/**
 * Brings the owner's "Cleaning" calendar in line with the plan, from the first day a replan may
 * change through the seventh day, and records which sessions overlap busy times. `force`
 * ("Sync now") starts at today and rewrites every day, even unchanged ones. Never throws:
 * failures are logged and stored as the connection's status.
 */
export async function syncCalendar(
  userId: string,
  { now = new Date(), force = false }: { now?: Date; force?: boolean } = {},
): Promise<SyncResult> {
  try {
    // The row lock runs one sync per owner at a time, so two can't both create a calendar.
    return await db.transaction(async (tx) => {
      const [connection] = await tx
        .select()
        .from(calendarConnection)
        .where(eq(calendarConnection.userId, userId))
        .for("update");
      if (!connection) {
        return "skipped";
      }
      let status: CalendarStatus = "ok";
      let calendarId = connection.calendarId;
      let calendarName = connection.calendarName;
      try {
        // Without a schedule there's no plan, and no time zone to create the calendar in yet.
        const settings = await readSettings(tx, userId);
        if (settings) {
          const client = await getCalendarClient(userId);
          const calendar = await ensureCalendar(tx, client, userId, calendarId, settings.timeZone);
          calendarId = calendar.id;
          calendarName = calendar.summary;
          await syncDays(tx, client, userId, calendar.id, settings, now, force);
        }
      } catch (error) {
        status = error instanceof CalendarError && error.kind === "auth" ? "reauth" : "error";
        console.error("calendar sync failed", { userId, status, error });
      }
      await tx
        .update(calendarConnection)
        .set({
          status,
          calendarId,
          calendarName,
          ...(status === "ok" ? { lastSyncedAt: now } : {}),
        })
        .where(eq(calendarConnection.userId, userId));
      return status;
    });
  } catch (error) {
    console.error("calendar sync failed", { userId, error });
    return "error";
  }
}

/** The "Cleaning" calendar, created again (with every day re-put) if it's missing. */
async function ensureCalendar(
  tx: Transaction,
  client: CalendarClient,
  userId: string,
  calendarId: string | null,
  timeZone: string,
): Promise<{ id: string; summary: string }> {
  if (calendarId) {
    try {
      return await client.getCalendar(calendarId);
    } catch (error) {
      if (!(error instanceof CalendarError && error.kind === "gone")) {
        throw error;
      }
    }
  }
  const created = await client.createCalendar({ summary: CLEANING_CALENDAR_NAME, timeZone });
  await tx.delete(calendarDay).where(eq(calendarDay.userId, userId));
  await tx
    .update(calendarConnection)
    .set({ calendarId: created.id, calendarName: created.summary })
    .where(eq(calendarConnection.userId, userId));
  return created;
}

async function syncDays(
  tx: Transaction,
  client: CalendarClient,
  userId: string,
  calendarId: string,
  settings: ScheduleSettings,
  now: Date,
  force: boolean,
): Promise<void> {
  const today = zonedNow(settings.timeZone, now).day;
  const from = toIsoDate(force ? today : replanStart(settings, now));
  const to = toIsoDate(today + PLAN_DAYS - 1);
  const appUrl = getEnv().BETTER_AUTH_URL;

  const occurrences = await readOccurrences(tx, userId, from, to);
  const desired = buildWeek(settings, occurrences, today)
    .filter((day) => day.date >= from)
    .flatMap((day) => buildEvent(day, { userId, timeZone: settings.timeZone, appUrl }) ?? []);
  const stored = await tx
    .select({
      date: calendarDay.date,
      eventId: calendarDay.eventId,
      digest: calendarDay.digest,
      overlap: calendarDay.overlap,
    })
    .from(calendarDay)
    .where(and(eq(calendarDay.userId, userId), between(calendarDay.date, from, to)));

  const overlaps = await findOverlaps(client, calendarId, desired, settings.timeZone, from, to);
  const { puts, deletes } = planSync({ desired, stored, from, to, force });

  for (const day of deletes) {
    await client.deleteEvent(calendarId, day.eventId);
    await tx
      .delete(calendarDay)
      .where(and(eq(calendarDay.userId, userId), eq(calendarDay.date, day.date)));
  }
  for (const event of puts) {
    await client.putEvent(calendarId, event);
    const values = {
      eventId: event.id,
      digest: event.digest,
      overlap: overlaps.has(event.date),
    };
    await tx
      .insert(calendarDay)
      .values({ userId, date: event.date, ...values })
      .onConflictDoUpdate({ target: [calendarDay.userId, calendarDay.date], set: values });
  }
  // Unchanged days keep their event, but their overlap can change with the owner's calendars.
  const written = new Set(puts.map((event) => event.date));
  const kept = new Set(desired.map((event) => event.date));
  for (const day of stored) {
    const overlap = overlaps.has(day.date);
    if (kept.has(day.date) && !written.has(day.date) && day.overlap !== overlap) {
      await tx
        .update(calendarDay)
        .set({ overlap })
        .where(and(eq(calendarDay.userId, userId), eq(calendarDay.date, day.date)));
    }
  }
}

/** Dates whose session overlaps a busy time in the owner's other calendars. */
async function findOverlaps(
  client: CalendarClient,
  calendarId: string,
  desired: readonly CalendarEvent[],
  timeZone: string,
  from: string,
  to: string,
): Promise<Set<string>> {
  if (desired.length === 0) {
    return new Set();
  }
  const calendarIds = busyCalendarIds(await client.listCalendars(), calendarId);
  const busy = await client.queryBusy({
    calendarIds,
    timeMin: zonedTimeToUtc(from, 0, timeZone),
    timeMax: zonedTimeToUtc(toIsoDate(toDayNumber(to) + 1), 0, timeZone),
    timeZone,
  });
  return new Set(desired.filter((event) => overlapsBusy(event, busy)).map((event) => event.date));
}

async function readSettings(tx: Transaction, userId: string): Promise<ScheduleSettings | null> {
  const [row] = await tx
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

async function readOccurrences(
  tx: Transaction,
  userId: string,
  from: string,
  to: string,
): Promise<PlanOccurrence[]> {
  const rows = await tx
    .select({
      date: occurrence.date,
      id: task.id,
      kind: task.kind,
      name: task.name,
      minutes: plannedMinutes,
      roomName: room.name,
      itemName: item.name,
    })
    .from(occurrence)
    .innerJoin(task, eq(task.id, occurrence.taskId))
    .leftJoin(room, eq(room.id, task.roomId))
    .leftJoin(item, eq(item.id, task.itemId))
    .where(and(eq(occurrence.userId, userId), between(occurrence.date, from, to)));
  return rows.map(({ date, kind, ...rest }) => ({
    date,
    task: { ...rest, kind: kind === "routine" ? "routine" : "cleaning" },
  }));
}
