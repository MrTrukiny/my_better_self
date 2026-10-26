"use client";

import { Coffee, Flame, PartyPopper, Repeat, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { OfflineCacheWarmer } from "@/components/offline-cache-warmer";
import { Progress } from "@/components/ui/progress";
import type { OccurrenceStatus } from "@/db/schema/schedule";
import { useIsOffline } from "@/hooks/use-is-offline";
import { formatTime, parseTime, toIsoDate, zonedNow } from "@/lib/scheduler/dates";
import { dayLabel } from "@/lib/scheduler/format";
import { progressOf, type TodayTask } from "@/lib/today/progress";
import type { FlushResult, QueuedChange } from "@/lib/today/queue";
import type { CheckOffResult } from "@/lib/today/schemas";
import { streakLine } from "@/lib/today/streak";
import { TaskRow } from "./task-row";
import { useCheckOffQueue } from "./use-check-off-queue";

/** Pages whose offline copies show today's check-offs. */
const TODAY_PAGES = ["/", "/plan"];

export type TodaySessionProps = {
  userId: string;
  date: string;
  timeZone: string;
  /** The day's start time, or null on a day off. */
  start: string | null;
  tasks: TodayTask[];
  /** Complete cleaning days before today. */
  pastStreak: number;
  /** Fingerprint of the server data, for the offline copies. */
  version: string;
  send: (change: QueuedChange) => Promise<CheckOffResult>;
};

export function TodaySession({
  userId,
  date,
  timeZone,
  start,
  tasks,
  pastStreak,
  version,
  send,
}: TodaySessionProps) {
  const router = useRouter();
  const isOffline = useIsOffline();
  const [local, setLocal] = useState<Record<string, OccurrenceStatus>>({});
  const [synced, setSynced] = useState(0);
  const [deviceDate, setDeviceDate] = useState<string | null>(null);

  const onDropped = useCallback(
    (dropped: FlushResult["dropped"]) => {
      for (const { change, result } of dropped) {
        const name = tasks.find((t) => t.occurrenceId === change.occurrenceId)?.name;
        toast.error(
          result === "gone" && name
            ? `"${name}" is no longer in today's plan, so that change wasn't saved.`
            : "A change from an earlier day couldn't be saved.",
        );
      }
      router.refresh();
    },
    [tasks, router],
  );
  const onSynced = useCallback(() => setSynced((n) => n + 1), []);
  const { queue, failing, change } = useCheckOffQueue({ userId, send, onDropped, onSynced });

  useEffect(() => {
    setDeviceDate(toIsoDate(zonedNow(timeZone, new Date()).day));
  }, [timeZone]);
  // An offline copy opened on a later day: its tasks can no longer be checked.
  const stale = deviceDate !== null && deviceDate !== date;

  const queued = new Map(queue.map((c) => [c.occurrenceId, c.status]));
  const current = tasks.map((t) => ({
    ...t,
    status: queued.get(t.occurrenceId) ?? local[t.occurrenceId] ?? t.status,
  }));
  const cleaning = current.filter((t) => t.kind === "cleaning");
  const routines = current.filter((t) => t.kind === "routine");
  const progress = progressOf(current);
  const streak = pastStreak + (progress.complete ? 1 : 0);
  const startMinutes = start === null ? null : parseTime(start);

  const update = (task: TodayTask, status: OccurrenceStatus) => {
    setLocal((prev) => ({ ...prev, [task.occurrenceId]: status }));
    change(task.occurrenceId, status);
  };
  const row = (task: TodayTask) => (
    <TaskRow
      key={task.occurrenceId}
      task={task}
      pending={queued.has(task.occurrenceId) && (isOffline || failing)}
      disabled={stale}
      onChange={(status) => update(task, status)}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">
          {dayLabel(date)}
          {startMinutes !== null && cleaning.length > 0 ? (
            <span className="tabular-nums">
              {" "}
              · {start}–{formatTime(startMinutes + progress.totalMinutes)}
            </span>
          ) : null}
        </p>
        {progress.complete ? null : (
          <p className="flex items-center gap-2 text-sm font-medium">
            <Flame aria-hidden className="text-primary size-4 shrink-0" />
            {streakLine(streak)}
          </p>
        )}
      </div>

      {isOffline && !stale ? (
        <p
          role="status"
          className="bg-muted text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <WifiOff aria-hidden className="size-4 shrink-0" />
          You're offline. What you check is saved on this device and syncs when you're back.
        </p>
      ) : null}
      {stale ? (
        <p role="status" className="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-sm">
          This is the session saved for {dayLabel(date)}. Connect to see today's.
        </p>
      ) : null}
      {failing ? (
        <p role="status" className="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-sm">
          Couldn't save your changes yet. They're kept on this device, and we'll keep trying.
        </p>
      ) : null}

      {start === null ? (
        <p className="text-muted-foreground flex items-center gap-2 text-base">
          <Coffee aria-hidden className="size-5 shrink-0" />
          Day off
        </p>
      ) : cleaning.length === 0 ? (
        <p className="text-muted-foreground flex items-center gap-2 text-base">
          <Coffee aria-hidden className="size-5 shrink-0" />
          Nothing to clean today, enjoy the day.
        </p>
      ) : (
        <section aria-labelledby="session-heading" className="flex flex-col gap-3">
          <h2 id="session-heading" className="sr-only">
            Today's session
          </h2>
          <div aria-live="polite">
            {progress.complete ? (
              <p className="flex items-center gap-2 text-base font-medium">
                <PartyPopper aria-hidden className="text-primary size-5 shrink-0" />
                Done for today. {streakLine(streak)}.
              </p>
            ) : (
              <p className="text-base font-medium tabular-nums">
                {progress.doneMinutes} of {progress.totalMinutes} min done
              </p>
            )}
          </div>
          <Progress
            aria-label="Session progress"
            value={
              progress.totalMinutes === 0
                ? 100
                : Math.round((progress.doneMinutes / progress.totalMinutes) * 100)
            }
          />
          <ul aria-label="Cleaning today" className="flex flex-col divide-y">
            {cleaning.map(row)}
          </ul>
        </section>
      )}

      {routines.length > 0 ? (
        <section aria-labelledby="routines-heading" className="flex flex-col gap-1">
          <h2
            id="routines-heading"
            className="text-muted-foreground flex items-center gap-2 text-sm font-medium"
          >
            <Repeat aria-hidden className="size-4 shrink-0" />
            Also today
          </h2>
          <ul aria-label="Routines today" className="flex flex-col">
            {routines.map(row)}
          </ul>
        </section>
      ) : null}

      <OfflineCacheWarmer urls={TODAY_PAGES} version={`${version}-${synced}`} />
    </div>
  );
}
