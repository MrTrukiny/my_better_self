import { z } from "zod";
import { parseTime } from "@/lib/scheduler/dates";
import { BEFORE_MINUTES_OPTIONS } from "./reminders";

const flag = z.enum(["0", "1"]).transform((value) => value === "1");

const PREF_FIELDS = ["beforeEnabled", "beforeMinutes", "eveningEnabled", "eveningTime"] as const;

/** Flat form values; the switches post "1" or "0" through hidden inputs. */
export function prefsFormValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(PREF_FIELDS.map((field) => [field, String(formData.get(field) ?? "")]));
}

export const notificationPrefsSchema = z.object({
  beforeEnabled: flag,
  beforeMinutes: z
    .string()
    .transform(Number)
    .refine(
      (minutes) => (BEFORE_MINUTES_OPTIONS as readonly number[]).includes(minutes),
      "Choose how long before your session.",
    ),
  eveningEnabled: flag,
  eveningTime: z
    .string()
    .trim()
    .refine((time) => parseTime(time) !== null, "Enter a time, like 20:00."),
});

/** `PushSubscription.toJSON()`; push services are always reached over HTTPS. */
export const subscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(2048),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256) }),
});
