"use client";

import { Check, CheckCheck, LoaderCircle, Pencil, X } from "lucide-react";
import { useState, useTransition } from "react";
import {
  acceptAllProposals,
  acceptProposal,
  discardProposal,
  updateProposal,
} from "@/app/(app)/tasks/actions";
import { useEditsDisabled } from "@/components/inventory/edit-guard";
import { FormError } from "@/components/inventory/form-messages";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/inventory/action-state";
import { calibrationNote } from "@/lib/tasks/calibration";
import { formatFrequency, formatMinutes, targetLabel } from "@/lib/tasks/format";
import type { TaskEntry } from "@/lib/tasks/queries";
import { TaskForm } from "./task-form";

function useEntryAction() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  function run(action: () => Promise<ActionState>) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") {
        setError(result.formError);
      }
    });
  }
  return { isPending, error, run };
}

export function TaskSummary({ entry }: { entry: TaskEntry }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="font-medium break-words">{entry.name}</span>
      <span className="text-muted-foreground text-sm">
        {targetLabel(entry)} · {formatMinutes(entry.minutes)} ·{" "}
        {formatFrequency(entry.frequencyDays)}
        {entry.kind === "routine" ? " · Routine" : null}
      </span>
      {entry.calibration ? (
        <span className="text-muted-foreground text-xs">
          {calibrationNote({ ...entry.calibration, minutes: entry.minutes })}
        </span>
      ) : null}
    </div>
  );
}

export function ProposalCard({ proposal }: { proposal: TaskEntry }) {
  const [editing, setEditing] = useState(false);
  const { isPending, error, run } = useEntryAction();
  const editsDisabled = useEditsDisabled();
  const disabled = isPending || editsDisabled;

  return (
    <li className="flex flex-col gap-2 py-3 pr-1 pl-4">
      <div className="flex items-start gap-2">
        <TaskSummary entry={proposal} />
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-11"
            aria-label={`Edit ${proposal.name}`}
            onClick={() => setEditing(true)}
            disabled={disabled}
          >
            <Pencil aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-11"
            aria-label={`Discard ${proposal.name}`}
            onClick={() => run(() => discardProposal(proposal.id))}
            disabled={disabled}
          >
            <X aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11"
            aria-label={`Accept ${proposal.name}`}
            onClick={() => run(() => acceptProposal(proposal.id))}
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
      <ResponsiveDialog open={editing} onOpenChange={setEditing} title="Edit proposal">
        <TaskForm
          action={updateProposal.bind(null, proposal.id)}
          onSuccess={() => setEditing(false)}
          defaults={proposal}
        />
      </ResponsiveDialog>
    </li>
  );
}

export function AcceptAllBar({ count }: { count: number }) {
  const { isPending, error, run } = useEntryAction();
  const editsDisabled = useEditsDisabled();
  return (
    <div className="bg-background/95 sticky bottom-0 -mx-4 flex flex-col gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      <FormError message={error} />
      <Button
        size="lg"
        className="h-11 w-full sm:w-fit"
        onClick={() => run(acceptAllProposals)}
        disabled={isPending || editsDisabled}
      >
        {isPending ? (
          <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
        ) : (
          <CheckCheck aria-hidden />
        )}
        Accept all ({count})
      </Button>
    </div>
  );
}
