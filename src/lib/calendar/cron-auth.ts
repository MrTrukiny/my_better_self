import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Whether the `Authorization` header carries the job secret, the way Vercel Cron sends it.
 * Both sides are hashed so the timing-safe compare gets equal lengths. No secret, no access.
 */
export function isAuthorizedCron(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) {
    return false;
  }
  const given = createHash("sha256").update(header).digest();
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(given, expected);
}
