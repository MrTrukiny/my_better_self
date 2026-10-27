import { z } from "zod";
import { OCCURRENCE_STATUSES, type OccurrenceStatus } from "@/db/schema/schedule";
import type { TaskKind } from "@/lib/tasks/limits";

/** Bounds of the minutes a done task took; the database checks them too. */
export const ACTUAL_MINUTES = { min: 1, max: 240 } as const;

export const checkOffInputSchema = z.object({
  occurrenceId: z.string().min(1).max(64),
  status: z.enum(OCCURRENCE_STATUSES),
  /** A number sets the minutes, null clears them, and leaving it out keeps them. */
  actualMinutes: z.number().int().min(ACTUAL_MINUTES.min).max(ACTUAL_MINUTES.max).nullish(),
});

export type CheckOffInput = z.infer<typeof checkOffInputSchema>;

/**
 * `gone`: the occurrence no longer exists (the plan changed). `past`: it isn't today's anymore.
 * Both are final, so a queued change is dropped. `failed` is worth retrying.
 */
export type CheckOffResult = "ok" | "gone" | "past" | "invalid" | "failed";

/** Whether a change may be applied to the occurrence as stored, or why not. */
export function checkOffDecision(
  stored: { date: string; kind: TaskKind } | null,
  today: string,
  status: OccurrenceStatus,
  actualMinutes?: number | null,
): "apply" | Exclude<CheckOffResult, "ok" | "failed"> {
  if (!stored) {
    return "gone";
  }
  if (stored.date !== today) {
    return "past";
  }
  if (status === "skipped" && stored.kind !== "cleaning") {
    return "invalid";
  }
  if (typeof actualMinutes === "number" && (status !== "done" || stored.kind !== "cleaning")) {
    return "invalid";
  }
  return "apply";
}

/** The minutes to write with a status: only a done task keeps or gets them. */
export function actualMinutesUpdate(
  status: OccurrenceStatus,
  actualMinutes: number | null | undefined,
): { actualMinutes?: number | null } {
  if (status !== "done") {
    return { actualMinutes: null };
  }
  return actualMinutes === undefined ? {} : { actualMinutes };
}
