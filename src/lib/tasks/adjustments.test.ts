import { describe, expect, it } from "vitest";
import {
  ADJUSTMENTS,
  changeLabel,
  evidenceLine,
  qualifies,
  reviewLine,
  type TaskHistory,
} from "./adjustments";

const history = (times: number[], notes: string[] = []): TaskHistory => ({
  times: times.map((minutes, i) => ({
    date: `2026-10-${String(20 - i).padStart(2, "0")}`,
    minutes,
  })),
  notes: notes.map((note, i) => ({ date: `2026-10-${String(20 - i).padStart(2, "0")}`, note })),
});

describe("qualifies", () => {
  it("AC1: needs 3 recorded times or a note", () => {
    expect(qualifies(history([10, 12]))).toBe(false);
    expect(qualifies(history([10, 12, 14]))).toBe(true);
    expect(qualifies(history([], ["Full deep clean"]))).toBe(true);
    expect(qualifies(history([]))).toBe(false);
    expect(ADJUSTMENTS.minTimes).toBe(3);
  });
});

describe("reviewLine", () => {
  it("AC1: says how many tasks it reviews, or how to get suggestions", () => {
    expect(reviewLine(4)).toBe("Reviews 4 tasks with recorded times or notes");
    expect(reviewLine(1)).toBe("Reviews 1 task with recorded times or notes");
    expect(reviewLine(0)).toBe("Record times or add notes to get suggestions.");
  });
});

describe("evidenceLine", () => {
  it("AC3: lists the latest 5 times oldest first, then the notes with their dates", () => {
    expect(evidenceLine(history([15, 22, 15, 16, 14, 30], ["Full deep clean"]))).toBe(
      "Last 5: 14, 16, 15, 22, 15 min · Note on Oct 20: Full deep clean",
    );
  });

  it("AC3: works with only notes, or with fewer times", () => {
    expect(evidenceLine(history([], ["Moved the sofa", "Guests"]))).toBe(
      "Note on Oct 20: Moved the sofa · Note on Oct 19: Guests",
    );
    expect(evidenceLine(history([12, 10, 11]))).toBe("Last 3: 11, 10, 12 min");
  });

  it("AC3: shows at most 2 notes", () => {
    expect(evidenceLine(history([], ["a", "b", "c"]))).toBe(
      "Note on Oct 20: a · Note on Oct 19: b",
    );
  });
});

describe("changeLabel", () => {
  const current = { minutes: 10, frequencyDays: 7 };

  it("AC3: describes each kind of change", () => {
    expect(changeLabel({ change: "minutes", minutes: 15 }, current)).toBe("10 → 15 min");
    expect(changeLabel({ change: "frequency", frequencyDays: 14 }, current)).toBe(
      "Every 7 → 14 days",
    );
    expect(
      changeLabel(
        { change: "new_task", name: "Deep clean the oven", minutes: 30, frequencyDays: 30 },
        current,
      ),
    ).toBe("New: Deep clean the oven, 30 min, every 30 days");
  });

  it("AC3: says every day for a daily frequency", () => {
    expect(changeLabel({ change: "frequency", frequencyDays: 1 }, current)).toBe(
      "Every 7 days → every day",
    );
    expect(
      changeLabel({ change: "new_task", name: "Wipe", minutes: 2, frequencyDays: 1 }, current),
    ).toBe("New: Wipe, 2 min, every day");
  });
});
