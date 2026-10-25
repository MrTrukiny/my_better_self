"use client";

import { CircleCheck, Pencil, Plus } from "lucide-react";
import {
  type FormEvent,
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createItem, updateItem } from "@/app/(app)/rooms/actions";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type ActionState, IDLE } from "@/lib/inventory/action-state";
import { getItemType, ITEM_TYPES } from "@/lib/inventory/item-types";
import type { InventoryItem } from "@/lib/inventory/queries";
import { NOTE_MAX } from "@/lib/inventory/schemas";
import { CountStepper } from "./count-stepper";
import { useEditsDisabled } from "./edit-guard";
import { FieldError, FormError, focusFirstInvalid, SubmitButton } from "./form-messages";

type ItemAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;
type ItemDefaults = Omit<InventoryItem, "id">;

const TYPE_LABELS = Object.fromEntries(ITEM_TYPES.map((type) => [type.id, type.label]));

export function itemLabel(item: { name: string; count: number }): string {
  return item.count > 1 ? `${item.name} x${item.count}` : item.name;
}

export function ItemForm({
  action,
  onSuccess,
  submitLabel,
  defaults,
  focusTypeOnMount = false,
}: {
  action: ItemAction;
  onSuccess: (submitted: { name: string; count: number }) => void;
  submitLabel: string;
  defaults?: ItemDefaults;
  focusTypeOnMount?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, IDLE);
  const editsDisabled = useEditsDisabled();
  const formRef = useRef<HTMLFormElement>(null);
  const typeRef = useRef<HTMLButtonElement>(null);
  const submitted = useRef({ name: "", count: 1 });
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const [type, setType] = useState<string | null>(defaults?.type ?? null);
  const [name, setName] = useState(defaults?.name ?? "");
  const [nameEdited, setNameEdited] = useState(Boolean(defaults));

  const ids = {
    type: useId(),
    name: useId(),
    count: useId(),
    note: useId(),
    typeError: useId(),
    nameError: useId(),
    countError: useId(),
    noteError: useId(),
  };

  useEffect(() => {
    if (focusTypeOnMount) {
      typeRef.current?.focus();
    }
  }, [focusTypeOnMount]);

  useEffect(() => {
    if (state.status === "success") {
      onSuccessRef.current(submitted.current);
    } else if (state.status === "error") {
      focusFirstInvalid(formRef.current);
    }
  }, [state]);

  function onTypeChange(next: string | null) {
    setType(next);
    if (!nameEdited) {
      setName(next ? (getItemType(next)?.label ?? "") : "");
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // Submit manually so React doesn't reset the form: the entered values must survive errors.
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    submitted.current = {
      name: String(formData.get("name") ?? "").trim(),
      count: Number(formData.get("count")) || 1,
    };
    startTransition(() => formAction(formData));
  }

  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const fieldA11y = (field: keyof typeof errors & string, errorId: string) => ({
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? errorId : undefined,
  });

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.type}>Type</Label>
        <Select name="type" value={type} onValueChange={onTypeChange} items={TYPE_LABELS}>
          <SelectTrigger
            id={ids.type}
            ref={typeRef}
            className="h-11 w-full text-base"
            {...fieldA11y("type", ids.typeError)}
          >
            <SelectValue placeholder="Choose a type" />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {ITEM_TYPES.map(({ id, label, icon: Icon }) => (
              <SelectItem key={id} value={id} className="min-h-10 text-base">
                <Icon aria-hidden />
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError id={ids.typeError} message={errors.type} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.name}>Name</Label>
        <Input
          id={ids.name}
          name="name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setNameEdited(true);
          }}
          autoComplete="off"
          className="h-11 text-base"
          {...fieldA11y("name", ids.nameError)}
        />
        <FieldError id={ids.nameError} message={errors.name} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.count}>Count</Label>
        <CountStepper
          id={ids.count}
          name="count"
          defaultValue={String(defaults?.count ?? 1)}
          {...fieldA11y("count", ids.countError)}
        />
        <FieldError id={ids.countError} message={errors.count} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.note}>
          Note <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id={ids.note}
          name="note"
          defaultValue={defaults?.note ?? ""}
          rows={2}
          className="text-base"
          {...fieldA11y("note", ids.noteError)}
        />
        <p className="text-muted-foreground text-xs">Up to {NOTE_MAX} characters.</p>
        <FieldError id={ids.noteError} message={errors.note} />
      </div>

      <FormError message={state.status === "error" ? state.formError : undefined} />
      <SubmitButton label={submitLabel} isPending={isPending} disabled={editsDisabled} />
    </form>
  );
}

export function AddItemButton({ roomId }: { roomId: string }) {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<string>();
  const [round, setRound] = useState(0);
  const editsDisabled = useEditsDisabled();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setAdded(undefined);
    }
  }

  return (
    <>
      <Button size="lg" className="h-11" onClick={() => setOpen(true)} disabled={editsDisabled}>
        <Plus aria-hidden />
        Add item
      </Button>
      <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Add item">
        {added ? (
          <div className="flex flex-col gap-4">
            <p role="status" className="flex items-center gap-2 text-sm">
              <CircleCheck aria-hidden className="size-4 text-emerald-600 dark:text-emerald-400" />
              Added {added}.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button
                size="lg"
                className="h-11"
                autoFocus
                onClick={() => {
                  setAdded(undefined);
                  setRound((value) => value + 1);
                }}
              >
                Add another
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-11"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <ItemForm
            key={round}
            action={createItem.bind(null, roomId)}
            onSuccess={(item) => setAdded(itemLabel(item))}
            submitLabel="Add item"
            focusTypeOnMount={round > 0}
          />
        )}
      </ResponsiveDialog>
    </>
  );
}

export function EditItemButton({ item }: { item: InventoryItem }) {
  const [open, setOpen] = useState(false);
  const editsDisabled = useEditsDisabled();
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground size-11"
        aria-label={`Edit ${item.name}`}
        onClick={() => setOpen(true)}
        disabled={editsDisabled}
      >
        <Pencil aria-hidden />
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title="Edit item">
        <ItemForm
          action={updateItem.bind(null, item.id)}
          onSuccess={() => setOpen(false)}
          submitLabel="Save"
          defaults={item}
        />
      </ResponsiveDialog>
    </>
  );
}
