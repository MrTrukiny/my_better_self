import "server-only";
import { createHash } from "node:crypto";

/** A short fingerprint of the data on screen, so `OfflineCacheWarmer` doesn't ship the data itself. */
export function cacheVersion(data: unknown): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("base64url").slice(0, 16);
}
