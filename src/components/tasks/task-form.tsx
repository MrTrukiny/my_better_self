"use client";

import {
  type FormEvent,
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useEditsDisabled } from "@/components/inventory/edit-guard";
import {
  FieldError,
  FormError,
  focusFirstInvalid,
  SubmitButton,
} from "@/components/inventory/form-messages";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ActionState, IDLE } from "@/lib/inventory/action-state";
import { FREQUENCY_DAYS_MAX, minutesMax, TASK_NAME_MAX, type TaskKind } from "@/lib/tasks/limits";

type TaskAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;
export type TaskDefaults = { name: string; kind: TaskKind; minutes: number; frequencyDays: number };

const KIND_OPTIONS: { value: TaskKind; label: string; hint: string }[] = [
  { value: "cleaning", label: "Cleaning task", hint: "Counts against the daily cleaning time." },
  { value: "routine", label: "Routine", hint: "A habit tracked outside the cleaning time." },
];

export function TaskForm({
  action,
  onSuccess,
  defaults,
  submitLabel = "Save",
}: {
  action: TaskAction;
  onSuccess: () => void;
  defaults: TaskDefaults;
  submitLabel?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, IDLE);
  const editsDisabled = useEditsDisabled();
  const formRef = useRef<HTMLFormElement>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const [kind, setKind] = useState<TaskKind>(defaults.kind);

  const ids = {
    name: useId(),
    kind: useId(),
    minutes: useId(),
    frequency: useId(),
    nameError: useId(),
    kindError: useId(),
    minutesError: useId(),
    minutesHint: useId(),
    frequencyError: useId(),
  };

  useEffect(() => {
    if (state.status === "success") {
      onSuccessRef.current();
    } else if (state.status === "error") {
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
  const fieldA11y = (field: string, errorId: string, hintId?: string) => ({
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? errorId : hintId,
  });

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.name}>Name</Label>
        <Input
          id={ids.name}
          name="name"
          defaultValue={defaults.name}
          maxLength={TASK_NAME_MAX}
          autoComplete="off"
          className="h-11 text-base"
          {...fieldA11y("name", ids.nameError)}
        />
        <FieldError id={ids.nameError} message={errors.name} />
      </div>

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={errors.kind ? ids.kindError : undefined}
      >
        <legend className="mb-1 text-sm font-medium">Type</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {KIND_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="has-[:focus-visible]:ring-ring has-checked:bg-muted flex min-h-11 items-start gap-3 rounded-lg border px-3 py-2.5 has-[:focus-visible]:ring-2"
            >
              <input
                type="radio"
                name="kind"
                value={option.value}
                checked={kind === option.value}
                onChange={() => setKind(option.value)}
                aria-labelledby={`${ids.kind}-${option.value}`}
                aria-describedby={`${ids.kind}-${option.value}-hint`}
                className="accent-primary mt-0.5 size-5 shrink-0 outline-none"
              />
              <span className="flex flex-col">
                <span id={`${ids.kind}-${option.value}`} className="text-base">
                  {option.label}
                </span>
                <span
                  id={`${ids.kind}-${option.value}-hint`}
                  className="text-muted-foreground text-xs"
                >
                  {option.hint}
                </span>
              </span>
            </label>
          ))}
        </div>
        <FieldError id={ids.kindError} message={errors.kind} />
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.minutes}>Minutes</Label>
          <Input
            id={ids.minutes}
            name="minutes"
            type="number"
            inputMode="numeric"
            min={1}
            max={minutesMax(kind)}
            defaultValue={defaults.minutes}
            className="h-11 text-base"
            {...fieldA11y("minutes", ids.minutesError, ids.minutesHint)}
          />
          {errors.minutes ? null : (
            <p id={ids.minutesHint} className="text-muted-foreground text-xs">
              Up to {minutesMax(kind)}.
            </p>
          )}
          <FieldError id={ids.minutesError} message={errors.minutes} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.frequency}>Every how many days</Label>
          <Input
            id={ids.frequency}
            name="frequencyDays"
            type="number"
            inputMode="numeric"
            min={1}
            max={FREQUENCY_DAYS_MAX}
            defaultValue={defaults.frequencyDays}
            className="h-11 text-base"
            {...fieldA11y("frequencyDays", ids.frequencyError)}
          />
          <FieldError id={ids.frequencyError} message={errors.frequencyDays} />
        </div>
      </div>

      <FormError message={state.status === "error" ? state.formError : undefined} />
      <SubmitButton label={submitLabel} isPending={isPending} disabled={editsDisabled} />
    </form>
  );
}
