import { z } from "zod";
import { HELPER_IDS } from "./helpers";
import { FREQUENCY_DAYS_MAX, minutesMax, TASK_KINDS, TASK_NAME_MAX } from "./limits";

export const HOME_NOTE_MAX = 500;

export const homeProfileInputSchema = z.object({
  helpers: z
    .array(z.enum(HELPER_IDS, { error: "Choose helpers from the list." }))
    .transform((helpers) => [...new Set(helpers)]),
  note: z
    .string()
    .trim()
    .max(HOME_NOTE_MAX, `Use ${HOME_NOTE_MAX} characters or fewer.`)
    .transform((note) => note || null),
});

export type HomeProfileInput = z.infer<typeof homeProfileInputSchema>;

function wholeNumberUpTo(max: number) {
  const message = `Enter a whole number from 1 to ${max}.`;
  return z
    .string()
    .trim()
    .regex(/^\d+$/, message)
    .transform(Number)
    .pipe(z.number().int().min(1, message).max(max, message));
}

/** Editing a task or a pending proposal. The minutes cap depends on the kind. */
export const taskInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Enter a name.")
      .max(TASK_NAME_MAX, `Use ${TASK_NAME_MAX} characters or fewer.`),
    kind: z.enum(TASK_KINDS, { error: "Choose cleaning task or routine." }),
    minutes: z.string(),
    frequencyDays: wholeNumberUpTo(FREQUENCY_DAYS_MAX),
  })
  .transform((input, ctx) => {
    const minutes = wholeNumberUpTo(minutesMax(input.kind)).safeParse(input.minutes);
    if (!minutes.success) {
      ctx.addIssue({
        code: "custom",
        path: ["minutes"],
        message: minutes.error.issues[0]?.message,
      });
      return z.NEVER;
    }
    return { ...input, minutes: minutes.data };
  });

export type TaskInput = z.infer<typeof taskInputSchema>;
