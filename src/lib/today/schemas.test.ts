import { describe, expect, it } from "vitest";
import {
  actualMinutesUpdate,
  checkOffDecision,
  checkOffInputSchema,
  isEditableDay,
} from "./schemas";

const TODAY = "2026-10-26";

describe("checkOffInputSchema", () => {
  it("accepts the three statuses", () => {
    for (const status of ["scheduled", "done", "skipped"]) {
      expect(checkOffInputSchema.safeParse({ occurrenceId: "o1", status }).success).toBe(true);
    }
  });

  it("rejects unknown statuses and missing ids", () => {
    expect(checkOffInputSchema.safeParse({ occurrenceId: "o1", status: "late" }).success).toBe(
      false,
    );
    expect(checkOffInputSchema.safeParse({ occurrenceId: "", status: "done" }).success).toBe(false);
  });

  it("009 AC3: takes whole minutes from 1 to 240, null to clear, or none to keep", () => {
    const parse = (actualMinutes: unknown) =>
      checkOffInputSchema.safeParse({ occurrenceId: "o1", status: "done", actualMinutes }).success;
    expect(parse(1)).toBe(true);
    expect(parse(240)).toBe(true);
    expect(parse(null)).toBe(true);
    expect(parse(undefined)).toBe(true);
    expect(parse(0)).toBe(false);
    expect(parse(241)).toBe(false);
    expect(parse(12.5)).toBe(false);
    expect(parse("12")).toBe(false);
  });
});

describe("checkOffDecision", () => {
  it("AC2: applies changes to today's occurrences", () => {
    expect(checkOffDecision({ date: TODAY, kind: "cleaning" }, TODAY, "done")).toBe("apply");
    expect(checkOffDecision({ date: TODAY, kind: "routine" }, TODAY, "scheduled")).toBe("apply");
  });

  it("spec 013 AC2: the last 7 days can be changed; older and future days can't", () => {
    expect(checkOffDecision({ date: "2026-10-25", kind: "cleaning" }, TODAY, "done")).toBe("apply");
    expect(checkOffDecision({ date: "2026-10-19", kind: "cleaning" }, TODAY, "done")).toBe("apply");
    expect(checkOffDecision({ date: "2026-10-18", kind: "cleaning" }, TODAY, "done")).toBe("past");
    expect(checkOffDecision({ date: "2026-10-27", kind: "cleaning" }, TODAY, "done")).toBe("past");
  });

  it("AC6: an occurrence the plan dropped is gone", () => {
    expect(checkOffDecision(null, TODAY, "done")).toBe("gone");
  });

  it("AC3: only cleaning tasks can be skipped", () => {
    expect(checkOffDecision({ date: TODAY, kind: "routine" }, TODAY, "skipped")).toBe("invalid");
    expect(checkOffDecision({ date: TODAY, kind: "cleaning" }, TODAY, "skipped")).toBe("apply");
  });

  it("009 AC3, AC7: minutes go only on done cleaning tasks", () => {
    const cleaning = { date: TODAY, kind: "cleaning" } as const;
    const routine = { date: TODAY, kind: "routine" } as const;
    expect(checkOffDecision(cleaning, TODAY, "done", 12)).toBe("apply");
    expect(checkOffDecision(cleaning, TODAY, "done", null)).toBe("apply");
    expect(checkOffDecision(cleaning, TODAY, "skipped", 12)).toBe("invalid");
    expect(checkOffDecision(cleaning, TODAY, "scheduled", 12)).toBe("invalid");
    expect(checkOffDecision(routine, TODAY, "done", 2)).toBe("invalid");
    expect(checkOffDecision(routine, TODAY, "done", null)).toBe("apply");
  });
});

describe("isEditableDay", () => {
  it("spec 013 AC2: today and the 7 days before it", () => {
    expect(isEditableDay(TODAY, TODAY)).toBe(true);
    expect(isEditableDay("2026-10-19", TODAY)).toBe(true);
    expect(isEditableDay("2026-10-18", TODAY)).toBe(false);
    expect(isEditableDay("2026-10-27", TODAY)).toBe(false);
  });
});

describe("actualMinutesUpdate", () => {
  it("009 AC3, AC4: sets, clears, or keeps the minutes", () => {
    expect(actualMinutesUpdate("done", 12)).toEqual({ actualMinutes: 12 });
    expect(actualMinutesUpdate("done", null)).toEqual({ actualMinutes: null });
    expect(actualMinutesUpdate("done", undefined)).toEqual({});
    expect(actualMinutesUpdate("scheduled", undefined)).toEqual({ actualMinutes: null });
    expect(actualMinutesUpdate("skipped", undefined)).toEqual({ actualMinutes: null });
  });
});
