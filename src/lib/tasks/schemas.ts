import { z } from "zod";
import { HELPER_IDS } from "./helpers";

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
