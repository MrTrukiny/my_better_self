"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { ACTUAL_MINUTES } from "@/lib/today/schemas";

const RANGE_MESSAGE = `Enter whole minutes from ${ACTUAL_MINUTES.min} to ${ACTUAL_MINUTES.max}.`;

/** Parses the field: null when empty, undefined when it isn't a valid number of minutes. */
function parseMinutes(draft: string): number | null | undefined {
  const text = draft.trim();
  if (text === "") {
    return null;
  }
  if (!/^\d+$/.test(text)) {
    return undefined;
  }
  const minutes = Number(text);
  return minutes >= ACTUAL_MINUTES.min && minutes <= ACTUAL_MINUTES.max ? minutes : undefined;
}

/** The minutes a done task took, saved when the field loses focus or on Enter. */
export function TookField({
  taskName,
  value,
  estimate,
  disabled,
  onSave,
}: {
  taskName: string;
  value: number | null;
  estimate: number;
  disabled: boolean;
  onSave: (minutes: number | null) => void;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const [invalid, setInvalid] = useState(false);
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setDraft(value === null ? "" : String(value));
    setInvalid(false);
  }
  const errorId = useId();

  const commit = () => {
    const minutes = parseMinutes(draft);
    if (minutes === undefined) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (minutes !== value) {
      onSave(minutes);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <span aria-hidden>Took</span>
        <Input
          inputMode="numeric"
          autoComplete="off"
          aria-label={`Minutes taken for ${taskName}`}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          disabled={disabled}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
          className="h-11 w-16 text-center tabular-nums"
        />
        <span aria-hidden className="tabular-nums">
          min, est. {estimate}
        </span>
      </div>
      {invalid ? (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {RANGE_MESSAGE}
        </p>
      ) : null}
    </div>
  );
}
