import { describe, expect, it } from "vitest";
import { getProposalOptions } from "./model";
import { buildProposalRequest, type ProposalInput, proposeTasks } from "./task-proposals";

// Live call to Gemini for tuning the prompt: `pnpm ai:try`. Skipped in normal test runs.
const sampleHome: ProposalInput = {
  rooms: [
    {
      id: "kitchen",
      name: "Cocina",
      items: [
        { id: "k1", type: "countertop", name: "Mesón", count: 1, note: null },
        { id: "k2", type: "window", name: "Ventana", count: 2, note: null },
        { id: "k3", type: "floor", name: "Piso", count: 1, note: "Baldosa" },
        { id: "k4", type: "appliance", name: "Nevera", count: 1, note: null },
      ],
    },
    {
      id: "bathroom",
      name: "Baño",
      items: [
        { id: "b1", type: "toilet", name: "Inodoro", count: 1, note: null },
        { id: "b2", type: "shower", name: "Ducha", count: 1, note: "Mampara de vidrio" },
        { id: "b3", type: "mirror", name: "Espejo", count: 1, note: null },
        { id: "b4", type: "sink", name: "Lavamanos", count: 1, note: null },
      ],
    },
    {
      id: "bedroom",
      name: "Habitación",
      items: [
        { id: "r1", type: "bed", name: "Cama", count: 1, note: null },
        { id: "r2", type: "closet", name: "Clóset", count: 1, note: null },
        { id: "r3", type: "floor", name: "Piso", count: 1, note: "Madera" },
      ],
    },
  ],
  profile: { helpers: ["robot-vacuum", "washing-machine"], note: null },
  existing: [],
  scopeRoomId: null,
};

describe.skipIf(!process.env.AI_TRY)("live task proposals", () => {
  it("proposes tasks for the sample home", { timeout: 60_000 }, async () => {
    console.log(buildProposalRequest(sampleHome).prompt);
    const result = await proposeTasks(sampleHome, getProposalOptions());
    expect(result.ok).toBe(true);
    if (result.ok) {
      console.table(
        result.proposals.map(({ roomId, itemId, ...task }) => ({
          target: itemId ?? roomId ?? "home",
          ...task,
        })),
      );
    }
  });
});
