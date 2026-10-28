import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calendarConnection } from "@/db/schema";
import { isAuthorizedCron } from "@/lib/calendar/cron-auth";
import { syncCalendar } from "@/lib/calendar/sync";
import { getEnv } from "@/lib/env";
import { subscribedOwners } from "@/lib/notifications/queries";
import { scheduleReminders } from "@/lib/notifications/schedule-reminders";
import { ensurePlan } from "@/lib/scheduler/plan";

/**
 * The daily job (Vercel Cron, see vercel.json): for each connected owner, one at a time, extend
 * the plan to the next 7 days and sync their calendar. Then, for each owner with a push
 * subscription, queue the reminders of the next hours (ADR 0010). One owner's failure doesn't
 * stop the rest.
 * There is no signed-in user here; the job secret is the authorization.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request.headers.get("authorization"), getEnv().CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const owners = await db.select({ userId: calendarConnection.userId }).from(calendarConnection);
  let synced = 0;
  let failed = 0;
  for (const { userId } of owners) {
    try {
      await ensurePlan(userId);
      const result = await syncCalendar(userId);
      if (result === "ok" || result === "skipped") {
        synced++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error("daily job failed for an owner", { userId, error });
      failed++;
    }
  }
  let reminders = 0;
  for (const userId of await subscribedOwners()) {
    try {
      reminders += await scheduleReminders(userId);
    } catch (error) {
      console.error("scheduling reminders failed for an owner", { userId, error });
      failed++;
    }
  }
  return NextResponse.json({ owners: owners.length, synced, failed, reminders });
}
