import { describe, expect, it } from "vitest";
import { getProposalOptions } from "./model";
import { buildProposalRequest, type ProposalInput, proposeTasks } from "./task-proposals";

// Live call to Gemini for tuning the prompt: `pnpm ai:try`. Skipped in normal test runs.
type SampleItem = [type: string, name: string, note?: string];

function sampleRoom(name: string, items: SampleItem[]): ProposalInput["rooms"][number] {
  return {
    id: name,
    name,
    items: items.map(([type, itemName, note]) => ({
      id: `${name} / ${itemName}`,
      type,
      name: itemName,
      count: 1,
      note: note ?? null,
    })),
  };
}

const sampleHome: ProposalInput = {
  rooms: [
    sampleRoom("Alcoba Principal", [
      ["closet", "Closet Principal"],
      ["window", "Ventana Alcoba Principal"],
      ["bed", "Cama Principal"],
    ]),
    sampleRoom("Alcoba 2", [
      ["window", "Ventana Alcoba 2"],
      ["closet", "Closet Alcoba 2"],
      ["bed", "Cama Social"],
    ]),
    sampleRoom("Alcoba 3 (Oficina)", [
      ["window", "Ventana Alcoba 3"],
      ["closet", "Closet Alcoba 3"],
      ["desk", "Escritorio"],
      ["other", "Pantalla 24"],
      ["other", "Mac Trabajo"],
      ["other", "Teclado y Mouse"],
      ["mirror", "Espejo y Estantes"],
    ]),
    sampleRoom("Comedor", [
      ["table", "Mesa comedor"],
      ["other", "Repisas Gatos"],
      ["shelf", "Estantería"],
      ["appliance", "Aspiradora Robot"],
    ]),
    sampleRoom("Sala", [
      ["sofa", "Sofacama"],
      ["cabinet", "Centro Entretenimiento"],
    ]),
    sampleRoom("Balcón", [
      ["other", "Arenero Gatos"],
      ["other", "Plantas"],
    ]),
    sampleRoom("Cocina", [
      ["appliance", "Nevera"],
      ["appliance", "Estufa"],
      ["appliance", "Freidora Aire"],
      ["sink", "Lavabo"],
    ]),
    sampleRoom("Lavadero", [
      ["appliance", "Lavadora"],
      ["sink", "Fregadero"],
    ]),
    sampleRoom("Baño Principal", [
      ["toilet", "Retrete Principal"],
      ["shower", "Ducha Principal"],
      ["mirror", "Espejo Baño Principal"],
    ]),
    sampleRoom("Baño Social", [
      ["toilet", "Retrete Social"],
      ["shower", "Ducha Social"],
      ["mirror", "Espejo Baño Social"],
    ]),
  ],
  profile: { helpers: ["robot-vacuum", "washing-machine"], note: null },
  existing: [],
  scopeRoomId: null,
};

describe.skipIf(!process.env.AI_TRY)("live task proposals", () => {
  it("proposes tasks for the sample home", { timeout: 60_000 }, async () => {
    console.log(buildProposalRequest(sampleHome).prompt);
    const started = Date.now();
    const result = await proposeTasks(sampleHome, getProposalOptions());
    console.log(`Took ${Date.now() - started} ms`);
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
