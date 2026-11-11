import "server-only";
import { cacheLife } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SIGN_IN_PATH } from "@/lib/callback-url";
import { membershipOf } from "@/lib/household/queries";
import { type HouseholdRole, householdOf } from "@/lib/household/rules";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  /**
   * Whose home this is: shared data (inventory, tasks, home profile) is stored under it, while
   * personal data (schedule, plan, calendar, notifications) uses `id`. See ADR 0011.
   */
  householdId: string;
  role: HouseholdRole;
};

async function readCurrentUser(): Promise<CurrentUser | null> {
  "use cache: private";
  cacheLife("minutes");

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }
  const { id, name, email, image } = session.user;
  const household = householdOf(id, await membershipOf(id));
  return { id, name, email, image: image ?? null, ...household };
}

/**
 * The data access layer's entry point: every protected page, Server Action, and
 * route handler resolves the user here. The proxy check is only an optimistic redirect.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const user = await readCurrentUser();
  if (!user) {
    redirect(SIGN_IN_PATH);
  }
  return user;
}

export async function getOptionalUser(): Promise<CurrentUser | null> {
  return readCurrentUser();
}
