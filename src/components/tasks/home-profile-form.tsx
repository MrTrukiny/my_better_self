"use client";

import { CircleCheck } from "lucide-react";
import { type FormEvent, startTransition, useActionState, useEffect, useId, useRef } from "react";
import { useEditsDisabled } from "@/components/inventory/edit-guard";
import {
  FieldError,
  FormError,
  focusFirstInvalid,
  SubmitButton,
} from "@/components/inventory/form-messages";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type ActionState, IDLE } from "@/lib/inventory/action-state";
import { HELPERS } from "@/lib/tasks/helpers";
import type { HomeProfile } from "@/lib/tasks/queries";
import { HOME_NOTE_MAX } from "@/lib/tasks/schemas";

type ProfileAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function HomeProfileForm({
  action,
  profile,
}: {
  action: ProfileAction;
  profile: HomeProfile;
}) {
  const [state, formAction, isPending] = useActionState(action, IDLE);
  const editsDisabled = useEditsDisabled();
  const formRef = useRef<HTMLFormElement>(null);
  const noteId = useId();
  const noteErrorId = useId();
  const noteHintId = useId();
  const helpersErrorId = useId();

  useEffect(() => {
    if (state.status === "error") {
      focusFirstInvalid(formRef.current);
    }
  }, [state]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // Submit manually so React doesn't reset the form: the entered values must survive errors.
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const helpers = new Set<string>(profile.helpers);

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3" disabled={editsDisabled}>
        <legend className="mb-1 text-sm font-medium">Helpers</legend>
        <p className="text-muted-foreground -mt-1 text-sm">
          Devices that already do part of the cleaning.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {HELPERS.map((helper) => (
            <label
              key={helper.id}
              className="has-[:focus-visible]:ring-ring has-checked:bg-muted flex min-h-11 items-center gap-3 rounded-lg border px-3 text-base has-[:focus-visible]:ring-2"
            >
              <input
                type="checkbox"
                name="helpers"
                value={helper.id}
                defaultChecked={helpers.has(helper.id)}
                className="accent-primary size-5 outline-none"
              />
              {helper.label}
            </label>
          ))}
        </div>
        <FieldError id={helpersErrorId} message={errors.helpers} />
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor={noteId}>
          Note <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id={noteId}
          name="note"
          defaultValue={profile.note ?? ""}
          rows={4}
          disabled={editsDisabled}
          className="text-base"
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={errors.note ? noteErrorId : noteHintId}
        />
        {errors.note ? null : (
          <p id={noteHintId} className="text-muted-foreground text-xs">
            Anything that changes how you clean, like pets or a wood floor. Up to {HOME_NOTE_MAX}{" "}
            characters.
          </p>
        )}
        <FieldError id={noteErrorId} message={errors.note} />
      </div>

      <FormError message={state.status === "error" ? state.formError : undefined} />
      <div className="flex items-center gap-3">
        <SubmitButton label="Save" isPending={isPending} disabled={editsDisabled} />
        {state.status === "success" && !isPending ? (
          <p role="status" className="flex items-center gap-2 text-sm">
            <CircleCheck aria-hidden className="size-4 text-emerald-600 dark:text-emerald-400" />
            Saved.
          </p>
        ) : null}
      </div>
    </form>
  );
}
