"use client";

import { LoaderCircle, RotateCw, Sparkles } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";
import { useEditsDisabled } from "@/components/inventory/edit-guard";
import { Button } from "@/components/ui/button";
import { GENERATE_IDLE, type GenerateState } from "@/lib/tasks/generate-state";

/** What the button says while idle, busy, and done. */
export type GenerateCopy = {
  label: string;
  /** Busy text, by milliseconds since the request started. */
  progress: { after: number; text: string }[];
  result: (count: number) => string;
};

function proposalCopy(scopeLabel: string): GenerateCopy {
  return {
    label: "Propose tasks",
    progress: [
      { after: 0, text: "Reading your inventory..." },
      { after: 2_000, text: "Proposing tasks..." },
      { after: 20_000, text: "Still working. This can take up to a minute..." },
    ],
    result: (count) =>
      count === 0
        ? `No new tasks to propose for ${scopeLabel}.`
        : `${count} ${count === 1 ? "task" : "tasks"} proposed for ${scopeLabel}.`,
  };
}

export function GenerateButton({
  action,
  scopeLabel = "the whole home",
  copy = proposalCopy(scopeLabel),
  unavailableReason,
}: {
  action: () => Promise<GenerateState>;
  /** How the scope of task proposals reads in a sentence: "the whole home" or a room name. */
  scopeLabel?: string;
  /** Replaces the task proposal wording, for other AI requests. */
  copy?: GenerateCopy;
  unavailableReason?: string;
}) {
  const [state, setState] = useState<GenerateState>(GENERATE_IDLE);
  const [isPending, startTransition] = useTransition();
  const [elapsed, setElapsed] = useState(0);
  const editsDisabled = useEditsDisabled();
  const reasonId = useId();

  useEffect(() => {
    if (!isPending) {
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 500);
    return () => {
      clearInterval(timer);
      setElapsed(0);
    };
  }, [isPending]);

  function generate() {
    if (isPending) {
      return;
    }
    setState(GENERATE_IDLE);
    startTransition(async () => {
      const result = await action();
      startTransition(() => setState(result));
    });
  }

  const progress = copy.progress.findLast((step) => elapsed >= step.after) ?? copy.progress[0];

  return (
    <div className="flex flex-col gap-3">
      <Button
        size="lg"
        className="h-11 w-full sm:w-fit"
        onClick={generate}
        disabled={isPending || editsDisabled || Boolean(unavailableReason)}
        aria-describedby={unavailableReason ? reasonId : undefined}
      >
        {isPending ? (
          <>
            <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
            {progress?.text}
          </>
        ) : (
          <>
            <Sparkles aria-hidden />
            {copy.label}
          </>
        )}
      </Button>
      {unavailableReason ? (
        <p id={reasonId} className="text-muted-foreground text-sm">
          {unavailableReason}
        </p>
      ) : null}
      <p role="status" className="text-sm">
        {state.status === "success" ? copy.result(state.count) : ""}
      </p>
      {state.status === "error" ? (
        <div
          role="alert"
          className="border-destructive/40 flex flex-col gap-3 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-destructive text-sm">{state.formError}</p>
          <Button variant="outline" size="lg" className="h-11 shrink-0" onClick={generate}>
            <RotateCw aria-hidden />
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
