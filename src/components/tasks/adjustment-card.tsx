"use client";

import { Check, LoaderCircle, Pencil, X } from "lucide-react";
import { useState } from "react";
import {
  acceptAdjustment,
  acceptEditedAdjustment,
  discardAdjustment,
} from "@/app/(app)/tasks/adjustments/actions";
import { useEditsDisabled } from "@/components/inventory/edit-guard";
import { FormError } from "@/components/inventory/form-messages";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { changeLabel } from "@/lib/tasks/adjustments";
import { targetLabel } from "@/lib/tasks/format";
import type { PendingAdjustment } from "@/lib/tasks/queries";
import { useEntryAction } from "./proposal-card";
import { type TaskDefaults, TaskForm } from "./task-form";

/** The task as it would be after accepting, for the edit form. */
function resultOf(adjustment: PendingAdjustment): TaskDefaults {
  const { task } = adjustment;
  switch (adjustment.change) {
    case "minutes":
      return { ...task, minutes: adjustment.minutes ?? task.minutes, calibration: null };
    case "frequency":
      return { ...task, frequencyDays: adjustment.frequencyDays ?? task.frequencyDays };
    case "new_task":
      return {
        name: adjustment.name ?? "",
        kind: "cleaning",
        minutes: adjustment.minutes ?? task.minutes,
        frequencyDays: adjustment.frequencyDays ?? task.frequencyDays,
      };
  }
}

export function AdjustmentCard({ adjustment }: { adjustment: PendingAdjustment }) {
  const [editing, setEditing] = useState(false);
  const { isPending, error, run } = useEntryAction();
  const editsDisabled = useEditsDisabled();
  const disabled = isPending || editsDisabled;
  const { task } = adjustment;

  return (
    <li className="flex flex-col gap-2 py-3 pr-1 pl-4">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-col">
            <span className="font-medium break-words">{task.name}</span>
            <span className="text-muted-foreground text-sm">{targetLabel(task)}</span>
          </span>
          <span className="text-sm font-medium tabular-nums">{changeLabel(adjustment, task)}</span>
          <p className="text-sm">{adjustment.reason}</p>
          <p className="text-muted-foreground text-xs">{adjustment.evidence}</p>
        </div>
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-11"
            aria-label={`Edit adjustment for ${task.name}`}
            onClick={() => setEditing(true)}
            disabled={disabled}
          >
            <Pencil aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-11"
            aria-label={`Discard adjustment for ${task.name}`}
            onClick={() => run(() => discardAdjustment(adjustment.id))}
            disabled={disabled}
          >
            <X aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11"
            aria-label={`Accept adjustment for ${task.name}`}
            onClick={() => run(() => acceptAdjustment(adjustment.id))}
            disabled={disabled}
          >
            {isPending ? (
              <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
            ) : (
              <Check aria-hidden />
            )}
          </Button>
        </div>
      </div>
      <FormError message={error} />
      <ResponsiveDialog
        open={editing}
        onOpenChange={setEditing}
        title={adjustment.change === "new_task" ? "Edit new task" : `Edit ${task.name}`}
      >
        <TaskForm
          action={acceptEditedAdjustment.bind(null, adjustment.id)}
          onSuccess={() => setEditing(false)}
          defaults={resultOf(adjustment)}
          submitLabel="Accept"
        />
      </ResponsiveDialog>
    </li>
  );
}
