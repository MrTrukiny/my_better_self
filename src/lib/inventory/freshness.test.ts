import { describe, expect, it } from "vitest";
import { lastCleanedLabel, roomFreshness } from "./freshness";

const TODAY = 1000;

function task(frequencyDays: number, lastDone: number | null, addedOn = TODAY - 100) {
  return { frequencyDays, lastDone, addedOn };
}

describe("roomFreshness", () => {
  it("AC2: maps the time since the last completion over the frequency to a state", () => {
    expect(roomFreshness([task(10, TODAY - 4)], TODAY)?.state).toBe("fresh");
    expect(roomFreshness([task(10, TODAY - 5)], TODAY)?.state).toBe("good");
    expect(roomFreshness([task(10, TODAY - 9)], TODAY)?.state).toBe("good");
    expect(roomFreshness([task(10, TODAY - 10)], TODAY)?.state).toBe("due");
    expect(roomFreshness([task(10, TODAY - 14)], TODAY)?.state).toBe("due");
    expect(roomFreshness([task(10, TODAY - 15)], TODAY)?.state).toBe("overdue");
  });

  it("AC2: the most behind task decides", () => {
    expect(roomFreshness([task(30, TODAY), task(3, TODAY - 6)], TODAY)?.state).toBe("overdue");
  });

  it("AC3: a task never done counts from when it was added", () => {
    expect(roomFreshness([task(7, null, TODAY)], TODAY)?.state).toBe("fresh");
    expect(roomFreshness([task(7, null, TODAY - 8)], TODAY)?.state).toBe("due");
  });

  it("AC5: the room was last cleaned on its latest done day", () => {
    expect(roomFreshness([task(7, TODAY - 3), task(7, TODAY - 1)], TODAY)?.lastCleaned).toBe(
      TODAY - 1,
    );
    expect(roomFreshness([task(7, null)], TODAY)?.lastCleaned).toBeNull();
  });

  it("AC6: a room without cleaning tasks has no state", () => {
    expect(roomFreshness([], TODAY)).toBeNull();
  });
});

describe("lastCleanedLabel", () => {
  it("AC5: words the last cleaning relative to today", () => {
    expect(lastCleanedLabel(null, TODAY)).toBe("Not cleaned yet");
    expect(lastCleanedLabel(TODAY, TODAY)).toBe("Last cleaned today");
    expect(lastCleanedLabel(TODAY - 1, TODAY)).toBe("Last cleaned yesterday");
    expect(lastCleanedLabel(TODAY - 2, TODAY)).toBe("Last cleaned 2 days ago");
  });
});
