import { describe, expect, it } from "vitest";
import { getHelper, HELPER_IDS, HELPERS } from "./helpers";

describe("helpers", () => {
  it("AC1: offers the fixed list of helpers in order", () => {
    expect(HELPER_IDS).toEqual(["robot-vacuum", "dishwasher", "washing-machine", "dryer", "other"]);
  });

  it("gives every helper a label and guidance for the AI", () => {
    for (const helper of HELPERS) {
      expect(helper.label).not.toBe("");
      expect(helper.guidance.length).toBeGreaterThan(20);
    }
  });

  it("AC4: tells the AI that a robot vacuum leaves only corners and edges", () => {
    expect(getHelper("robot-vacuum")?.guidance).toMatch(/corners|edges/i);
    expect(getHelper("nope")).toBeUndefined();
  });
});
