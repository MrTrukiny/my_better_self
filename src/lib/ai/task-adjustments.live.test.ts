import { describe, expect, it } from "vitest";
import type { ReviewTask } from "@/lib/tasks/adjustments";
import { getProposalOptions } from "./model";
import {
  type AdjustmentInput,
  buildAdjustmentRequest,
  suggestAdjustments,
} from "./task-adjustments";

// Live call to Gemini for tuning the prompt: `pnpm ai:try`. Skipped in normal test runs.
function sampleTask(
  name: string,
  place: [room: string, item: string | null],
  minutes: number,
  frequencyDays: number,
  times: number[],
  notes: [daysAgo: number, note: string][] = [],
): ReviewTask {
  const date = (daysAgo: number) =>
    new Date(Date.UTC(2026, 9, 28) - daysAgo * 86_400_000).toISOString().slice(0, 10);
  return {
    id: name,
    name,
    minutes,
    frequencyDays,
    roomId: place[0],
    roomName: place[0],
    itemId: place[1] ? `${place[0]} / ${place[1]}` : null,
    itemName: place[1],
    history: {
      times: times.map((m, i) => ({ date: date(i * frequencyDays), minutes: m })),
      notes: notes.map(([daysAgo, note]) => ({ date: date(daysAgo), note })),
    },
  };
}

const tasks = [
  sampleTask(
    "Limpiar la estufa",
    ["Cocina", "Estufa"],
    10,
    7,
    [12, 25, 11, 13, 10],
    [[7, "Limpieza a fondo, tenía grasa acumulada"]],
  ),
  sampleTask("Limpiar el espejo", ["Baño Principal", "Espejo Baño Principal"], 5, 7, [2, 3, 2, 2]),
  sampleTask("Barrer y trapear", ["Sala", null], 15, 3, [], [[3, "Muy sucio por los gatos"]]),
];

const sample: AdjustmentInput = {
  tasks,
  existing: tasks.map((t) => ({ roomId: t.roomId, itemId: t.itemId, name: t.name })),
  homeNote: "Dos gatos",
  locale: { language: "es-CO", timeZone: "America/Bogota" },
};

describe.skipIf(!process.env.AI_TRY)("live task adjustments", () => {
  it("suggests adjustments for the sample tasks", { timeout: 90_000 }, async () => {
    console.log(buildAdjustmentRequest(sample).prompt);
    const result = await suggestAdjustments(sample, getProposalOptions());
    expect(result.ok).toBe(true);
    if (result.ok) {
      console.table(result.adjustments.map(({ evidence: _, ...a }) => a));
    }
  });
});
