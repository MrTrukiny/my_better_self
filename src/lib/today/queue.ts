import type { OccurrenceStatus } from "@/db/schema/schedule";
import type { CheckOffResult } from "./schemas";

/**
 * Check-offs waiting to reach the server, kept on the device so they survive a reload or a
 * lost connection. One entry per occurrence: a later change replaces an earlier one. See ADR 0008.
 */
export type QueuedChange = { occurrenceId: string; status: OccurrenceStatus; queuedAt: number };

type QueueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function queueKey(userId: string): string {
  return `mbs:check-off:${userId}`;
}

export function readQueue(storage: QueueStorage, userId: string): QueuedChange[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(queueKey(userId)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isQueuedChange) : [];
  } catch {
    return [];
  }
}

export function enqueue(
  storage: QueueStorage,
  userId: string,
  change: QueuedChange,
): QueuedChange[] {
  const queue = [
    ...readQueue(storage, userId).filter((c) => c.occurrenceId !== change.occurrenceId),
    change,
  ];
  write(storage, userId, queue);
  return queue;
}

/** Removes `change` only if it is still the latest one for its occurrence. */
export function dequeue(
  storage: QueueStorage,
  userId: string,
  change: QueuedChange,
): QueuedChange[] {
  const queue = readQueue(storage, userId).filter(
    (c) => !(c.occurrenceId === change.occurrenceId && c.queuedAt === change.queuedAt),
  );
  write(storage, userId, queue);
  return queue;
}

export type FlushResult = {
  /** Changes the server refused for good (`gone`, `past`, `invalid`); they left the queue. */
  dropped: { change: QueuedChange; result: CheckOffResult }[];
  /** True when sending stopped on a failure; the rest stays queued for the next try. */
  failed: boolean;
};

/** Sends the queue in order, one change at a time, and stops at the first failure. */
export async function flushQueue(
  storage: QueueStorage,
  userId: string,
  send: (change: QueuedChange) => Promise<CheckOffResult>,
): Promise<FlushResult> {
  const dropped: FlushResult["dropped"] = [];
  for (const change of readQueue(storage, userId)) {
    let result: CheckOffResult;
    try {
      result = await send(change);
    } catch {
      result = "failed";
    }
    if (result === "failed") {
      return { dropped, failed: true };
    }
    dequeue(storage, userId, change);
    if (result !== "ok") {
      dropped.push({ change, result });
    }
  }
  return { dropped, failed: false };
}

function write(storage: QueueStorage, userId: string, queue: QueuedChange[]): void {
  if (queue.length === 0) {
    storage.removeItem(queueKey(userId));
  } else {
    storage.setItem(queueKey(userId), JSON.stringify(queue));
  }
}

function isQueuedChange(value: unknown): value is QueuedChange {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { occurrenceId, status, queuedAt } = value as Record<string, unknown>;
  return (
    typeof occurrenceId === "string" &&
    (status === "scheduled" || status === "done" || status === "skipped") &&
    typeof queuedAt === "number"
  );
}
