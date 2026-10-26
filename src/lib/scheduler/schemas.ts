import { z } from "zod";
import { isValidTimeZone, parseTime } from "./dates";
import { BUDGET_MAX, BUDGET_MIN, WEEKDAYS } from "./settings";

const BUDGET_MESSAGE = `Enter whole minutes from ${BUDGET_MIN} to ${BUDGET_MAX}.`;

const budget = z
  .string()
  .trim()
  .regex(/^\d+$/, BUDGET_MESSAGE)
  .transform(Number)
  .pipe(z.number().int().min(BUDGET_MIN, BUDGET_MESSAGE).max(BUDGET_MAX, BUDGET_MESSAGE));

/** Flat form values: `on0`..`on6` ("on" when checked), `start0`..`start6`, budgets, time zone. */
export function scheduleFormValues(formData: FormData): Record<string, string> {
  const fields = [
    ...WEEKDAYS.flatMap((_, day) => [`on${day}`, `start${day}`]),
    "weekdayMinutes",
    "weekendMinutes",
    "timeZone",
  ];
  return Object.fromEntries(fields.map((field) => [field, String(formData.get(field) ?? "")]));
}

/** Settings form, Monday first. Times of days that are off are dropped, not validated. */
export const scheduleInputSchema = z
  .looseObject({
    weekdayMinutes: budget,
    weekendMinutes: budget,
    timeZone: z
      .string()
      .refine(isValidTimeZone, "Couldn't read your device's time zone. Reload and try again."),
  })
  .transform((input, ctx) => {
    const values = input as Record<string, unknown>;
    const startTimes = WEEKDAYS.map((_, day) => {
      if (values[`on${day}`] !== "on") {
        return null;
      }
      const start = String(values[`start${day}`] ?? "").trim();
      if (parseTime(start) === null) {
        ctx.addIssue({
          code: "custom",
          path: [`start${day}`],
          message: "Enter a time like 06:30.",
        });
      }
      return start;
    });
    if (startTimes.every((time) => time === null)) {
      ctx.addIssue({ code: "custom", path: ["days"], message: "Turn on at least one day." });
    }
    return {
      startTimes,
      weekdayMinutes: input.weekdayMinutes,
      weekendMinutes: input.weekendMinutes,
      timeZone: input.timeZone,
    };
  });

export type ScheduleInput = z.infer<typeof scheduleInputSchema>;
