import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { ReviewTask } from "@/lib/tasks/adjustments";
import {
  type AdjustmentInput,
  type AdjustmentOutput,
  buildAdjustmentRequest,
  suggestAdjustments,
  toAdjustments,
} from "./task-adjustments";

const stove: ReviewTask = {
  id: "task-stove",
  name: "Clean stove",
  minutes: 10,
  frequencyDays: 7,
  roomId: "room-kitchen",
  roomName: "Kitchen",
  itemId: "item-stove",
  itemName: "Stove",
  history: {
    times: [
      { date: "2026-10-20", minutes: 15 },
      { date: "2026-10-13", minutes: 22 },
      { date: "2026-10-06", minutes: 15 },
    ],
    notes: [{ date: "2026-10-13", note: "Full deep clean" }],
  },
};

const floor: ReviewTask = {
  ...stove,
  id: "task-floor",
  name: "Sweep floor",
  minutes: 8,
  itemId: null,
  itemName: null,
  history: { times: [], notes: [{ date: "2026-10-19", note: "Guests came" }] },
};

const input: AdjustmentInput = {
  tasks: [stove, floor],
  existing: [
    { roomId: "room-kitchen", itemId: "item-stove", name: "Clean stove" },
    { roomId: "room-kitchen", itemId: "item-stove", name: "Degrease the hood" },
    { roomId: "room-kitchen", itemId: null, name: "Sweep floor" },
  ],
  homeNote: "Two cats",
  locale: { language: "es-CO", timeZone: "America/Bogota" },
};

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

function mockModel(text: string) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });
}

type Suggestion = AdjustmentOutput["suggestions"][number];
const suggestion = (s: Partial<Suggestion>): Suggestion => ({
  task: "t1",
  change: "minutes",
  minutes: 15,
  frequencyDays: null,
  name: null,
  reason: "Your last 3 times were 15 to 22 minutes.",
  ...s,
});

const { refs } = buildAdjustmentRequest(input);
const adjust = (...suggestions: Suggestion[]) =>
  toAdjustments({ suggestions }, refs, input.existing);

describe("buildAdjustmentRequest", () => {
  it("AC2: sends each task with its place, estimate, frequency, times with dates, and notes", () => {
    const { prompt } = buildAdjustmentRequest(input);
    expect(prompt).toContain('t1 "Clean stove" (Kitchen / Stove): estimate 10 min, every 7 days');
    expect(prompt).toContain("Times: 2026-10-20 15 min, 2026-10-13 22 min, 2026-10-06 15 min");
    expect(prompt).toContain("Note on 2026-10-13: Full deep clean");
    expect(prompt).toContain('Other tasks here: "Degrease the hood"');
    expect(prompt).toContain('t2 "Sweep floor" (Kitchen): estimate 8 min, every 7 days');
    expect(prompt).toContain("Times: none recorded");
    expect(prompt).toContain("Home note: Two cats");
    expect(refs.get("t2")?.id).toBe("task-floor");
  });
});

describe("toAdjustments", () => {
  it("AC2, AC3: keeps valid changes of each kind with their reason and evidence", () => {
    expect(
      adjust(
        suggestion({}),
        suggestion({ change: "frequency", minutes: null, frequencyDays: 14 }),
        suggestion({
          task: "t1",
          change: "new_task",
          name: " Deep clean the oven ",
          minutes: 30,
          frequencyDays: 30,
        }),
      ),
    ).toEqual([
      {
        taskId: "task-stove",
        change: "minutes",
        name: null,
        minutes: 15,
        frequencyDays: null,
        reason: "Your last 3 times were 15 to 22 minutes.",
        evidence: "Last 3: 15, 22, 15 min · Note on Oct 13: Full deep clean",
      },
      expect.objectContaining({ change: "frequency", frequencyDays: 14, minutes: null }),
      expect.objectContaining({
        change: "new_task",
        name: "Deep clean the oven",
        minutes: 30,
        frequencyDays: 30,
      }),
    ]);
  });

  it("AC2: drops unknown tasks, out-of-range values, and unchanged values", () => {
    expect(
      adjust(
        suggestion({ task: "t9" }),
        suggestion({ minutes: 31 }),
        suggestion({ minutes: 0 }),
        suggestion({ minutes: 12.5 }),
        suggestion({ minutes: 10 }),
        suggestion({ change: "frequency", frequencyDays: 366 }),
        suggestion({ change: "frequency", frequencyDays: 7 }),
        suggestion({ change: "frequency", frequencyDays: null }),
      ),
    ).toEqual([]);
  });

  it("AC2: drops invalid new tasks and ones the place already has", () => {
    const newTask = (s: Partial<Suggestion>) =>
      suggestion({ change: "new_task", name: "Deep clean", minutes: 30, frequencyDays: 30, ...s });
    expect(
      adjust(
        newTask({ name: null }),
        newTask({ name: "  " }),
        newTask({ name: "x".repeat(81) }),
        newTask({ minutes: 45 }),
        newTask({ frequencyDays: null }),
        newTask({ name: "Degrease the hood!" }),
      ),
    ).toEqual([]);
  });

  it("AC2: keeps one minutes and one frequency change per task, and one copy of a new task", () => {
    const result = adjust(
      suggestion({ minutes: 15 }),
      suggestion({ minutes: 18 }),
      suggestion({ change: "new_task", name: "Deep clean", minutes: 30, frequencyDays: 30 }),
      suggestion({ change: "new_task", name: "deep clean", minutes: 25, frequencyDays: 60 }),
    );
    expect(result.map((a) => [a.change, a.minutes])).toEqual([
      ["minutes", 15],
      ["new_task", 30],
    ]);
  });

  it("AC3: drops empty or overlong reasons", () => {
    expect(adjust(suggestion({ reason: " " }), suggestion({ reason: "x".repeat(401) }))).toEqual(
      [],
    );
  });
});

describe("suggestAdjustments", () => {
  it("AC2: returns validated suggestions from the model", async () => {
    const model = mockModel(
      JSON.stringify({ suggestions: [suggestion({}), suggestion({ task: "t7" })] }),
    );
    const result = await suggestAdjustments(input, { model });
    expect(result).toEqual({ ok: true, adjustments: [expect.objectContaining({ minutes: 15 })] });
    const system = model.doGenerateCalls[0]?.prompt.find((message) => message.role === "system");
    expect(system?.content).toMatch(/Suggesting nothing is a good answer/);
  });

  it("AC5: reports a failure when the output is invalid or the model throws", async () => {
    expect(await suggestAdjustments(input, { model: mockModel("not json") })).toEqual({
      ok: false,
      reason: "failed",
    });
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("boom");
      },
    });
    expect(await suggestAdjustments(input, { model })).toEqual({ ok: false, reason: "failed" });
  });

  it("reports that AI is unavailable without a model", async () => {
    expect(await suggestAdjustments(input, { model: null })).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});

describe("fake adjustments", () => {
  it("suggests calibrated minutes and a deep version for tasks with notes", async () => {
    const result = await suggestAdjustments(input, { fake: true });
    expect(
      result.ok && result.adjustments.map((a) => [a.taskId, a.change, a.minutes, a.name]),
    ).toEqual([
      ["task-stove", "minutes", 15, null],
      ["task-stove", "new_task", 30, "Deep clean: Clean stove"],
      ["task-floor", "new_task", 30, "Deep clean: Sweep floor"],
    ]);
  });

  it("fails when the home note asks for it", async () => {
    expect(await suggestAdjustments({ ...input, homeNote: "[fail]" }, { fake: true })).toEqual({
      ok: false,
      reason: "failed",
    });
  });
});
