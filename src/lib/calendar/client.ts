import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { account } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { createFakeCalendarClient } from "./fake";
import { type CalendarClient, CalendarError, createGoogleCalendarClient } from "./google";

export function isCalendarFake(): boolean {
  return getEnv().CALENDAR_FAKE;
}

/** The owner's Google account row, which holds the tokens and granted scopes. */
export async function findGoogleAccount(userId: string) {
  const [row] = await db
    .select({ id: account.id, scope: account.scope, refreshToken: account.refreshToken })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "google")));
  return row ?? null;
}

/**
 * A client acting for the owner. Better Auth refreshes the access token with the stored refresh
 * token; when it can't, access is treated as lost (`auth`), since it doesn't say why.
 */
export async function getCalendarClient(userId: string): Promise<CalendarClient> {
  if (isCalendarFake()) {
    return createFakeCalendarClient(userId);
  }
  const google = await findGoogleAccount(userId);
  if (!google) {
    throw new CalendarError("auth", "No Google account is linked");
  }
  let accessToken: string | undefined;
  try {
    ({ accessToken } = await auth.api.getAccessToken({
      body: { accountId: google.id, userId },
    }));
  } catch (error) {
    throw new CalendarError("auth", `Couldn't get a Google access token: ${String(error)}`);
  }
  if (!accessToken) {
    throw new CalendarError("auth", "Google returned no access token");
  }
  return createGoogleCalendarClient(accessToken);
}
