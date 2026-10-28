"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OccurrenceStatus } from "@/db/schema/schedule";
import {
  enqueue,
  type FlushResult,
  flushQueue,
  type QueuedChange,
  readQueue,
} from "@/lib/today/queue";
import type { CheckOffResult } from "@/lib/today/schemas";

/** Waits before retrying after a failure; the last value repeats. */
const RETRY_DELAYS_MS = [2_000, 10_000, 30_000];
/** A notice appears only once this many tries in a row have failed. */
const FAILURES_BEFORE_NOTICE = 2;

/**
 * Every mounted queue flushes through this chain, one at a time: Next keeps the previous page
 * mounted while hidden, so Today and Earlier days can both hold a queue for the same owner, and
 * two flushes at once could send an older copy of a change after a newer one.
 */
let flushes: Promise<void> = Promise.resolve();

type Options = {
  userId: string;
  send: (change: QueuedChange) => Promise<CheckOffResult>;
  onDropped: (dropped: FlushResult["dropped"]) => void;
  /** Called after the queue empties, so offline copies can be refreshed. */
  onSynced: () => void;
};

/**
 * Keeps check-offs on the device until the server has them, and sends them in order on load,
 * when the connection comes back, and when the app becomes visible. See ADR 0008.
 */
export function useCheckOffQueue({ userId, send, onDropped, onSynced }: Options) {
  const [queue, setQueue] = useState<QueuedChange[]>([]);
  const [failing, setFailing] = useState(false);
  const callbacks = useRef({ send, onDropped, onSynced });
  useEffect(() => {
    callbacks.current = { send, onDropped, onSynced };
  });
  const flushing = useRef(false);
  const failures = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flush = useCallback(async () => {
    if (flushing.current || !navigator.onLine) {
      return;
    }
    flushing.current = true;
    clearTimeout(retryTimer.current);
    const run = flushes.then(async () => {
      let sent = false;
      // Changes queued while sending are picked up by the next round.
      while (readQueue(localStorage, userId).length > 0) {
        sent = true;
        const result = await flushQueue(localStorage, userId, (change) =>
          callbacks.current.send(change),
        );
        setQueue(readQueue(localStorage, userId));
        if (result.dropped.length > 0) {
          callbacks.current.onDropped(result.dropped);
        }
        if (result.failed) {
          failures.current++;
          setFailing(failures.current >= FAILURES_BEFORE_NOTICE);
          const delay =
            RETRY_DELAYS_MS[Math.min(failures.current, RETRY_DELAYS_MS.length) - 1] ?? 30_000;
          retryTimer.current = setTimeout(() => void flush(), delay);
          return;
        }
      }
      setQueue([]);
      failures.current = 0;
      setFailing(false);
      if (sent) {
        callbacks.current.onSynced();
      }
    });
    flushes = run.catch(() => {});
    try {
      await run;
    } finally {
      flushing.current = false;
    }
  }, [userId]);

  useEffect(() => {
    setQueue(readQueue(localStorage, userId));
    void flush();
    const onVisible = () => {
      if (document.visibilityState === "visible") void flush();
    };
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(retryTimer.current);
    };
  }, [userId, flush]);

  const change = useCallback(
    (occurrenceId: string, status: OccurrenceStatus, actualMinutes?: number | null) => {
      setQueue(
        enqueue(localStorage, userId, {
          occurrenceId,
          status,
          ...(actualMinutes === undefined ? {} : { actualMinutes }),
          queuedAt: Date.now(),
        }),
      );
      void flush();
    },
    [userId, flush],
  );

  return { queue, failing, change };
}
