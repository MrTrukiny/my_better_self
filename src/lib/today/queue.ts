import type { OccurrenceStatus } from "@/db/schema/schedule";
import type { CheckOffResult } from "./schemas";

/**
 * Check-offs waiting to reach the server, kept on the device so they survive a reload or a
 * lost connection. One entry per occurrence: a later change replaces an earlier one. See ADR 0008.
 */
export type QueuedChange = {
  occurrenceId: string;
  status: OccurrenceStatus;
  /** As in `CheckOffInput`: a number sets the minutes, null clears them, absent keeps them. */
  actualMinutes?: number | null;
  /** Same meaning as `actualMinutes` (spec 016). */
  note?: string | null;
  queuedAt: number;
};

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

/**
 * A later done change to a task that already has a queued done change merges into it, so a note
 * saved after a time keeps the time. Any other change replaces the queued one.
 */
export function enqueue(
  storage: QueueStorage,
  userId: string,
  change: QueuedChange,
): QueuedChange[] {
  const current = readQueue(storage, userId);
  const previous = current.find((c) => c.occurrenceId === change.occurrenceId);
  const merged =
    previous?.status === "done" && change.status === "done"
      ? {
          ...change,
          ...keep("actualMinutes", change, previous),
          ...keep("note", change, previous),
        }
      : change;
  const queue = [...current.filter((c) => c.occurrenceId !== change.occurrenceId), merged];
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

function keep<K extends "actualMinutes" | "note">(
  key: K,
  change: QueuedChange,
  previous: QueuedChange,
): Pick<QueuedChange, K> | Record<string, never> {
  const value = change[key] !== undefined ? change[key] : previous[key];
  return value === undefined ? {} : ({ [key]: value } as Pick<QueuedChange, K>);
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
  const { occurrenceId, status, actualMinutes, note, queuedAt } = value as Record<string, unknown>;
  return (
    typeof occurrenceId === "string" &&
    (status === "scheduled" || status === "done" || status === "skipped") &&
    (actualMinutes === undefined || actualMinutes === null || Number.isInteger(actualMinutes)) &&
    (note === undefined || note === null || typeof note === "string") &&
    typeof queuedAt === "number"
  );
}
