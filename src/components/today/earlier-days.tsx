"use client";

import { CalendarCheck, ChevronDown, Coffee, Repeat, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { OfflineCacheWarmer } from "@/components/offline-cache-warmer";
import { useIsOffline } from "@/hooks/use-is-offline";
import { toIsoDate, zonedNow } from "@/lib/scheduler/dates";
import { dayLabel } from "@/lib/scheduler/format";
import type { EarlierTask } from "@/lib/today/earlier";
import { countsOf, isComplete } from "@/lib/today/progress";
import type { QueuedChange } from "@/lib/today/queue";
import { type CheckOffResult, isEditableDay } from "@/lib/today/schemas";
import { TaskRow } from "./task-row";
import { useCheckOffs } from "./use-check-offs";

/** Pages whose offline copies show past check-offs: these days, the streak, and the plan. */
const EARLIER_PAGES = ["/earlier-days", "/", "/plan"];

export type EarlierDaysProps = {
  userId: string;
  timeZone: string;
  /** Newest first. */
  days: { date: string; dayOff: boolean; tasks: EarlierTask[] }[];
  /** Fingerprint of the server data, for the offline copies. */
  version: string;
  send: (change: QueuedChange) => Promise<CheckOffResult>;
};

export function EarlierDays({ userId, timeZone, days, version, send }: EarlierDaysProps) {
  const isOffline = useIsOffline();
  const [deviceDate, setDeviceDate] = useState<string | null>(null);
  const { withChanges, update, isQueued, failing, synced } = useCheckOffs({
    userId,
    tasks: days.flatMap((d) => d.tasks),
    send,
  });

  useEffect(() => {
    setDeviceDate(toIsoDate(zonedNow(timeZone, new Date()).day));
  }, [timeZone]);

  if (days.length === 0) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-base">
        <CalendarCheck aria-hidden className="size-5 shrink-0" />
        No earlier days yet. Sessions from the last week show up here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {isOffline ? (
        <p
          role="status"
          className="bg-muted text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <WifiOff aria-hidden className="size-4 shrink-0" />
          You're offline. What you check is saved on this device and syncs when you're back.
        </p>
      ) : null}
      {failing ? (
        <p role="status" className="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-sm">
          Couldn't save your changes yet. They're kept on this device, and we'll keep trying.
        </p>
      ) : null}

      {days.map(({ date, dayOff, tasks }) => {
        const label = dayLabel(date);
        const headingId = `day-${date}`;
        const current = withChanges(tasks);
        const cleaning = current.filter((t) => t.kind === "cleaning");
        const routines = current.filter((t) => t.kind === "routine");
        const counts = countsOf(cleaning);
        const disabled = deviceDate !== null && !isEditableDay(date, deviceDate);
        const row = (task: EarlierTask) => (
          <TaskRow
            key={task.occurrenceId}
            task={task}
            context={label}
            pending={isQueued(task.occurrenceId) && (isOffline || failing)}
            disabled={disabled}
            onChange={(status) => update(task, status, null)}
            onMinutes={
              task.kind === "cleaning" ? (minutes) => update(task, "done", minutes) : undefined
            }
          />
        );
        return (
          <section key={date} aria-labelledby={headingId} className="rounded-xl border">
            <details
              open={!isComplete(countsOf(tasks.filter((t) => t.kind === "cleaning"))) && !dayOff}
              className="group"
            >
              <summary className="focus-visible:ring-ring flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-2 outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 flex-1 flex-col">
                  <h2 id={headingId} className="text-base font-medium">
                    {label}
                  </h2>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {dayOff
                      ? "Day off"
                      : cleaning.length === 0
                        ? "Nothing to clean"
                        : progressText(counts)}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden
                  className="text-muted-foreground size-5 shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="flex flex-col gap-3 px-4 pb-3">
                {dayOff ? (
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Coffee aria-hidden className="size-4 shrink-0" />
                    Nothing was planned.
                  </p>
                ) : null}
                {disabled ? (
                  <p className="text-muted-foreground text-sm">
                    This day is more than a week ago, so it can't be changed.
                  </p>
                ) : null}
                {cleaning.length > 0 ? (
                  <ul aria-label={`Cleaning on ${label}`} className="flex flex-col divide-y">
                    {cleaning.map(row)}
                  </ul>
                ) : null}
                {routines.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    <h3 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                      <Repeat aria-hidden className="size-4 shrink-0" />
                      Routines
                    </h3>
                    <ul aria-label={`Routines on ${label}`} className="flex flex-col">
                      {routines.map(row)}
                    </ul>
                  </div>
                ) : null}
              </div>
            </details>
          </section>
        );
      })}

      <OfflineCacheWarmer urls={EARLIER_PAGES} version={`${version}-${synced}`} />
    </div>
  );
}

function progressText({ total, done, skipped }: { total: number; done: number; skipped: number }) {
  const text = `${done} of ${total} done`;
  return skipped > 0 ? `${text} · ${skipped} skipped` : text;
}
