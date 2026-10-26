import { describe, expect, it } from "vitest";
import { toDayNumber } from "./dates";
import { horizonRange, replanStart } from "./replan-start";
import { defaultSettings } from "./settings";

const MADRID = defaultSettings("Europe/Madrid");
// Wednesday 2026-10-21 in Madrid (UTC+2 before the clocks change on the 25th).
const WEDNESDAY = toDayNumber("2026-10-21");
const at = (time: string) => new Date(`2026-10-21T${time}:00+02:00`);

describe("replanStart", () => {
  it("AC6: starts today while today's start time hasn't passed", () => {
    expect(replanStart(MADRID, at("06:29"))).toBe(WEDNESDAY);
  });

  it("AC6: starts tomorrow once today's start time has passed", () => {
    expect(replanStart(MADRID, at("06:30"))).toBe(WEDNESDAY + 1);
    expect(replanStart(MADRID, at("23:00"))).toBe(WEDNESDAY + 1);
  });

  it("starts tomorrow when today is off", () => {
    const wednesdayOff = {
      ...MADRID,
      startTimes: MADRID.startTimes.map((time, i) => (i === 2 ? null : time)),
    };
    expect(replanStart(wednesdayOff, at("05:00"))).toBe(WEDNESDAY + 1);
  });

  it("uses the owner's time zone, not the server's", () => {
    // 23:30 UTC on Tuesday is already 01:30 on Wednesday in Madrid.
    expect(replanStart(MADRID, new Date("2026-10-20T23:30:00Z"))).toBe(WEDNESDAY);
  });
});

describe("horizonRange", () => {
  it("plans the days after the last planned one, through the seventh day", () => {
    expect(horizonRange(MADRID, WEDNESDAY + 3, at("12:00"))).toEqual({
      from: WEDNESDAY + 4,
      to: WEDNESDAY + 6,
    });
  });

  it("does nothing when the week is already planned", () => {
    expect(horizonRange(MADRID, WEDNESDAY + 6, at("12:00"))).toBeNull();
  });

  it("starts from today after a gap, since unplanned past days can't be done", () => {
    expect(horizonRange(MADRID, WEDNESDAY - 10, at("12:00"))).toEqual({
      from: WEDNESDAY,
      to: WEDNESDAY + 6,
    });
  });

  it("starts like a replan when nothing was planned yet", () => {
    expect(horizonRange(MADRID, null, at("12:00"))).toEqual({
      from: WEDNESDAY + 1,
      to: WEDNESDAY + 6,
    });
  });
});
