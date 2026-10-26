import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calendarConnection } from "@/db/schema";
import { findGoogleAccount, isCalendarFake } from "@/lib/calendar/client";
import { hasCalendarScopes } from "@/lib/calendar/scopes";
import { syncCalendar } from "@/lib/calendar/sync";
import { getCurrentUser } from "@/lib/session";

/**
 * Where Google's consent screen lands after "Connect Google Calendar" (through Better Auth's
 * link callback, which saved the tokens). Connects only if every calendar scope was granted.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const back = (result: "connected" | "denied") =>
    NextResponse.redirect(new URL(`/schedule?calendar=${result}`, request.url));

  if (!isCalendarFake()) {
    const google = await findGoogleAccount(user.id);
    if (!google?.refreshToken || !hasCalendarScopes(google.scope)) {
      return back("denied");
    }
  }
  await db
    .insert(calendarConnection)
    .values({ userId: user.id })
    .onConflictDoUpdate({ target: calendarConnection.userId, set: { status: "ok" } });
  await syncCalendar(user.id);
  return back("connected");
}
