"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { invitePerson } from "@/app/(app)/household/actions";
import { useEditsDisabled } from "@/components/inventory/edit-guard";
import {
  FieldError,
  FormError,
  focusFirstInvalid,
  SubmitButton,
} from "@/components/inventory/form-messages";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HOUSEHOLD_MAX_PEOPLE } from "@/lib/household/rules";
import { type ActionState, IDLE } from "@/lib/inventory/action-state";

type InviteAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function InviteForm({
  action = invitePerson,
  full,
}: {
  action?: InviteAction;
  /** The household already has the most people it can have. */
  full: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, IDLE);
  const editsDisabled = useEditsDisabled();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const submitted = useRef("");
  const [invited, setInvited] = useState<string | null>(null);
  const emailId = useId();
  const hintId = useId();
  const errorId = useId();

  useEffect(() => {
    if (state.status === "success") {
      setInvited(submitted.current.trim());
      inputRef.current?.focus();
    } else if (state.status === "error") {
      setInvited(null);
      focusFirstInvalid(formRef.current);
    }
  }, [state]);

  const emailError = state.status === "error" ? state.fieldErrors?.email : undefined;
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={() => {
        submitted.current = inputRef.current?.value ?? "";
      }}
      noValidate
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={emailId}>Invite by email</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            ref={inputRef}
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
            defaultValue={values?.email ?? ""}
            disabled={full}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={[emailError ? errorId : null, hintId].filter(Boolean).join(" ")}
            className="h-11 text-base sm:flex-1"
          />
          <SubmitButton label="Invite" isPending={isPending} disabled={editsDisabled || full} />
        </div>
        <FieldError id={errorId} message={emailError} />
        <p id={hintId} className="text-muted-foreground text-sm">
          {full
            ? `A household has at most ${HOUSEHOLD_MAX_PEOPLE} people.`
            : "No email is sent. Tell them to sign in with Google using this address."}
        </p>
      </div>
      <FormError message={state.status === "error" ? state.formError : undefined} />
      <p role="status" className="text-sm empty:hidden">
        {invited ? `Invited ${invited}.` : ""}
      </p>
    </form>
  );
}
