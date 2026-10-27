import { describe, expect, it } from "vitest";
import { describeUncovered, findUncovered, hasUncovered, NOTHING_NEW } from "./coverage";

const rooms = [
  { id: "kitchen", items: [{ id: "floor" }, { id: "window" }] },
  { id: "bathroom", items: [{ id: "mirror" }] },
  { id: "hall", items: [] },
];

function sorted(set: Set<string>): string[] {
  return [...set].sort();
}

describe("findUncovered", () => {
  it("AC1, AC2: skips covered items and rooms, and uncovers a new item in a covered room", () => {
    const uncovered = findUncovered({
      rooms,
      existing: [
        { roomId: "kitchen", itemId: "floor" },
        { roomId: "kitchen", itemId: null },
        { roomId: "bathroom", itemId: null },
        { roomId: "bathroom", itemId: "mirror" },
        { roomId: "hall", itemId: null },
        { roomId: null, itemId: null },
      ],
      scopeRoomId: null,
    });
    expect(sorted(uncovered.itemIds)).toEqual(["window"]);
    expect(sorted(uncovered.roomIds)).toEqual([]);
    expect(uncovered.home).toBe(false);
  });

  it("AC2: a new room is uncovered along with its items", () => {
    const uncovered = findUncovered({
      rooms,
      existing: [
        { roomId: "kitchen", itemId: "floor" },
        { roomId: "kitchen", itemId: "window" },
        { roomId: "kitchen", itemId: null },
        { roomId: "hall", itemId: null },
        { roomId: null, itemId: null },
      ],
      scopeRoomId: null,
    });
    expect(sorted(uncovered.roomIds)).toEqual(["bathroom"]);
    expect(sorted(uncovered.itemIds)).toEqual(["mirror"]);
  });

  it("AC2: an item task doesn't cover its room", () => {
    const uncovered = findUncovered({
      rooms,
      existing: [{ roomId: "kitchen", itemId: "floor" }],
      scopeRoomId: null,
    });
    expect(uncovered.roomIds.has("kitchen")).toBe(true);
  });

  it("AC3: a home task or proposal covers home routines", () => {
    expect(findUncovered({ rooms, existing: [], scopeRoomId: null }).home).toBe(true);
    expect(
      findUncovered({ rooms, existing: [{ roomId: null, itemId: null }], scopeRoomId: null }).home,
    ).toBe(false);
  });

  it("AC4: room scope ignores other rooms and never reports home routines", () => {
    const uncovered = findUncovered({
      rooms,
      existing: [{ roomId: "kitchen", itemId: null }],
      scopeRoomId: "kitchen",
    });
    expect(sorted(uncovered.itemIds)).toEqual(["floor", "window"]);
    expect(sorted(uncovered.roomIds)).toEqual([]);
    expect(uncovered.home).toBe(false);
  });

  it("AC4: an unknown room scope has nothing uncovered", () => {
    const uncovered = findUncovered({ rooms, existing: [], scopeRoomId: "gone" });
    expect(hasUncovered(uncovered)).toBe(false);
  });

  it("AC5: everything covered gives an empty result", () => {
    const existing = [
      { roomId: "kitchen", itemId: "floor" },
      { roomId: "kitchen", itemId: "window" },
      { roomId: "kitchen", itemId: null },
      { roomId: "bathroom", itemId: "mirror" },
      { roomId: "bathroom", itemId: null },
      { roomId: "hall", itemId: null },
      { roomId: null, itemId: null },
    ];
    const uncovered = findUncovered({ rooms, existing, scopeRoomId: null });
    expect(hasUncovered(uncovered)).toBe(false);
    expect(describeUncovered(uncovered)).toBe(NOTHING_NEW);
  });

  it("AC6: removing an item's last task or proposal uncovers it", () => {
    const existing = [
      { roomId: "kitchen", itemId: "floor" },
      { roomId: "kitchen", itemId: "window" },
      { roomId: "kitchen", itemId: null },
    ];
    const scope = { rooms: [rooms[0]], scopeRoomId: "kitchen" };
    expect(hasUncovered(findUncovered({ ...scope, existing }))).toBe(false);
    const uncovered = findUncovered({ ...scope, existing: existing.slice(1) });
    expect(sorted(uncovered.itemIds)).toEqual(["floor"]);
  });
});

describe("describeUncovered", () => {
  const none = { roomIds: new Set<string>(), itemIds: new Set<string>(), home: false };

  it("counts new items and rooms in plural", () => {
    expect(
      describeUncovered({ ...none, itemIds: new Set(["a", "b"]), roomIds: new Set(["r"]) }),
    ).toBe("Proposes tasks for 2 new items and 1 new room.");
  });

  it("uses singular forms", () => {
    expect(describeUncovered({ ...none, itemIds: new Set(["a"]) })).toBe(
      "Proposes tasks for 1 new item.",
    );
    expect(describeUncovered({ ...none, roomIds: new Set(["r", "s"]) })).toBe(
      "Proposes tasks for 2 new rooms.",
    );
  });

  it("adds home-wide routines as the last part", () => {
    expect(
      describeUncovered({
        itemIds: new Set(["a"]),
        roomIds: new Set(["r"]),
        home: true,
      }),
    ).toBe("Proposes tasks for 1 new item, 1 new room, and home-wide routines.");
    expect(describeUncovered({ ...none, home: true })).toBe(
      "Proposes tasks for home-wide routines.",
    );
  });
});
