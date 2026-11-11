"use client";

import { Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatElapsed } from "@/lib/today/timers";

export type RowTimer = {
  /** Null when the task has no timer yet. */
  elapsedMs: number | null;
  running: boolean;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
};

/** Start, or the elapsed time with pause or resume and stop (spec 016). */
export function TimerControls({
  timer,
  taskName,
  disabled,
}: {
  timer: RowTimer;
  taskName: string;
  disabled: boolean;
}) {
  if (timer.elapsedMs === null) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={timer.onStart}
        aria-label={`Start timer for ${taskName}`}
        className="size-11"
      >
        <Play aria-hidden />
      </Button>
    );
  }
  return (
    <span className="flex items-center">
      <span className="min-w-12 text-right text-sm font-medium tabular-nums">
        <span className="sr-only">{timer.running ? "Timing" : "Paused at"} </span>
        {formatElapsed(timer.elapsedMs)}
      </span>
      {timer.running ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={timer.onPause}
          aria-label={`Pause timer for ${taskName}`}
          className="size-11"
        >
          <Pause aria-hidden />
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={timer.onStart}
          aria-label={`Resume timer for ${taskName}`}
          className="size-11"
        >
          <Play aria-hidden />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={timer.onStop}
        aria-label={`Stop timer for ${taskName}`}
        className="size-11"
      >
        <Square aria-hidden />
      </Button>
    </span>
  );
}
