"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { account, calendarConnection, calendarDay } from "@/db/schema";
import { getCalendarClient } from "@/lib/calendar/client";
import { CalendarError } from "@/lib/calendar/google";
import { withoutCalendarScopes } from "@/lib/calendar/scopes";
import type { ActionState } from "@/lib/inventory/action-state";
import { getCurrentUser } from "@/lib/session";

const DISCONNECT_FAILED = "Couldn't disconnect your calendar. Try again.";

/**
 * Deletes the "Cleaning" calendar in Google, revokes the grant, and forgets the connection.
 * When access is already lost there is nothing left to delete from here, so it just forgets.
 */
export async function disconnectCalendar(): Promise<ActionState> {
  const user = await getCurrentUser();
  try {
    const result = await db.transaction(async (tx) => {
      // Locked like a sync, so one can't recreate the calendar while it's being removed.
      const [connection] = await tx
        .select({ calendarId: calendarConnection.calendarId })
        .from(calendarConnection)
        .where(eq(calendarConnection.userId, user.id))
        .for("update");
      if (!connection) {
        return "done";
      }
      try {
        const client = await getCalendarClient(user.id);
        if (connection.calendarId) {
          await client.deleteCalendar(connection.calendarId).catch((error: unknown) => {
            if (!(error instanceof CalendarError && error.kind === "gone")) {
              throw error;
            }
          });
        }
        await client.revoke();
      } catch (error) {
        if (!(error instanceof CalendarError && error.kind === "auth")) {
          console.error("disconnectCalendar failed", error);
          return "failed";
        }
      }
      await tx.delete(calendarDay).where(eq(calendarDay.userId, user.id));
      await tx.delete(calendarConnection).where(eq(calendarConnection.userId, user.id));
      const [google] = await tx
        .select({ id: account.id, scope: account.scope })
        .from(account)
        .where(and(eq(account.userId, user.id), eq(account.providerId, "google")));
      if (google) {
        await tx
          .update(account)
          .set({ refreshToken: null, scope: withoutCalendarScopes(google.scope) })
          .where(eq(account.id, google.id));
      }
      return "done";
    });
    if (result === "failed") {
      return { status: "error", formError: DISCONNECT_FAILED };
    }
    refresh();
    return { status: "success" };
  } catch (error) {
    console.error("disconnectCalendar failed", error);
    return { status: "error", formError: DISCONNECT_FAILED };
  }
}
