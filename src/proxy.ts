import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { SIGN_IN_PATH } from "@/lib/callback-url";

/**
 * Optimistic check only: it sees whether a session cookie exists, not whether it is valid.
 * Pages and actions validate the session through `getCurrentUser()`.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) {
    return NextResponse.next();
  }
  const signIn = new URL(SIGN_IN_PATH, request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/") {
    signIn.searchParams.set("callbackURL", `${pathname}${search}`);
  }
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: [
    "/((?!api/auth|api/cron|sign-in|serwist|~offline|manifest.webmanifest|icons/|_next/static|_next/image|favicon.ico).*)",
  ],
};
