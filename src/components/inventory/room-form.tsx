"use client";

import { Pencil, Plus } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { createRoom, renameRoom } from "@/app/(app)/rooms/actions";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ActionState, IDLE } from "@/lib/inventory/action-state";
import { useEditsDisabled } from "./edit-guard";
import { FieldError, FormError, focusFirstInvalid, SubmitButton } from "./form-messages";

type RoomAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function RoomForm({
  action,
  onSuccess,
  submitLabel,
  defaultName = "",
}: {
  action: RoomAction;
  onSuccess: () => void;
  submitLabel: string;
  defaultName?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, IDLE);
  const editsDisabled = useEditsDisabled();
  const formRef = useRef<HTMLFormElement>(null);
  const nameId = useId();
  const nameErrorId = useId();
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (state.status === "success") {
      onSuccessRef.current();
    } else if (state.status === "error") {
      focusFirstInvalid(formRef.current);
    }
  }, [state]);

  const nameError = state.status === "error" ? state.fieldErrors?.name : undefined;
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={nameId}>Name</Label>
        <Input
          id={nameId}
          name="name"
          defaultValue={values?.name ?? defaultName}
          autoComplete="off"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? nameErrorId : undefined}
          className="h-11 text-base"
        />
        <FieldError id={nameErrorId} message={nameError} />
      </div>
      <FormError message={state.status === "error" ? state.formError : undefined} />
      <SubmitButton label={submitLabel} isPending={isPending} disabled={editsDisabled} />
    </form>
  );
}

export function AddRoomButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  const [open, setOpen] = useState(false);
  const editsDisabled = useEditsDisabled();
  return (
    <>
      <Button
        variant={variant}
        size="lg"
        className="h-11"
        onClick={() => setOpen(true)}
        disabled={editsDisabled}
      >
        <Plus aria-hidden />
        Add room
      </Button>
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Add room"
        description="A space in your home, like Kitchen or Main bedroom."
      >
        <RoomForm action={createRoom} onSuccess={() => setOpen(false)} submitLabel="Add room" />
      </ResponsiveDialog>
    </>
  );
}

export function RenameRoomButton({ room }: { room: { id: string; name: string } }) {
  const [open, setOpen] = useState(false);
  const editsDisabled = useEditsDisabled();
  return (
    <>
      <Button
        variant="outline"
        size="lg"
        className="h-11"
        onClick={() => setOpen(true)}
        disabled={editsDisabled}
      >
        <Pencil aria-hidden />
        Rename
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title="Rename room">
        <RoomForm
          action={renameRoom.bind(null, room.id)}
          onSuccess={() => setOpen(false)}
          submitLabel="Save"
          defaultName={room.name}
        />
      </ResponsiveDialog>
    </>
  );
}
