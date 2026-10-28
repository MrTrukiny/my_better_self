"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { OccurrenceStatus } from "@/db/schema/schedule";
import type { TodayTask } from "@/lib/today/progress";
import type { FlushResult, QueuedChange } from "@/lib/today/queue";
import { type CheckOffResult, EDITABLE_PAST_DAYS } from "@/lib/today/schemas";
import { useCheckOffQueue } from "./use-check-off-queue";

type Change = { status: OccurrenceStatus; actualMinutes: number | null };

/**
 * Check-offs as the owner sees them: the server's tasks with this device's changes on top,
 * whether they are still queued or already sent but not yet reloaded. Shared by Today and
 * Earlier days, which use the same queue. Changes the server refuses for good are dropped with a
 * notice and the page reloads.
 */
export function useCheckOffs({
  userId,
  tasks,
  send,
}: {
  userId: string;
  /** The page's tasks, to name them in notices. */
  tasks: readonly TodayTask[];
  send: (change: QueuedChange) => Promise<CheckOffResult>;
}) {
  const router = useRouter();
  const [local, setLocal] = useState<Record<string, Change>>({});
  const onDropped = useCallback(
    (dropped: FlushResult["dropped"]) => {
      for (const { change, result } of dropped) {
        const name = tasks.find((t) => t.occurrenceId === change.occurrenceId)?.name;
        toast.error(droppedNotice(result, name));
      }
      router.refresh();
    },
    [tasks, router],
  );
  const [synced, setSynced] = useState(0);
  const onSynced = useCallback(() => setSynced((n) => n + 1), []);
  const { queue, failing, change } = useCheckOffQueue({ userId, send, onDropped, onSynced });
  const queued = new Map(queue.map((c) => [c.occurrenceId, c]));

  function withChanges<T extends TodayTask>(tasks: readonly T[]): T[] {
    return tasks.map((t) => {
      const changed = queued.get(t.occurrenceId) ?? local[t.occurrenceId];
      const status = changed?.status ?? t.status;
      const minutes =
        changed?.actualMinutes === undefined ? t.actualMinutes : changed.actualMinutes;
      return { ...t, status, actualMinutes: status === "done" ? minutes : null };
    });
  }

  // Checking a task starts it without minutes; any other status clears them on the server.
  function update(task: TodayTask, status: OccurrenceStatus, actualMinutes: number | null) {
    setLocal((prev) => ({ ...prev, [task.occurrenceId]: { status, actualMinutes } }));
    change(task.occurrenceId, status, status === "done" ? actualMinutes : undefined);
  }

  return {
    withChanges,
    update,
    isQueued: (occurrenceId: string) => queued.has(occurrenceId),
    failing,
    /** Counts emptied queues, so offline copies can be refreshed. */
    synced,
  };
}

function droppedNotice(result: CheckOffResult, name: string | undefined): string {
  if (result === "gone" && name) {
    return `"${name}" is no longer in the plan, so that change wasn't saved.`;
  }
  if (result === "past") {
    return `A change for a day more than ${EDITABLE_PAST_DAYS} days ago couldn't be saved.`;
  }
  return "A change couldn't be saved.";
}
