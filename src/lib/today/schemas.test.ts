import { describe, expect, it } from "vitest";
import { checkOffDecision, checkOffInputSchema } from "./schemas";

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
});

describe("checkOffDecision", () => {
  it("AC2: applies changes to today's occurrences", () => {
    expect(checkOffDecision({ date: TODAY, kind: "cleaning" }, TODAY, "done")).toBe("apply");
    expect(checkOffDecision({ date: TODAY, kind: "routine" }, TODAY, "scheduled")).toBe("apply");
  });

  it("AC4: past days can't be changed", () => {
    expect(checkOffDecision({ date: "2026-10-25", kind: "cleaning" }, TODAY, "done")).toBe("past");
  });

  it("AC6: an occurrence the plan dropped is gone", () => {
    expect(checkOffDecision(null, TODAY, "done")).toBe("gone");
  });

  it("AC3: only cleaning tasks can be skipped", () => {
    expect(checkOffDecision({ date: TODAY, kind: "routine" }, TODAY, "skipped")).toBe("invalid");
    expect(checkOffDecision({ date: TODAY, kind: "cleaning" }, TODAY, "skipped")).toBe("apply");
  });
});
