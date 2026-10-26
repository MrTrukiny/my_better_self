import type { ProposalInput, ProposalOutput } from "./task-proposals";

/**
 * Deterministic stand-in for the model, enabled with `AI_FAKE=1` in e2e and CI.
 * It uses the same references as the real prompt, so the same validation runs on its output.
 * A home note containing "[fail]" makes it throw, to exercise the error path.
 */
export function fakeProposalOutput(input: ProposalInput): ProposalOutput {
  if (input.profile.note?.includes("[fail]")) {
    throw new Error("Fake AI failure requested by the home note.");
  }
  const helpers = new Set(input.profile.helpers);
  const forHome = input.scopeRoomId === null;
  const rooms = forHome ? input.rooms : input.rooms.filter((r) => r.id === input.scopeRoomId);
  const tasks: ProposalOutput["tasks"] = [];

  rooms.forEach((room, roomIndex) => {
    const roomRef = `r${roomIndex + 1}`;
    room.items.forEach((item, itemIndex) => {
      const name =
        item.type === "floor" && helpers.has("robot-vacuum")
          ? `Vacuum the corners and edges of ${item.name}`
          : `Clean ${item.name}`;
      tasks.push({
        target: `${roomRef}.i${itemIndex + 1}`,
        kind: "cleaning",
        name,
        minutes: Math.min(30, 3 * item.count),
        frequencyDays: 14,
      });
    });
    tasks.push(
      {
        target: roomRef,
        kind: "cleaning",
        name: `${room.name} surface clean`,
        minutes: 10,
        frequencyDays: 3,
      },
      {
        target: roomRef,
        kind: "cleaning",
        name: `${room.name} deep clean`,
        minutes: 30,
        frequencyDays: 30,
      },
    );
  });

  if (forHome) {
    const hasBed = rooms.some((room) => room.items.some((item) => item.type === "bed"));
    if (hasBed) {
      tasks.push({
        target: "home",
        kind: "routine",
        name: "Make the bed",
        minutes: 2,
        frequencyDays: 1,
      });
    }
    tasks.push({
      target: "home",
      kind: "routine",
      name: helpers.has("dishwasher") ? "Load and unload the dishwasher" : "Wash the dishes",
      minutes: helpers.has("dishwasher") ? 10 : 15,
      frequencyDays: 1,
    });
  }
  return { tasks };
}
