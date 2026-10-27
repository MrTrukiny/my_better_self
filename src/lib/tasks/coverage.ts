/** What a task or proposal targets: an item, a room (no item), or the whole home (neither). */
export type CoverageTarget = { roomId: string | null; itemId: string | null };

export type CoverageInput = {
  rooms: { id: string; items: { id: string }[] }[];
  /** Every task and pending proposal, of any scope. */
  existing: CoverageTarget[];
  /** One room, or the whole home when null. */
  scopeRoomId: string | null;
};

/** Rooms and items in scope with no tasks and no pending proposals, and whether the home has none. */
export type Uncovered = { roomIds: Set<string>; itemIds: Set<string>; home: boolean };

export const NOTHING_NEW =
  "Everything already has tasks. Add a room or an item, or discard proposals to get new ones.";

export function findUncovered({ rooms, existing, scopeRoomId }: CoverageInput): Uncovered {
  const coveredItems = new Set<string>();
  const coveredRooms = new Set<string>();
  let homeCovered = false;
  for (const target of existing) {
    if (target.itemId) {
      coveredItems.add(target.itemId);
    } else if (target.roomId) {
      coveredRooms.add(target.roomId);
    } else {
      homeCovered = true;
    }
  }

  const inScope = scopeRoomId === null ? rooms : rooms.filter((r) => r.id === scopeRoomId);
  const roomIds = new Set<string>();
  const itemIds = new Set<string>();
  for (const room of inScope) {
    if (!coveredRooms.has(room.id)) {
      roomIds.add(room.id);
    }
    for (const item of room.items) {
      if (!coveredItems.has(item.id)) {
        itemIds.add(item.id);
      }
    }
  }
  return { roomIds, itemIds, home: scopeRoomId === null && !homeCovered };
}

export function hasUncovered(uncovered: Uncovered): boolean {
  return uncovered.home || uncovered.roomIds.size > 0 || uncovered.itemIds.size > 0;
}

function countPart(count: number, noun: string): string {
  return `${count} new ${noun}${count === 1 ? "" : "s"}`;
}

/** The line shown above "Propose tasks": what the next request covers, or `NOTHING_NEW`. */
export function describeUncovered(uncovered: Uncovered): string {
  const parts = [
    ...(uncovered.itemIds.size > 0 ? [countPart(uncovered.itemIds.size, "item")] : []),
    ...(uncovered.roomIds.size > 0 ? [countPart(uncovered.roomIds.size, "room")] : []),
    ...(uncovered.home ? ["home-wide routines"] : []),
  ];
  if (parts.length === 0) {
    return NOTHING_NEW;
  }
  const list =
    parts.length <= 2
      ? parts.join(" and ")
      : `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
  return `Proposes tasks for ${list}.`;
}
