"use client";

import { CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { OccurrenceStatus } from "@/db/schema/schedule";
import { planTarget } from "@/lib/scheduler/format";
import { formatMinutes } from "@/lib/tasks/format";
import type { TodayTask } from "@/lib/today/progress";
import type { Slot } from "@/lib/today/slots";
import { cn } from "@/lib/utils";
import { TookField } from "./took-field";

export function TaskRow({
  task,
  position,
  slot,
  pending,
  disabled,
  onChange,
  onMinutes,
}: {
  task: TodayTask;
  /** The task's place in the recommended order, for cleaning tasks. */
  position?: number;
  slot?: Slot | null;
  /** Shows that the change is only on this device so far. */
  pending: boolean;
  disabled: boolean;
  onChange: (status: OccurrenceStatus) => void;
  /** Saves the minutes a done cleaning task took; routines don't take them. */
  onMinutes?: (minutes: number | null) => void;
}) {
  const done = task.status === "done";
  const skipped = task.status === "skipped";
  const cleaning = task.kind === "cleaning";
  return (
    <li className="flex flex-col gap-1 py-2">
      {position === undefined ? null : (
        <p className="text-muted-foreground text-xs font-medium tabular-nums">
          {position}
          {slot ? ` · ${slot.start}–${slot.end}` : null}
        </p>
      )}
      <div className="flex items-center gap-2">
        <label
          className={cn(
            "flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md py-1",
            (disabled || skipped) && "cursor-default",
          )}
        >
          <Checkbox
            checked={done}
            disabled={disabled || skipped}
            onCheckedChange={(checked) => onChange(checked ? "done" : "scheduled")}
            className="size-5"
          />
          <span
            className={cn("flex min-w-0 flex-col", (done || skipped) && "text-muted-foreground")}
          >
            <span className={cn("text-base", done && "line-through")}>{task.name}</span>
            {cleaning ? (
              <span className="text-muted-foreground text-sm">{planTarget(task)}</span>
            ) : null}
          </span>
        </label>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="flex items-center gap-2">
            {cleaning ? (
              <span className="text-muted-foreground text-sm tabular-nums">
                {skipped ? "Skipped" : formatMinutes(task.minutes)}
              </span>
            ) : null}
            {cleaning ? (
              <Button
                type="button"
                variant="ghost"
                disabled={disabled || done}
                onClick={() => onChange(skipped ? "scheduled" : "skipped")}
                aria-label={skipped ? `Undo skipping ${task.name}` : `Skip ${task.name}`}
                className="h-11 px-3"
              >
                {skipped ? "Undo" : "Skip"}
              </Button>
            ) : null}
          </span>
          {pending ? (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <CloudOff aria-hidden className="size-3.5" />
              Saved on this device
            </span>
          ) : null}
        </div>
      </div>
      {cleaning && done && onMinutes ? (
        <div className="pl-8">
          <TookField
            taskName={task.name}
            value={task.actualMinutes}
            estimate={task.minutes}
            disabled={disabled}
            onSave={onMinutes}
          />
        </div>
      ) : null}
    </li>
  );
}
