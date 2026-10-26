import "server-only";
import { and, between, eq } from "drizzle-orm";
import { db } from "@/db";
import { type CalendarStatus, calendarConnection, calendarDay } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { CLEANING_CALENDAR_NAME } from "./sync";

export type CalendarConnectionView = {
  status: CalendarStatus;
  calendarName: string;
  email: string;
};

/**
 * The owner's calendar connection, or null when it isn't connected. Not cached: syncs after the
 * response change it, so read it inside a Suspense boundary.
 */
export async function getCalendarConnection(): Promise<CalendarConnectionView | null> {
  const user = await getCurrentUser();
  const [row] = await db
    .select({ status: calendarConnection.status, calendarName: calendarConnection.calendarName })
    .from(calendarConnection)
    .where(eq(calendarConnection.userId, user.id));
  if (!row) {
    return null;
  }
  return {
    status: row.status,
    calendarName: row.calendarName ?? CLEANING_CALENDAR_NAME,
    email: user.email,
  };
}

/** Dates from `from` through `to` (ISO) whose session overlaps another event. */
export async function getOverlapDates(from: string, to: string): Promise<Set<string>> {
  const user = await getCurrentUser();
  const rows = await db
    .select({ date: calendarDay.date })
    .from(calendarDay)
    .innerJoin(calendarConnection, eq(calendarConnection.userId, calendarDay.userId))
    .where(
      and(
        eq(calendarDay.userId, user.id),
        eq(calendarDay.overlap, true),
        between(calendarDay.date, from, to),
      ),
    );
  return new Set(rows.map((row) => row.date));
}
