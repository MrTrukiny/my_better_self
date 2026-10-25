import { describe, expect, it } from "vitest";
import { parseInput } from "@/lib/inventory/schemas";
import { HOME_NOTE_MAX, homeProfileInputSchema } from "./schemas";

describe("homeProfileInputSchema", () => {
  it("AC1: accepts known helpers and a note, and stores an empty note as null", () => {
    expect(
      parseInput(homeProfileInputSchema, { helpers: ["robot-vacuum", "dishwasher"], note: " " }),
    ).toEqual({ ok: true, data: { helpers: ["robot-vacuum", "dishwasher"], note: null } });
  });

  it("drops duplicate helpers", () => {
    const result = parseInput(homeProfileInputSchema, {
      helpers: ["dryer", "dryer"],
      note: "",
    });
    expect(result.ok && result.data.helpers).toEqual(["dryer"]);
  });

  it("rejects unknown helpers", () => {
    const result = parseInput(homeProfileInputSchema, { helpers: ["jetpack"], note: "" });
    expect(result.ok).toBe(false);
  });

  it(`AC1: accepts a ${HOME_NOTE_MAX}-character note and rejects one more`, () => {
    const atLimit = parseInput(homeProfileInputSchema, {
      helpers: [],
      note: "a".repeat(HOME_NOTE_MAX),
    });
    expect(atLimit.ok).toBe(true);

    const over = parseInput(homeProfileInputSchema, {
      helpers: [],
      note: "a".repeat(HOME_NOTE_MAX + 1),
    });
    expect(over).toEqual({
      ok: false,
      fieldErrors: { note: `Use ${HOME_NOTE_MAX} characters or fewer.` },
    });
  });
});
