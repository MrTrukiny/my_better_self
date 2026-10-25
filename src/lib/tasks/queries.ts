import "server-only";
import { eq } from "drizzle-orm";
import { cacheTag } from "next/cache";
import { db } from "@/db";
import { homeProfile } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { HELPER_IDS, type HelperId } from "./helpers";

export type HomeProfile = { helpers: HelperId[]; note: string | null };

/** Cache tag for one user's home profile, tasks, and proposals. */
export function tasksTag(userId: string): string {
  return `tasks:${userId}`;
}

export async function getHomeProfile(): Promise<HomeProfile> {
  const user = await getCurrentUser();
  return homeProfileForUser(user.id);
}

// Not exported: callers must go through the getters above, which resolve the user first.
async function homeProfileForUser(userId: string): Promise<HomeProfile> {
  "use cache";
  cacheTag(tasksTag(userId));

  const [row] = await db
    .select({ helpers: homeProfile.helpers, note: homeProfile.note })
    .from(homeProfile)
    .where(eq(homeProfile.userId, userId));
  const known = new Set<string>(HELPER_IDS);
  return {
    helpers: (row?.helpers ?? []).filter((id): id is HelperId => known.has(id)),
    note: row?.note ?? null,
  };
}
