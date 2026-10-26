import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { CLEANING_GUIDE } from "@/lib/tasks/cleaning-guide";
import { fakeProposalOutput } from "./fake-proposals";
import {
  buildProposalRequest,
  type ProposalInput,
  proposeTasks,
  toProposals,
} from "./task-proposals";

const input: ProposalInput = {
  rooms: [
    {
      id: "room-kitchen",
      name: "Kitchen",
      items: [
        { id: "item-window", type: "window", name: "Window", count: 3, note: null },
        { id: "item-floor", type: "floor", name: "Floor", count: 1, note: "Tiles" },
      ],
    },
    {
      id: "room-bedroom",
      name: "Bedroom",
      items: [{ id: "item-bed", type: "bed", name: "Bed", count: 1, note: null }],
    },
  ],
  profile: { helpers: ["robot-vacuum"], note: "Two cats that shed a lot" },
  existing: [{ roomId: "room-kitchen", itemId: "item-window", name: "Clean Window" }],
  scopeRoomId: null,
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

describe("buildProposalRequest", () => {
  it("AC2: lists rooms and items under short references", () => {
    const { prompt, refs } = buildProposalRequest(input);
    expect(prompt).toContain('r1 "Kitchen"');
    expect(prompt).toContain('r1.i1 window "Window" x3');
    expect(prompt).toContain('r1.i2 floor "Floor" x1 (note: Tiles)');
    expect(prompt).toContain('r2.i1 bed "Bed" x1');
    expect(refs.get("r1.i1")).toEqual({ roomId: "room-kitchen", itemId: "item-window" });
    expect(refs.get("home")).toEqual({ roomId: null, itemId: null });
  });

  it("AC4: includes the helper guidance and the home note", () => {
    const { prompt } = buildProposalRequest(input);
    expect(prompt).toMatch(/Robot vacuum: .*corners/);
    expect(prompt).toContain("Two cats that shed a lot");
  });

  it("tells the model the owner's locale, so names use their regional variant", () => {
    const { prompt } = buildProposalRequest(input);
    expect(prompt).toContain(
      "Owner's locale: device language es-CO (Spanish (Colombia)), time zone America/Bogota",
    );
  });

  it("includes the cleaning guide only for the item types in the home", () => {
    const { prompt } = buildProposalRequest(input);
    expect(prompt).toContain(`- window: ${CLEANING_GUIDE.window}`);
    expect(prompt).toContain(`- bed: ${CLEANING_GUIDE.bed}`);
    expect(prompt).not.toContain("- toilet:");
  });

  it("AC6: lists the existing tasks so they aren't proposed again", () => {
    const { prompt } = buildProposalRequest(input);
    expect(prompt).toContain('r1.i1: "Clean Window"');
  });

  it("only includes the chosen room when proposing for one room", () => {
    const { prompt, refs } = buildProposalRequest({ ...input, scopeRoomId: "room-bedroom" });
    expect(prompt).toContain('r1 "Bedroom"');
    expect(prompt).not.toContain("Kitchen");
    expect(refs.has("home")).toBe(false);
  });
});

describe("toProposals", () => {
  const { refs } = buildProposalRequest(input);
  const base = { kind: "cleaning", minutes: 10, frequencyDays: 7 } as const;

  it("AC2: resolves references to rooms and items", () => {
    const proposals = toProposals(
      {
        tasks: [
          { ...base, target: "r1.i2", name: "Mop the corners" },
          { ...base, target: "r1", name: "Kitchen surface clean" },
          { ...base, target: "home", kind: "routine", name: "Do the laundry", minutes: 20 },
        ],
      },
      refs,
      input.existing,
    );
    expect(proposals).toEqual([
      { ...base, roomId: "room-kitchen", itemId: "item-floor", name: "Mop the corners" },
      { ...base, roomId: "room-kitchen", itemId: null, name: "Kitchen surface clean" },
      {
        roomId: null,
        itemId: null,
        kind: "routine",
        name: "Do the laundry",
        minutes: 20,
        frequencyDays: 7,
      },
    ]);
  });

  it("AC3: drops unknown targets and out-of-range minutes or frequencies", () => {
    const proposals = toProposals(
      {
        tasks: [
          { ...base, target: "r9", name: "Ghost room" },
          { ...base, target: "r1", name: "Too long", minutes: 31 },
          { ...base, target: "r1", name: "Zero minutes", minutes: 0 },
          { ...base, target: "r1", name: "Fractional", minutes: 2.5 },
          { ...base, target: "r1", name: "Never", frequencyDays: 366 },
          { ...base, target: "r1", name: "   " },
          { ...base, target: "r1", name: "Kept", minutes: 30, frequencyDays: 365 },
        ],
      },
      refs,
      [],
    );
    expect(proposals.map((proposal) => proposal.name)).toEqual(["Kept"]);
  });

  it("AC6: drops duplicates of existing tasks and within the batch", () => {
    const proposals = toProposals(
      {
        tasks: [
          { ...base, target: "r1.i1", name: "clean  window." },
          { ...base, target: "r1", name: "Wipe counters" },
          { ...base, target: "r1", name: "Wipe counters" },
        ],
      },
      refs,
      input.existing,
    );
    expect(proposals.map((proposal) => proposal.name)).toEqual(["Wipe counters"]);
  });
});

describe("proposeTasks", () => {
  it("AC2: returns validated proposals from the model", async () => {
    const model = mockModel(
      JSON.stringify({
        tasks: [
          { target: "r2.i1", kind: "routine", name: "Make the bed", minutes: 2, frequencyDays: 1 },
        ],
      }),
    );
    expect(await proposeTasks(input, { model })).toEqual({
      ok: true,
      proposals: [
        {
          roomId: "room-bedroom",
          itemId: "item-bed",
          kind: "routine",
          name: "Make the bed",
          minutes: 2,
          frequencyDays: 1,
        },
      ],
    });
  });

  it("AC8: reports a failure when the output is invalid", async () => {
    expect(await proposeTasks(input, { model: mockModel("not json") })).toEqual({
      ok: false,
      reason: "failed",
    });
  });

  it("AC8: reports a failure when the model throws", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("boom");
      },
    });
    expect(await proposeTasks(input, { model })).toEqual({ ok: false, reason: "failed" });
  });

  it("reports that AI is unavailable without a model", async () => {
    expect(await proposeTasks(input, { model: null })).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});

describe("fake proposals", () => {
  it("AC4: proposes corners and edges for floors when there is a robot vacuum", async () => {
    const result = await proposeTasks(input, { fake: true });
    const names = result.ok ? result.proposals.map((proposal) => proposal.name) : [];
    expect(names).toContain("Vacuum the corners and edges of Floor");
    expect(names).toContain("Make the bed");
    expect(names).toContain("Kitchen deep clean");
    expect(names).not.toContain("Clean Window");
  });

  it("AC8: fails when the home note asks it to", async () => {
    const failing = { ...input, profile: { ...input.profile, note: "[fail]" } };
    expect(await proposeTasks(failing, { fake: true })).toEqual({ ok: false, reason: "failed" });
    expect(() => fakeProposalOutput(failing)).toThrow();
  });
});
