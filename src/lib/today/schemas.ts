import { z } from "zod";
import { OCCURRENCE_STATUSES, type OccurrenceStatus } from "@/db/schema/schedule";
import type { TaskKind } from "@/lib/tasks/limits";

export const checkOffInputSchema = z.object({
  occurrenceId: z.string().min(1).max(64),
  status: z.enum(OCCURRENCE_STATUSES),
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
  return "apply";
}
