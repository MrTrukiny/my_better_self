import "server-only";
import { Client, Receiver } from "@upstash/qstash";
import { getEnv } from "@/lib/env";
import { isPushFake, sendUrl } from "./config";
import type { UpcomingReminder } from "./reminders";

export type QueuedReminder = { userId: string; kind: string; date: string; time: string };

/** QStash retries a failed delivery; a few tries fit inside the reminder's late limit. */
const RETRIES = 2;

/**
 * Queues one reminder to arrive at its time. The deduplication id makes queuing the same
 * reminder twice (the daily job and a settings save) send one message.
 */
export async function queueReminder(userId: string, reminder: UpcomingReminder): Promise<void> {
  if (isPushFake()) {
    return;
  }
  const env = getEnv();
  const client = new Client({ token: env.QSTASH_TOKEN ?? "", baseUrl: env.QSTASH_URL });
  const body: QueuedReminder = {
    userId,
    kind: reminder.kind,
    date: reminder.date,
    time: reminder.time,
  };
  await client.publishJSON({
    url: sendUrl(),
    body,
    notBefore: Math.floor(reminder.at.getTime() / 1000),
    deduplicationId: [userId, reminder.date, reminder.kind, reminder.time.replace(":", "")].join(
      "-",
    ),
    retries: RETRIES,
  });
}

/** Whether a request to the send route was signed by QStash for that route. */
export async function isSignedByQStash(signature: string | null, body: string): Promise<boolean> {
  const env = getEnv();
  if (!signature || !env.QSTASH_CURRENT_SIGNING_KEY || !env.QSTASH_NEXT_SIGNING_KEY) {
    return false;
  }
  const receiver = new Receiver({
    currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
  });
  try {
    return await receiver.verify({ signature, body, url: sendUrl(), clockTolerance: 5 });
  } catch {
    return false;
  }
}
