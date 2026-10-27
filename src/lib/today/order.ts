/** What the recommended order needs to know about a task. */
export type OrderableTask = {
  id: string;
  name: string;
  roomId: string | null;
  roomName: string | null;
  /** When the room was added, which is the rooms page order. */
  roomAddedAt: number | null;
  itemName: string | null;
  itemType: string | null;
  itemAddedAt: number | null;
};

const HIGH = new Set(["light-fixture", "shelf"]);
const WET = new Set(["sink", "toilet", "shower", "bathtub"]);
const FLOOR = new Set(["floor", "rug"]);

/**
 * Where a task falls within its room, cleaning top to bottom: high places and dusting, then
 * furniture, fixtures, and appliances, then wet areas, then floors, then the room's own passes.
 */
export function zoneOf(itemType: string | null): number {
  if (itemType === null) {
    return 4;
  }
  if (HIGH.has(itemType)) {
    return 0;
  }
  if (WET.has(itemType)) {
    return 2;
  }
  if (FLOOR.has(itemType)) {
    return 3;
  }
  return 1;
}

/** Today's cleaning tasks in the order to do them: one room at a time, the whole home last. */
export function sessionOrder<T extends OrderableTask>(tasks: readonly T[]): T[] {
  return [...tasks].sort(
    (a, b) =>
      (a.roomAddedAt ?? Number.POSITIVE_INFINITY) - (b.roomAddedAt ?? Number.POSITIVE_INFINITY) ||
      (a.roomId ?? "").localeCompare(b.roomId ?? "") ||
      zoneOf(a.itemType) - zoneOf(b.itemType) ||
      (a.itemAddedAt ?? 0) - (b.itemAddedAt ?? 0) ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );
}
