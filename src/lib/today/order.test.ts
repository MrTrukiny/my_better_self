import { describe, expect, it } from "vitest";
import { type OrderableTask, sessionOrder, zoneOf } from "./order";

const KITCHEN = { roomId: "kitchen", roomName: "Kitchen", roomAddedAt: 1 };
const BATHROOM = { roomId: "bathroom", roomName: "Bathroom", roomAddedAt: 2 };

function task(
  id: string,
  room: typeof KITCHEN | null,
  item: { type: string; addedAt: number } | null,
): OrderableTask & { id: string } {
  return {
    id,
    name: id,
    roomId: room?.roomId ?? null,
    roomName: room?.roomName ?? null,
    roomAddedAt: room?.roomAddedAt ?? null,
    itemName: item ? `${id} item` : null,
    itemType: item?.type ?? null,
    itemAddedAt: item?.addedAt ?? null,
  };
}

describe("zoneOf", () => {
  it("ranks high places, then furniture and fixtures, then wet areas, then floors, then the room", () => {
    expect(zoneOf("light-fixture")).toBeLessThan(zoneOf("window"));
    expect(zoneOf("shelf")).toBeLessThan(zoneOf("appliance"));
    expect(zoneOf("other")).toBe(zoneOf("table"));
    expect(zoneOf("table")).toBeLessThan(zoneOf("sink"));
    expect(zoneOf("toilet")).toBeLessThan(zoneOf("floor"));
    expect(zoneOf("rug")).toBe(zoneOf("floor"));
    expect(zoneOf("floor")).toBeLessThan(zoneOf(null));
  });
});

describe("sessionOrder", () => {
  it("AC1: one room at a time in the rooms page order, top to bottom, the whole home last", () => {
    const tasks = [
      task("home trash", null, null),
      task("bathroom floor", BATHROOM, { type: "floor", addedAt: 1 }),
      task("kitchen pass", KITCHEN, null),
      task("kitchen floor", KITCHEN, { type: "floor", addedAt: 1 }),
      task("bathroom toilet", BATHROOM, { type: "toilet", addedAt: 2 }),
      task("kitchen sink", KITCHEN, { type: "sink", addedAt: 2 }),
      task("kitchen stove", KITCHEN, { type: "appliance", addedAt: 3 }),
      task("kitchen shelf", KITCHEN, { type: "shelf", addedAt: 4 }),
    ];
    expect(sessionOrder(tasks).map((t) => t.id)).toEqual([
      "kitchen shelf",
      "kitchen stove",
      "kitchen sink",
      "kitchen floor",
      "kitchen pass",
      "bathroom toilet",
      "bathroom floor",
      "home trash",
    ]);
  });

  it("AC1: the same tasks always come in the same order", () => {
    const tasks = [
      task("b", KITCHEN, { type: "table", addedAt: 5 }),
      task("a", KITCHEN, { type: "desk", addedAt: 5 }),
      task("c", KITCHEN, { type: "door", addedAt: 4 }),
    ];
    const expected = ["c", "a", "b"];
    expect(sessionOrder(tasks).map((t) => t.id)).toEqual(expected);
    expect(sessionOrder([...tasks].reverse()).map((t) => t.id)).toEqual(expected);
  });
});
