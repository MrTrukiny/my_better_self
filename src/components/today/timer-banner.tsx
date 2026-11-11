"use client";

import { Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dayLabel } from "@/lib/scheduler/format";
import { formatElapsed } from "@/lib/today/timers";

/**
 * The timer in use, above the list: today's links to its row; one left on another day (the
 * plan moved on, or the day changed while it ran) can be stopped there or discarded.
 */
export function TimerBanner({
  occurrenceId,
  taskName,
  date,
  elapsedMs,
  running,
  onStop,
  onDiscard,
  disabled,
}: {
  occurrenceId: string;
  /** Null when the timer's task isn't on today's list. */
  taskName: string | null;
  date: string;
  elapsedMs: number;
  running: boolean;
  /** Only for a timer from an earlier day, which can still be saved. */
  onStop?: () => void;
  onDiscard: () => void;
  disabled: boolean;
}) {
  const time = <span className="tabular-nums">{formatElapsed(elapsedMs)}</span>;
  if (taskName !== null) {
    return (
      <p className="bg-muted flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
        <Timer aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">
          {running ? "Timing" : "Paused"}:{" "}
          <a href={`#task-${occurrenceId}`} className="font-medium underline underline-offset-4">
            {taskName}
          </a>
          , {time}
        </span>
      </p>
    );
  }
  return (
    <div className="bg-muted flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm">
      <Timer aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        A timer from {dayLabel(date)} is {running ? "still running" : "paused"}, {time}.
      </span>
      {onStop ? (
        <Button
          type="button"
          variant="outline"
          onClick={onStop}
          disabled={disabled}
          className="h-11"
        >
          Stop and save
        </Button>
      ) : null}
      <Button type="button" variant="ghost" onClick={onDiscard} className="h-11">
        Discard
      </Button>
    </div>
  );
}
