import { generateText, type LanguageModel, Output } from "ai";
import { z } from "zod";
import { DAILY_CLEANING_MINUTES } from "@/lib/app-config";
import { getItemType, ITEM_TYPE_IDS, type ItemTypeId } from "@/lib/inventory/item-types";
import { CLEANING_GUIDE } from "@/lib/tasks/cleaning-guide";
import { getHelper, type HelperId } from "@/lib/tasks/helpers";
import { fakeProposalOutput } from "./fake-proposals";

export const TASK_KINDS = ["cleaning", "routine"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const CLEANING_MINUTES_MAX = 30;
export const ROUTINE_MINUTES_MAX = 120;
export const FREQUENCY_DAYS_MAX = 365;
export const TASK_NAME_MAX = 80;
const PROPOSALS_MAX = 150;
const TIMEOUT_MS = 60_000;

export type ProposalInput = {
  rooms: {
    id: string;
    name: string;
    items: { id: string; type: string; name: string; count: number; note: string | null }[];
  }[];
  profile: { helpers: HelperId[]; note: string | null };
  existing: { roomId: string | null; itemId: string | null; name: string }[];
  /** Propose for one room, or for the whole home when null. */
  scopeRoomId: string | null;
};

export type ProposedTask = {
  roomId: string | null;
  itemId: string | null;
  kind: TaskKind;
  name: string;
  minutes: number;
  frequencyDays: number;
};

export type ProposalResult =
  | { ok: true; proposals: ProposedTask[] }
  | { ok: false; reason: "unavailable" | "failed" };

type Target = { roomId: string | null; itemId: string | null };

/** What the model returns. Kept loose so one bad task is dropped instead of failing the batch. */
export const proposalOutputSchema = z.object({
  tasks: z.array(
    z.object({
      target: z
        .string()
        .describe('"home" for the whole home, a room reference like "r1", or an item like "r1.i2"'),
      kind: z
        .enum(TASK_KINDS)
        .describe("cleaning counts against the daily budget; routine doesn't"),
      name: z.string().describe("Short imperative task name"),
      minutes: z.number().describe("Estimated minutes for one occurrence"),
      frequencyDays: z.number().describe("Repeat every N days"),
    }),
  ),
});

export type ProposalOutput = z.infer<typeof proposalOutputSchema>;

const INSTRUCTIONS = `You plan household cleaning for one person who cleans in one session of about ${DAILY_CLEANING_MINUTES} minutes per day.
Propose tasks for the home described below:
- Item tasks: every item in the list gets at least one cleaning task. Follow the cleaning guide for its type: when the guide names a light and a deep clean, propose both as separate tasks with their own frequencies.
- Room tasks: a quick pass and a deep pass for the work that belongs to no listed item (floors, baseboards, switches, general surfaces), unless a helper already covers it. Follow the helpers on this.
- Routines: frequent upkeep that isn't cleaning, such as making a bed, laundry, taking out the trash, watering plants, or scooping a litter box. When the chore belongs to a listed item, target that item; otherwise, and only when proposing for the whole home, target "home". Never propose the same chore for both "home" and an item. When proposing for the whole home, include taking out the trash.
- Never propose washing the dishes: they're washed right after each use.
- Items used only occasionally (for example a guest bed, as its note says) get no use-based chores such as making the bed or changing the sheets, only their periodic cleaning.

Rules:
- Every task targets "home", a room reference, or an item reference from the list. Never invent references.
- One task covers exactly one item. Never combine several items in one task, and never name another item in a task's name; give each item its own task even when they sit together.
- Follow the frequencies in the cleaning guide unless an item note says otherwise.
- "cleaning" tasks take 1 to ${CLEANING_MINUTES_MAX} minutes. Split bigger jobs into several tasks (for example "first half" and "second half").
- "routine" tasks are daily or frequent chores tracked outside the cleaning budget, 1 to ${ROUTINE_MINUTES_MAX} minutes.
- frequencyDays is a whole number from 1 to ${FREQUENCY_DAYS_MAX}.
- Scale minutes with the item count, and use the notes.
- Respect the helpers: don't propose work a helper already does, only what it leaves behind.
- Don't repeat or rephrase the tasks that are already planned.
- Write task names in the same language as the room and item names, phrased the way a native speaker would say them at home, with everyday verbs, not translated word for word. Don't repeat the item's type when its name already says it ("Clean the main bathroom mirror", not "Clean mirror of Main Bathroom Mirror"). Keep them under ${TASK_NAME_MAX} characters.`;

/** Builds the prompt and the reference map that turns model targets back into ids. */
export function buildProposalRequest(input: ProposalInput) {
  const refs = new Map<string, Target>();
  const keyOf = new Map<string, string>();
  const forHome = input.scopeRoomId === null;
  if (forHome) {
    refs.set("home", { roomId: null, itemId: null });
  }

  const rooms = forHome ? input.rooms : input.rooms.filter((r) => r.id === input.scopeRoomId);
  const typesInHome = new Set<ItemTypeId>();
  const roomLines = rooms.flatMap((room, roomIndex) => {
    const roomRef = `r${roomIndex + 1}`;
    refs.set(roomRef, { roomId: room.id, itemId: null });
    keyOf.set(`${room.id}|`, roomRef);
    const itemLines = room.items.map((item, itemIndex) => {
      const itemRef = `${roomRef}.i${itemIndex + 1}`;
      refs.set(itemRef, { roomId: room.id, itemId: item.id });
      keyOf.set(`${room.id}|${item.id}`, itemRef);
      const typeId = getItemType(item.type)?.id ?? "other";
      typesInHome.add(typeId);
      const note = item.note ? ` (note: ${item.note})` : "";
      return `  ${itemRef} ${typeId} "${item.name}" x${item.count}${note}`;
    });
    return [`${roomRef} "${room.name}"`, ...(itemLines.length ? itemLines : ["  (no items)"])];
  });

  const helperLines = input.profile.helpers.map((id) => {
    const helper = getHelper(id);
    return helper ? `- ${helper.label}: ${helper.guidance}` : null;
  });
  const existingLines = input.existing.flatMap((task) => {
    const ref = task.roomId ? keyOf.get(`${task.roomId}|${task.itemId ?? ""}`) : "home";
    return ref && refs.has(ref) ? [`- ${ref}: "${task.name}"`] : [];
  });

  const prompt = [
    forHome ? "Scope: the whole home." : "Scope: one room only. Don't propose home-wide routines.",
    "",
    "Rooms and items:",
    ...roomLines,
    "",
    "Cleaning guide by item type:",
    ...ITEM_TYPE_IDS.filter((id) => typesInHome.has(id)).map(
      (id) => `- ${id}: ${CLEANING_GUIDE[id]}`,
    ),
    "",
    "Helpers:",
    ...(helperLines.filter(Boolean).length ? helperLines.filter(Boolean) : ["- None"]),
    "",
    `Home note: ${input.profile.note ?? "None"}`,
    "",
    "Already planned (don't repeat):",
    ...(existingLines.length ? existingLines : ["- Nothing yet"]),
  ].join("\n");

  return { prompt, refs };
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function dedupeKey(task: Target & { name: string }): string {
  return `${task.roomId ?? ""}|${task.itemId ?? ""}|${normalizeName(task.name)}`;
}

function isWholeInRange(value: number, max: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= max;
}

/** Resolves references and drops anything out of range or already planned. */
export function toProposals(
  output: ProposalOutput,
  refs: Map<string, Target>,
  existing: ProposalInput["existing"],
): ProposedTask[] {
  const seen = new Set(existing.map(dedupeKey));
  const proposals: ProposedTask[] = [];
  for (const task of output.tasks) {
    const target = refs.get(task.target.trim());
    const name = task.name.trim();
    const minutesMax = task.kind === "cleaning" ? CLEANING_MINUTES_MAX : ROUTINE_MINUTES_MAX;
    if (
      !target ||
      !name ||
      name.length > TASK_NAME_MAX ||
      !isWholeInRange(task.minutes, minutesMax) ||
      !isWholeInRange(task.frequencyDays, FREQUENCY_DAYS_MAX)
    ) {
      continue;
    }
    const proposal = {
      ...target,
      kind: task.kind,
      name,
      minutes: task.minutes,
      frequencyDays: task.frequencyDays,
    };
    const key = dedupeKey(proposal);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    proposals.push(proposal);
    if (proposals.length >= PROPOSALS_MAX) {
      break;
    }
  }
  return proposals;
}

/**
 * Asks the model for task proposals. Pass `fake: true` (tests and CI) to use deterministic
 * proposals instead of a live call. Never throws.
 */
export async function proposeTasks(
  input: ProposalInput,
  options: { model?: LanguageModel | null; fake?: boolean },
): Promise<ProposalResult> {
  const { prompt, refs } = buildProposalRequest(input);
  try {
    let output: ProposalOutput;
    if (options.fake) {
      output = fakeProposalOutput(input);
    } else if (options.model) {
      const result = await generateText({
        model: options.model,
        system: INSTRUCTIONS,
        prompt,
        output: Output.object({ name: "TaskProposals", schema: proposalOutputSchema }),
        providerOptions: { google: { thinkingConfig: { thinkingLevel: "low" } } },
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      });
      output = result.output;
    } else {
      return { ok: false, reason: "unavailable" };
    }
    return { ok: true, proposals: toProposals(output, refs, input.existing) };
  } catch (error) {
    console.error("proposeTasks failed", error);
    return { ok: false, reason: "failed" };
  }
}
