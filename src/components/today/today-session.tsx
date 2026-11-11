"use client";

import { Coffee, Flame, PartyPopper, Repeat, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { OfflineCacheWarmer } from "@/components/offline-cache-warmer";
import { Progress } from "@/components/ui/progress";
import type { OccurrenceStatus } from "@/db/schema/schedule";
import { useIsOffline } from "@/hooks/use-is-offline";
import { formatTime, parseTime, toIsoDate, zonedNow } from "@/lib/scheduler/dates";
import { dayLabel } from "@/lib/scheduler/format";
import { progressOf, type TodayTask } from "@/lib/today/progress";
import type { QueuedChange } from "@/lib/today/queue";
import { type CheckOffResult, isEditableDay } from "@/lib/today/schemas";
import { sessionSlots } from "@/lib/today/slots";
import { streakLine } from "@/lib/today/streak";
import { elapsedMs } from "@/lib/today/timers";
import { TaskRow } from "./task-row";
import { TimerBanner } from "./timer-banner";
import type { CheckOffDetails } from "./use-check-off-queue";
import { useCheckOffs } from "./use-check-offs";
import { useTimers } from "./use-timers";

/** Pages whose offline copies show today's check-offs. */
const TODAY_PAGES = ["/", "/plan", "/earlier-days"];

export type TodaySessionProps = {
  userId: string;
  date: string;
  timeZone: string;
  /** The day's start time, or null on a day off. */
  start: string | null;
  /** The day's cleaning minutes; the session lasts this long. */
  budget: number;
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
  budget,
  tasks,
  pastStreak,
  version,
  send,
}: TodaySessionProps) {
  const isOffline = useIsOffline();
  const [deviceDate, setDeviceDate] = useState<string | null>(null);

  const { withChanges, update, record, isQueued, failing, synced } = useCheckOffs({
    userId,
    tasks,
    send,
  });
  const timers = useTimers(userId);
  const [capped, setCapped] = useState<ReadonlySet<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    setDeviceDate(toIsoDate(zonedNow(timeZone, new Date()).day));
  }, [timeZone]);
  // An offline copy opened on a later day: its tasks can no longer be checked.
  const stale = deviceDate !== null && deviceDate !== date;

  const current = withChanges(tasks);
  const cleaning = current.filter((t) => t.kind === "cleaning");
  const routines = current.filter((t) => t.kind === "routine");
  const slots = sessionSlots(start, cleaning);
  const progress = progressOf(current);
  const streak = pastStreak + (progress.complete ? 1 : 0);
  const startMinutes = start === null ? null : parseTime(start);

  function save(task: TodayTask, status: OccurrenceStatus, details: CheckOffDetails) {
    if (status !== "done" || details.actualMinutes !== undefined) {
      setCapped((current) => without(current, task.occurrenceId));
    }
    update(task, status, details);
  }

  // Checking a timed task off is the same as stopping its timer; any other status drops it.
  function changeStatus(task: TodayTask, status: OccurrenceStatus) {
    if (status === "done" && timers.timers[task.occurrenceId]) {
      stopTimer(task);
      return;
    }
    if (timers.timers[task.occurrenceId]) {
      timers.clear(task.occurrenceId);
    }
    save(task, status, { actualMinutes: null, note: null });
  }

  function stopTimer(task: TodayTask) {
    const stopped = timers.stop(task.occurrenceId);
    if (!stopped) {
      return;
    }
    save(task, "done", { actualMinutes: stopped.minutes, note: null });
    if (stopped.capped) {
      setCapped((current) => new Set(current).add(task.occurrenceId));
    }
    setAnnouncement(`Timer stopped. ${task.name} took ${stopped.minutes} min.`);
  }

  const timerFor = (task: TodayTask) => {
    const entry = timers.timers[task.occurrenceId];
    return {
      elapsedMs: entry ? elapsedMs(entry, timers.now) : null,
      running: entry?.startedAt != null,
      onStart: () => {
        timers.start(task.occurrenceId, date);
        setAnnouncement(`Timer ${entry ? "resumed" : "started"} for ${task.name}.`);
      },
      onPause: () => {
        timers.pause(task.occurrenceId);
        setAnnouncement(`Timer paused for ${task.name}.`);
      },
      onStop: () => stopTimer(task),
    };
  };

  const row = (task: TodayTask, index?: number) => (
    <TaskRow
      key={task.occurrenceId}
      task={task}
      position={index === undefined ? undefined : index + 1}
      slot={index === undefined ? undefined : slots[index]}
      pending={isQueued(task.occurrenceId) && (isOffline || failing)}
      disabled={stale}
      onChange={(status) => changeStatus(task, status)}
      onMinutes={
        task.kind === "cleaning"
          ? (minutes) => save(task, "done", { actualMinutes: minutes })
          : undefined
      }
      onNote={task.kind === "cleaning" ? (note) => save(task, "done", { note }) : undefined}
      timer={task.kind === "cleaning" && !stale ? timerFor(task) : undefined}
      capped={capped.has(task.occurrenceId)}
    />
  );

  const activeId = timers.running ?? Object.keys(timers.timers)[0] ?? null;
  const active = activeId === null ? undefined : timers.timers[activeId];
  const activeTask = cleaning.find((t) => t.occurrenceId === activeId) ?? null;
  const banner =
    activeId !== null && active && !stale ? (
      <TimerBanner
        occurrenceId={activeId}
        taskName={activeTask?.name ?? null}
        date={active.date}
        elapsedMs={elapsedMs(active, timers.now)}
        running={active.startedAt !== null}
        disabled={stale}
        onStop={
          !activeTask && active.date < date && isEditableDay(active.date, date)
            ? () => {
                const stopped = timers.stop(activeId);
                if (stopped) {
                  record(activeId, "done", { actualMinutes: stopped.minutes, note: null });
                  setAnnouncement(`Timer stopped. Saved ${stopped.minutes} min.`);
                }
              }
            : undefined
        }
        onDiscard={() => {
          timers.clear(activeId);
          setAnnouncement("Timer discarded.");
        }}
      />
    ) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">
          {dayLabel(date)}
          {startMinutes !== null && cleaning.length > 0 ? (
            <span className="tabular-nums">
              {" "}
              · {start}–{formatTime(startMinutes + budget)} · {progress.totalMinutes} of {budget}{" "}
              min
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
          {banner}
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
          {progress.tookMinutes > 0 ? (
            <p className="text-muted-foreground text-sm tabular-nums">
              Took {progress.tookMinutes} min so far
            </p>
          ) : null}
          <ul aria-label="Cleaning today" className="flex flex-col divide-y">
            {cleaning.map((task, index) => row(task, index))}
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
            {routines.map((task) => row(task))}
          </ul>
        </section>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <OfflineCacheWarmer urls={TODAY_PAGES} version={`${version}-${synced}`} />
    </div>
  );
}

function without(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!set.has(id)) {
    return set;
  }
  const next = new Set(set);
  next.delete(id);
  return next;
}
