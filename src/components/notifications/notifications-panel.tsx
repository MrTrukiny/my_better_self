"use client";

import { CircleCheck } from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  startTransition,
  useActionState,
  useEffect,
  useId,
  useState,
} from "react";
import { useEditsDisabled } from "@/components/inventory/edit-guard";
import { FieldError, FormError, SubmitButton } from "@/components/inventory/form-messages";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { type ActionState, IDLE } from "@/lib/inventory/action-state";
import {
  applicationServerKey,
  currentSubscription,
  isPushSupported,
  unsubscribeDevice,
} from "@/lib/notifications/browser";
import { BEFORE_MINUTES_OPTIONS, type NotificationPrefs } from "@/lib/notifications/reminders";

type Result = Promise<{ ok: boolean }>;
type PrefsAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type Device = "checking" | "unsupported" | "off" | "blocked" | "on";

const STATUS: Record<Device, string> = {
  checking: "Checking this device…",
  unsupported:
    "This browser can't receive notifications. On iPhone or iPad, add the app to your Home Screen first (Share, then Add to Home Screen), open it from there, and turn them on here.",
  off: "Notifications are off on this device.",
  blocked:
    "Notifications are blocked for this site. Allow them in your browser's site settings, then turn them on here.",
  on: "Notifications are on for this device.",
};

const TURN_ON_FAILED = "Couldn't turn on notifications. Try again.";
const READY_TIMEOUT_MS = 10_000;

export const LEAD_LABELS: Record<string, string> = Object.fromEntries(
  BEFORE_MINUTES_OPTIONS.map((minutes) => [
    String(minutes),
    minutes === 0 ? "At the start time" : `${minutes} minutes before`,
  ]),
);

export function NotificationsPanel({
  publicKey,
  subscribed,
  prefs,
  subscribe,
  unsubscribe,
  savePrefs,
}: {
  publicKey: string;
  /** Whether the server has a subscription for this device's session. */
  subscribed: boolean;
  prefs: NotificationPrefs;
  subscribe: (subscription: unknown) => Result;
  unsubscribe: () => Result;
  savePrefs: PrefsAction;
}) {
  const [device, setDevice] = useState<Device>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editsDisabled = useEditsDisabled();
  const switchId = useId();

  // The browser is the source of truth for this device; the server copy follows it.
  useEffect(() => {
    let active = true;
    async function check() {
      if (!isPushSupported()) {
        setDevice("unsupported");
        return;
      }
      const subscription = await currentSubscription();
      if (!active) {
        return;
      }
      // Offline, an action would be held and replayed later; the next visit catches up instead.
      const canSync = navigator.onLine;
      if (subscription && Notification.permission === "granted") {
        setDevice("on");
        if (!subscribed && canSync) {
          await subscribe(subscription.toJSON());
        }
        return;
      }
      setDevice(Notification.permission === "denied" ? "blocked" : "off");
      if (subscribed && canSync) {
        await unsubscribe();
      }
    }
    void check();
    return () => {
      active = false;
    };
  }, [subscribed, subscribe, unsubscribe]);

  async function turnOn() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setDevice(permission === "denied" ? "blocked" : "off");
      return;
    }
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), READY_TIMEOUT_MS)),
    ]);
    if (!registration) {
      setError(TURN_ON_FAILED);
      return;
    }
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(publicKey),
      }));
    const result = await subscribe(subscription.toJSON());
    if (!result.ok) {
      await subscription.unsubscribe();
      setError(TURN_ON_FAILED);
      return;
    }
    setDevice("on");
  }

  async function turnOff() {
    await unsubscribeDevice();
    await unsubscribe();
    setDevice("off");
  }

  async function toggle(checked: boolean) {
    setBusy(true);
    setError(null);
    try {
      await (checked ? turnOn() : turnOff());
    } catch (cause) {
      console.error("changing notifications failed", cause);
      setError(checked ? TURN_ON_FAILED : "Couldn't turn off notifications. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const unavailable = device === "checking" || device === "unsupported";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex min-h-11 items-center justify-between gap-4">
          <Label htmlFor={switchId} className="text-base">
            Notifications on this device
          </Label>
          <Switch
            id={switchId}
            checked={device === "on"}
            onCheckedChange={(checked) => void toggle(checked)}
            disabled={busy || editsDisabled || unavailable}
          />
        </div>
        <p role="status" className="text-muted-foreground text-sm">
          {STATUS[device]}
        </p>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </div>
      {device === "on" ? <RemindersForm prefs={prefs} action={savePrefs} /> : null}
    </div>
  );
}

function RemindersForm({ prefs, action }: { prefs: NotificationPrefs; action: PrefsAction }) {
  const [state, formAction, isPending] = useActionState(action, IDLE);
  const editsDisabled = useEditsDisabled();
  const [before, setBefore] = useState(prefs.beforeEnabled);
  const [lead, setLead] = useState(String(prefs.beforeMinutes));
  const [evening, setEvening] = useState(prefs.eveningEnabled);
  const [eveningTime, setEveningTime] = useState(prefs.eveningTime);
  const id = useId();
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const timeErrorId = `${id}-time-error`;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="beforeEnabled" value={before ? "1" : "0"} />
      <input type="hidden" name="beforeMinutes" value={lead} />
      <input type="hidden" name="eveningEnabled" value={evening ? "1" : "0"} />
      <input type="hidden" name="eveningTime" value={eveningTime} />
      <fieldset className="flex flex-col gap-6" disabled={editsDisabled}>
        <legend className="sr-only">Reminders</legend>
        <ReminderSwitch
          label="Before my session"
          hint="A heads-up with today's tasks. Days off and days with nothing to clean send nothing."
          checked={before}
          onChange={setBefore}
          disabled={editsDisabled}
        >
          <Label htmlFor={`${id}-lead`}>How long before</Label>
          <Select
            value={lead}
            items={LEAD_LABELS}
            disabled={!before || editsDisabled}
            onValueChange={(value) => value && setLead(value)}
          >
            <SelectTrigger id={`${id}-lead`} className="h-11 w-full text-base sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {Object.entries(LEAD_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value} className="min-h-10 text-base">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id={`${id}-lead-error`} message={errors.beforeMinutes} />
        </ReminderSwitch>
        <ReminderSwitch
          label="Evening reminder"
          hint="Only when nothing of today's cleaning is checked yet."
          checked={evening}
          onChange={setEvening}
          disabled={editsDisabled}
        >
          <Label htmlFor={`${id}-time`}>Time</Label>
          <Input
            id={`${id}-time`}
            type="time"
            value={eveningTime}
            onChange={(event) => setEveningTime(event.currentTarget.value)}
            disabled={!evening || editsDisabled}
            className="h-11 w-36 text-base"
            aria-invalid={errors.eveningTime ? true : undefined}
            aria-describedby={errors.eveningTime ? timeErrorId : undefined}
          />
          <FieldError id={timeErrorId} message={errors.eveningTime} />
        </ReminderSwitch>
      </fieldset>
      <FormError message={state.status === "error" ? state.formError : undefined} />
      <div className="flex flex-wrap items-center gap-3">
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

function ReminderSwitch({
  label,
  hint,
  checked,
  onChange,
  disabled,
  children,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex min-h-11 items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor={id} className="text-base">
            {label}
          </Label>
          <p id={`${id}-hint`} className="text-muted-foreground text-sm">
            {hint}
          </p>
        </div>
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
          aria-describedby={`${id}-hint`}
        />
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
