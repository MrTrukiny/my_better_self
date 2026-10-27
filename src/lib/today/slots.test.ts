import { describe, expect, it } from "vitest";
import { sessionSlots } from "./slots";

describe("sessionSlots", () => {
  it("AC2: runs back to back from the start time with each task's estimate", () => {
    expect(sessionSlots("06:30", [{ minutes: 10 }, { minutes: 15 }, { minutes: 5 }])).toEqual([
      { start: "06:30", end: "06:40" },
      { start: "06:40", end: "06:55" },
      { start: "06:55", end: "07:00" },
    ]);
  });

  it("AC2: has no slots without a start time", () => {
    expect(sessionSlots(null, [{ minutes: 10 }])).toEqual([null]);
  });
});
