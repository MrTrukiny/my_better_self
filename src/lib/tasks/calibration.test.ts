import { describe, expect, it } from "vitest";
import { calibrate, calibrationNote } from "./calibration";

describe("calibrate", () => {
  it("AC1: uses the median of the last 5 times once there are 3", () => {
    expect(calibrate({ minutes: 10, kind: "cleaning", times: [15, 14, 16] })).toEqual({
      minutes: 15,
      samples: 3,
    });
    expect(calibrate({ minutes: 10, kind: "cleaning", times: [20, 20, 21, 22, 25, 2, 2] })).toEqual(
      {
        minutes: 21,
        samples: 5,
      },
    );
  });

  it("AC1: rounds the median of an even count", () => {
    expect(calibrate({ minutes: 10, kind: "cleaning", times: [14, 15, 16, 17] })).toEqual({
      minutes: 16,
      samples: 4,
    });
  });

  it("AC1: keeps the estimate within the task's limits", () => {
    expect(calibrate({ minutes: 20, kind: "cleaning", times: [60, 50, 45] })?.minutes).toBe(30);
  });

  it("AC2: ignores changes under 2 minutes and under 20%", () => {
    expect(calibrate({ minutes: 10, kind: "cleaning", times: [11, 11, 11] })).toBeNull();
    expect(calibrate({ minutes: 10, kind: "cleaning", times: [10, 10, 10] })).toBeNull();
    // 2 minutes is enough on its own, and so is 20% of a short task.
    expect(calibrate({ minutes: 20, kind: "cleaning", times: [22, 22, 22] })?.minutes).toBe(22);
    expect(calibrate({ minutes: 5, kind: "cleaning", times: [6, 6, 6] })?.minutes).toBe(6);
  });

  it("AC7: needs 3 times and never calibrates routines", () => {
    expect(calibrate({ minutes: 10, kind: "cleaning", times: [20, 20] })).toBeNull();
    expect(calibrate({ minutes: 10, kind: "routine", times: [20, 20, 20] })).toBeNull();
  });
});

describe("calibrationNote", () => {
  it("AC4: says what changed and from how many times", () => {
    expect(calibrationNote({ from: 10, minutes: 15, samples: 3 })).toBe(
      "Adjusted from 10 to 15 min from your last 3 times",
    );
  });
});
