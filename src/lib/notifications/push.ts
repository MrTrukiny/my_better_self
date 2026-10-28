import "server-only";
import * as webpush from "web-push";
import { getEnv } from "@/lib/env";
import { isPushFake } from "./config";

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

export type PushPayload = { title: string; body: string; url: string; tag: string };

/** Push services drop undelivered messages after this; a reminder is useless later. */
const TTL_SECONDS = 30 * 60;

/** `gone`: the push service no longer knows the subscription, so it should be deleted. */
export async function sendPush(
  target: PushTarget,
  payload: PushPayload,
): Promise<"sent" | "gone" | "failed"> {
  if (isPushFake()) {
    return "sent";
  }
  const env = getEnv();
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      {
        TTL: TTL_SECONDS,
        urgency: "high",
        vapidDetails: {
          subject: env.VAPID_SUBJECT ?? "",
          publicKey: env.VAPID_PUBLIC_KEY ?? "",
          privateKey: env.VAPID_PRIVATE_KEY ?? "",
        },
      },
    );
    return "sent";
  } catch (error) {
    if (
      error instanceof webpush.WebPushError &&
      (error.statusCode === 404 || error.statusCode === 410)
    ) {
      return "gone";
    }
    console.error("push failed", error instanceof webpush.WebPushError ? error.statusCode : error);
    return "failed";
  }
}
