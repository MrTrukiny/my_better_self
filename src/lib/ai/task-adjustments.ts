import { generateText, type LanguageModel, Output } from "ai";
import { z } from "zod";
import { ADJUSTMENT_CHANGES, type AdjustmentChange } from "@/db/schema/tasks";
import { evidenceLine, type ReviewTask } from "@/lib/tasks/adjustments";
import { CLEANING_MINUTES_MAX, FREQUENCY_DAYS_MAX, TASK_NAME_MAX } from "@/lib/tasks/limits";
import { fakeAdjustmentOutput } from "./fake-adjustments";
import { describeLocale, type OwnerLocale } from "./locale";

const SUGGESTIONS_MAX = 60;
const REASON_MAX = 400;
const TIMEOUT_MS = 60_000;

export type AdjustmentInput = {
  tasks: ReviewTask[];
  /** Every task of the owner, so a new task doesn't repeat one in the same place. */
  existing: { roomId: string | null; itemId: string | null; name: string }[];
  homeNote: string | null;
  locale: OwnerLocale;
};

export type SuggestedAdjustment = {
  taskId: string;
  change: AdjustmentChange;
  name: string | null;
  minutes: number | null;
  frequencyDays: number | null;
  reason: string;
  evidence: string;
};

export type AdjustmentResult =
  | { ok: true; adjustments: SuggestedAdjustment[] }
  | { ok: false; reason: "unavailable" | "failed" };

/** What the model returns. Kept loose so one bad suggestion is dropped instead of the batch. */
export const adjustmentOutputSchema = z.object({
  suggestions: z.array(
    z.object({
      task: z.string().describe('The task reference, like "t1"'),
      change: z
        .enum(ADJUSTMENT_CHANGES)
        .describe("minutes: new estimate; frequency: repeat every N days; new_task: add a task"),
      minutes: z.number().nullable().describe("New minutes, or the new task's minutes"),
      frequencyDays: z.number().nullable().describe("New frequency, or the new task's frequency"),
      name: z.string().nullable().describe("The new task's name; null for other changes"),
      reason: z.string().describe("One or two sentences citing the times or notes"),
    }),
  ),
});

export type AdjustmentOutput = z.infer<typeof adjustmentOutputSchema>;

const INSTRUCTIONS = `You help one person keep their household cleaning plan realistic. Each task below has an estimate, a frequency, and the times it really took (newest first) and notes the owner wrote when checking it off.
Suggest changes only when the times or notes support them. Suggesting nothing is a good answer when the plan already fits.

Changes you can suggest:
- minutes: a new estimate when the times are consistently above or below it. When a few long times come from occasional deeper cleans that the notes explain, don't raise the estimate; suggest a separate deeper task instead.
- frequency: a new number of days between repeats, when the notes say the task was much dirtier or cleaner than expected, or the times show it is done more often or less often than needed.
- new_task: a new cleaning task for the same place, such as a monthly deep version, when the notes point to work the current task doesn't cover. Give it a name, minutes, and a frequency, and don't repeat a task the place already has.

Rules:
- Refer to tasks only by their reference ("t1"). Never invent references.
- At most one minutes change and one frequency change per task.
- Cleaning tasks take 1 to ${CLEANING_MINUTES_MAX} minutes; split a bigger job into several new tasks. Frequencies are whole days from 1 to ${FREQUENCY_DAYS_MAX}.
- The reason is one or two sentences that cite the times or notes it comes from ("Your last 5 times were 14 to 22 minutes."). Write it, and any new task name, in the same language as the task names and the notes, in the regional variant of the owner's locale, with everyday words.
- Keep new task names under ${TASK_NAME_MAX} characters, phrased like the existing ones.`;

function placeLabel(task: ReviewTask): string {
  if (task.itemName && task.roomName) {
    return `${task.roomName} / ${task.itemName}`;
  }
  return task.roomName ?? "Whole home";
}

