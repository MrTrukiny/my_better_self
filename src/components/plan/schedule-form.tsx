"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";
import {
  type FormEvent,
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
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
import {
  BUDGET_MAX,
  BUDGET_MIN,
  DEFAULT_START_TIME,
  type ScheduleSettings,
  WEEKDAYS,
} from "@/lib/scheduler/settings";

type ScheduleAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const noSubscription = () => () => {};
const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const noTimeZone = () => null;

export function ScheduleForm({
  action,
  settings,
}: {
  action: ScheduleAction;
  settings: Omit<ScheduleSettings, "timeZone">;
}) {
  const [state, formAction, isPending] = useActionState(action, IDLE);
  const editsDisabled = useEditsDisabled();
  const formRef = useRef<HTMLFormElement>(null);
  const [on, setOn] = useState(() => settings.startTimes.map((time) => time !== null));
  const timeZone = useSyncExternalStore(noSubscription, deviceTimeZone, noTimeZone);
  const idPrefix = useId();
  const daysErrorId = `${idPrefix}-days-error`;

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
  const formError = state.status === "error" ? (state.formError ?? errors.timeZone) : undefined;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="timeZone" value={timeZone ?? ""} />

      <fieldset className="flex flex-col gap-2" disabled={editsDisabled}>
        <legend className="mb-1 text-sm font-medium">Cleaning days</legend>
        <p className="text-muted-foreground -mt-1 text-sm">
          Turn on the days you clean and when each session starts.
          {timeZone ? ` Times are in ${timeZone}.` : null}
        </p>
        <ul className="flex flex-col gap-2">
          {WEEKDAYS.map((weekday, day) => {
            const startError = errors[`start${day}`];
            const startErrorId = `${idPrefix}-start${day}-error`;
            return (
              <li key={weekday} className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <label className="has-[:focus-visible]:ring-ring has-checked:bg-muted flex min-h-11 flex-1 items-center gap-3 rounded-lg border px-3 text-base has-[:focus-visible]:ring-2">
                    <input
                      type="checkbox"
                      name={`on${day}`}
                      checked={on[day]}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setOn((current) =>
                          current.map((value, i) => (i === day ? checked : value)),
                        );
                      }}
                      aria-invalid={errors.days ? true : undefined}
                      aria-describedby={errors.days ? daysErrorId : undefined}
                      className="accent-primary size-5 outline-none"
                    />
                    {weekday}
                  </label>
                  <Input
                    type="time"
                    name={`start${day}`}
                    aria-label={`${weekday} start time`}
                    defaultValue={settings.startTimes[day] ?? DEFAULT_START_TIME}
                    disabled={!on[day] || editsDisabled}
                    required
                    className="h-11 w-32 text-base"
                    aria-invalid={startError ? true : undefined}
                    aria-describedby={startError ? startErrorId : undefined}
                  />
                </div>
                <FieldError id={startErrorId} message={startError} />
              </li>
            );
          })}
        </ul>
        <FieldError id={daysErrorId} message={errors.days} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <BudgetField
          name="weekdayMinutes"
          label="Weekday minutes"
          hint="Monday to Friday."
          defaultValue={settings.weekdayMinutes}
          error={errors.weekdayMinutes}
          disabled={editsDisabled}
        />
        <BudgetField
          name="weekendMinutes"
          label="Weekend minutes"
          hint="Saturday and Sunday."
          defaultValue={settings.weekendMinutes}
          error={errors.weekendMinutes}
          disabled={editsDisabled}
        />
      </div>

      <FormError message={formError} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton label="Save" isPending={isPending} disabled={editsDisabled || !timeZone} />
        {state.status === "success" && !isPending ? (
          <p role="status" className="flex items-center gap-2 text-sm">
            <CircleCheck aria-hidden className="size-4 text-emerald-600 dark:text-emerald-400" />
            Saved.
            <Link href="/plan" className="font-medium underline underline-offset-4">
              See your week
            </Link>
          </p>
        ) : null}
      </div>
    </form>
  );
}

function BudgetField({
  name,
  label,
  hint,
  defaultValue,
  error,
  disabled,
}: {
  name: string;
  label: string;
  hint: string;
  defaultValue: number;
  error?: string;
  disabled: boolean;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type="number"
        inputMode="numeric"
        min={BUDGET_MIN}
        max={BUDGET_MAX}
        step={5}
        defaultValue={defaultValue}
        disabled={disabled}
        className="h-11 text-base"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hintId}
      />
      {error ? null : (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint} From {BUDGET_MIN} to {BUDGET_MAX}.
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}
