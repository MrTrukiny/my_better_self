"use client";

import { Pencil } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NOTE_MAX_LENGTH } from "@/lib/today/schemas";
import { cn } from "@/lib/utils";

const LENGTH_MESSAGE = `Keep the note to ${NOTE_MAX_LENGTH} characters or fewer.`;

/** A short note on a done task, saved when the field loses focus or on Enter. */
export function NoteField({
  taskName,
  value,
  disabled,
  onSave,
}: {
  taskName: string;
  value: string | null;
  disabled: boolean;
  onSave: (note: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const errorId = useId();
  const openRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);

  useEffect(() => {
    if (!editing && refocus.current) {
      refocus.current = false;
      openRef.current?.focus();
    }
  }, [editing]);

  const open = () => {
    setDraft(value ?? "");
    setInvalid(false);
    setEditing(true);
  };

  const close = (keepFocus: boolean) => {
    refocus.current = keepFocus;
    setEditing(false);
  };

  const commit = (keepFocus: boolean) => {
    const note = draft.trim();
    if (note.length > NOTE_MAX_LENGTH) {
      setInvalid(true);
      return;
    }
    if ((note || null) !== value) {
      onSave(note || null);
    }
    close(keepFocus);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        <Input
          autoFocus
          autoComplete="off"
          enterKeyHint="done"
          aria-label={`Note for ${taskName}`}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          placeholder="Took longer: full deep clean"
          disabled={disabled}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => commit(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(true);
            } else if (event.key === "Escape") {
              event.preventDefault();
              close(true);
            }
          }}
          className="h-11"
        />
        {invalid ? (
          <p id={errorId} role="alert" className="text-destructive text-sm">
            {LENGTH_MESSAGE}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {value === null ? null : (
        <p className="text-muted-foreground min-w-0 flex-1 text-sm break-words">{value}</p>
      )}
      <Button
        ref={openRef}
        type="button"
        variant="ghost"
        size={value === null ? "default" : "icon"}
        disabled={disabled}
        onClick={open}
        aria-label={`${value === null ? "Add" : "Edit"} note for ${taskName}`}
        className={cn(
          "shrink-0",
          value === null ? "text-muted-foreground -ml-3 h-11 px-3" : "size-11",
        )}
      >
        {value === null ? "Add note" : <Pencil aria-hidden />}
      </Button>
    </div>
  );
}
