import "server-only";
import { cacheLife } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SIGN_IN_PATH } from "@/lib/callback-url";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

async function readCurrentUser(): Promise<CurrentUser | null> {
  "use cache: private";
  cacheLife("minutes");

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }
  const { id, name, email, image } = session.user;
  return { id, name, email, image: image ?? null };
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