/** Builds the prompt and the reference map from "t1" back to the reviewed tasks. */
export function buildAdjustmentRequest(input: AdjustmentInput) {
  const refs = new Map<string, ReviewTask>();
  const lines = input.tasks.flatMap((task, index) => {
    const ref = `t${index + 1}`;
    refs.set(ref, task);
    const times = task.history.times.map((t) => `${t.date} ${t.minutes} min`).join(", ");
    const others = input.existing
      .filter((t) => t.roomId === task.roomId && t.itemId === task.itemId && t.name !== task.name)
      .map((t) => `"${t.name}"`);
    return [
      `${ref} "${task.name}" (${placeLabel(task)}): estimate ${task.minutes} min, every ${task.frequencyDays} days`,
      `  Times: ${times || "none recorded"}`,
      ...task.history.notes.map((n) => `  Note on ${n.date}: ${n.note}`),
      ...(others.length ? [`  Other tasks here: ${others.join(", ")}`] : []),
    ];
  });
  const prompt = [
    "Tasks:",
    ...lines,
    "",
    `Home note: ${input.homeNote ?? "None"}`,
    `Owner's locale: ${describeLocale(input.locale)}`,
  ].join("\n");
  return { prompt, refs };
}

function isWholeInRange(value: number | null, max: number): value is number {
  return value !== null && Number.isInteger(value) && value >= 1 && value <= max;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function placeKey(place: { roomId: string | null; itemId: string | null }, name: string): string {
  return `${place.roomId ?? ""}|${place.itemId ?? ""}|${normalizeName(name)}`;
}

/** Resolves references and drops anything invalid, unchanged, repeated, or already planned. */
export function toAdjustments(
  output: AdjustmentOutput,
  refs: Map<string, ReviewTask>,
  existing: AdjustmentInput["existing"],
): SuggestedAdjustment[] {
  const seen = new Set(existing.map((t) => placeKey(t, t.name)));
  const adjustments: SuggestedAdjustment[] = [];
  for (const suggestion of output.suggestions) {
    const task = refs.get(suggestion.task.trim());
    const reason = suggestion.reason.trim();
    if (!task || !reason || reason.length > REASON_MAX) {
      continue;
    }
    const base = { taskId: task.id, change: suggestion.change, reason };
    let values: Pick<SuggestedAdjustment, "name" | "minutes" | "frequencyDays"> | null = null;
    let key: string;
    if (suggestion.change === "minutes") {
      key = `${task.id}|minutes`;
      if (isWholeInRange(suggestion.minutes, CLEANING_MINUTES_MAX)) {
        if (suggestion.minutes !== task.minutes) {
          values = { name: null, minutes: suggestion.minutes, frequencyDays: null };
        }
      }
    } else if (suggestion.change === "frequency") {
      key = `${task.id}|frequency`;
      if (isWholeInRange(suggestion.frequencyDays, FREQUENCY_DAYS_MAX)) {
        if (suggestion.frequencyDays !== task.frequencyDays) {
          values = { name: null, minutes: null, frequencyDays: suggestion.frequencyDays };
        }
      }
    } else {
      const name = suggestion.name?.trim() ?? "";
      key = placeKey(task, name);
      if (
        name &&
        name.length <= TASK_NAME_MAX &&
        isWholeInRange(suggestion.minutes, CLEANING_MINUTES_MAX) &&
        isWholeInRange(suggestion.frequencyDays, FREQUENCY_DAYS_MAX)
      ) {
        values = { name, minutes: suggestion.minutes, frequencyDays: suggestion.frequencyDays };
      }
    }
    if (!values || seen.has(key)) {
      continue;
    }
    seen.add(key);
    adjustments.push({ ...base, ...values, evidence: evidenceLine(task.history) });
    if (adjustments.length >= SUGGESTIONS_MAX) {
      break;
    }
  }
  return adjustments;
}

/**
 * Asks the model to review tasks against their times and notes. Pass `fake: true` (tests and
 * CI) for deterministic suggestions instead of a live call. Never throws.
 */
export async function suggestAdjustments(
  input: AdjustmentInput,
  options: { model?: LanguageModel | null; fake?: boolean },
): Promise<AdjustmentResult> {
  const { prompt, refs } = buildAdjustmentRequest(input);
  try {
    let output: AdjustmentOutput;
    if (options.fake) {
      output = fakeAdjustmentOutput(input);
    } else if (options.model) {
      const result = await generateText({
        model: options.model,
        system: INSTRUCTIONS,
        prompt,
        output: Output.object({ name: "TaskAdjustments", schema: adjustmentOutputSchema }),
        providerOptions: { google: { thinkingConfig: { thinkingLevel: "low" } } },
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      });
      output = result.output;
    } else {
      return { ok: false, reason: "unavailable" };
    }
    return { ok: true, adjustments: toAdjustments(output, refs, input.existing) };
  } catch (error) {
    console.error("suggestAdjustments failed", error);
    return { ok: false, reason: "failed" };
  }
}
