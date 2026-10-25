import { z } from "zod";
import { ITEM_TYPE_IDS } from "./item-types";

export const NAME_MAX = 60;
export const NOTE_MAX = 200;
export const COUNT_MIN = 1;
export const COUNT_MAX = 99;

export const DUPLICATE_ROOM_NAME = "A room with this name already exists.";

const COUNT_MESSAGE = `Enter a whole number from ${COUNT_MIN} to ${COUNT_MAX}.`;

const nameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(NAME_MAX, `Use ${NAME_MAX} characters or fewer.`);

export const roomInputSchema = z.object({ name: nameSchema });

export const itemInputSchema = z.object({
  type: z.enum(ITEM_TYPE_IDS, { error: "Choose a type." }),
  name: nameSchema,
  count: z
    .string()
    .trim()
    .regex(/^\d+$/, COUNT_MESSAGE)
    .transform(Number)
    .pipe(z.number().int().min(COUNT_MIN, COUNT_MESSAGE).max(COUNT_MAX, COUNT_MESSAGE)),
  note: z
    .string()
    .trim()
    .max(NOTE_MAX, `Use ${NOTE_MAX} characters or fewer.`)
    .transform((note) => note || null),
});

export type RoomInput = z.infer<typeof roomInputSchema>;
export type ItemInput = z.infer<typeof itemInputSchema>;

export type FieldErrors<T> = Partial<Record<keyof T & string, string>>;

export type ParseResult<T> = { ok: true; data: T } | { ok: false; fieldErrors: FieldErrors<T> };

/** Validates raw form values and returns the first message per field. */
export function parseInput<S extends z.ZodType<object>>(
  schema: S,
  values: Record<string, unknown>,
): ParseResult<z.infer<S>> {
  const result = schema.safeParse(values);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0]);
    fieldErrors[field] ??= issue.message;
  }
  return { ok: false, fieldErrors: fieldErrors as FieldErrors<z.infer<S>> };
}

const ROOM_NAME_UNIQUE = "room_user_id_name_unique";

export function isDuplicateRoomNameError(error: unknown): boolean {
  for (let current = error; current; current = (current as { cause?: unknown }).cause) {
    const { code, constraint } = current as { code?: unknown; constraint?: unknown };
    if (code === "23505" && constraint === ROOM_NAME_UNIQUE) {
      return true;
    }
    if (typeof current !== "object") {
      break;
    }
  }
  return false;
}
