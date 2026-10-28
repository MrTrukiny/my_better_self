import "server-only";
import { getEnv } from "@/lib/env";

/** Any string works with the stubbed browser subscription that e2e uses. */
const FAKE_PUBLIC_KEY = "fake-vapid-public-key";

export function isPushFake(): boolean {
  return getEnv().PUSH_FAKE;
}

/** The key browsers subscribe with, or null when notifications aren't set up. */
export function vapidPublicKey(): string | null {
  const env = getEnv();
  if (env.PUSH_FAKE) {
    return env.VAPID_PUBLIC_KEY ?? FAKE_PUBLIC_KEY;
  }
  const configured =
    env.VAPID_PUBLIC_KEY &&
    env.VAPID_PRIVATE_KEY &&
    env.VAPID_SUBJECT &&
    env.QSTASH_TOKEN &&
    env.QSTASH_CURRENT_SIGNING_KEY &&
    env.QSTASH_NEXT_SIGNING_KEY;
  return configured ? (env.VAPID_PUBLIC_KEY ?? null) : null;
}

export function isPushConfigured(): boolean {
  return vapidPublicKey() !== null;
}

/** Where QStash delivers reminders; also the URL its signature is checked against. */
export function sendUrl(): string {
  return new URL("/api/notifications/send", getEnv().BETTER_AUTH_URL).toString();
}
