import { describe, expect, it } from "vitest";
import {
  clearTimer,
  elapsedMs,
  formatElapsed,
  parseTimers,
  pauseTimer,
  runningTimer,
  startTimer,
  stopTimer,
  timerMinutes,
} from "./timers";

const DATE = "2026-11-10";
const MINUTE = 60_000;

describe("timers", () => {
  it("AC1: a started timer counts from its start", () => {
    const timers = startTimer({}, "a", DATE, 1_000);
    expect(timers).toEqual({ a: { date: DATE, elapsedMs: 0, startedAt: 1_000 } });
    expect(elapsedMs(timers.a, 1_000 + 5 * MINUTE)).toBe(5 * MINUTE);
    expect(runningTimer(timers)).toBe("a");
  });

  it("AC3: pausing keeps the time, and resuming continues from it", () => {
    let timers = startTimer({}, "a", DATE, 0);
    timers = pauseTimer(timers, "a", 3 * MINUTE);
    expect(timers.a).toEqual({ date: DATE, elapsedMs: 3 * MINUTE, startedAt: null });
    expect(elapsedMs(timers.a, 60 * MINUTE)).toBe(3 * MINUTE);
    expect(runningTimer(timers)).toBeNull();
    timers = startTimer(timers, "a", DATE, 10 * MINUTE);
    expect(elapsedMs(timers.a, 12 * MINUTE)).toBe(5 * MINUTE);
  });

  it("AC2: starting another timer pauses the running one", () => {
    let timers = startTimer({}, "a", DATE, 0);
    timers = startTimer(timers, "b", DATE, 4 * MINUTE);
    expect(timers.a).toEqual({ date: DATE, elapsedMs: 4 * MINUTE, startedAt: null });
    expect(runningTimer(timers)).toBe("b");
  });

  it("AC4: stopping returns whole minutes and removes the timer", () => {
    let timers = startTimer({}, "a", DATE, 0);
    timers = startTimer(timers, "b", DATE, MINUTE);
    const stopped = stopTimer(timers, "a", 99 * MINUTE);
    expect(stopped).toEqual({ timers: { b: timers.b }, minutes: 1, capped: false });
    expect(stopTimer({}, "a", 0)).toBeNull();
  });

  it("AC4: rounds to the nearest minute, at least 1 and at most 240", () => {
    expect(timerMinutes(10 * 1000)).toEqual({ minutes: 1, capped: false });
    expect(timerMinutes(12 * MINUTE + 29_000)).toEqual({ minutes: 12, capped: false });
    expect(timerMinutes(12 * MINUTE + 30_000)).toEqual({ minutes: 13, capped: false });
    expect(timerMinutes(240 * MINUTE)).toEqual({ minutes: 240, capped: false });
    expect(timerMinutes(241 * MINUTE)).toEqual({ minutes: 240, capped: true });
  });

  it("AC5: clearing removes a timer", () => {
    const timers = startTimer({}, "a", DATE, 0);
    expect(clearTimer(timers, "a")).toEqual({});
    expect(clearTimer(timers, "z")).toBe(timers);
  });

  it("never counts backwards when the clock moves back", () => {
    const timers = startTimer({}, "a", DATE, 10 * MINUTE);
    expect(elapsedMs(timers.a, 5 * MINUTE)).toBe(0);
  });
});

describe("formatElapsed", () => {
  it("shows minutes and seconds, and hours once past an hour", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(4 * MINUTE + 12_900)).toBe("04:12");
    expect(formatElapsed(75 * MINUTE + 5_000)).toBe("1:15:05");
  });
});

describe("parseTimers", () => {
  it("AC7: reads what was stored and ignores corrupt entries", () => {
    const stored = JSON.stringify({
      a: { date: DATE, elapsedMs: 1000, startedAt: null },
      b: { date: DATE, elapsedMs: "x", startedAt: null },
      c: { date: DATE, elapsedMs: 0, startedAt: 5 },
    });
    expect(parseTimers(stored)).toEqual({
      a: { date: DATE, elapsedMs: 1000, startedAt: null },
      c: { date: DATE, elapsedMs: 0, startedAt: 5 },
    });
    expect(parseTimers("not json")).toEqual({});
    expect(parseTimers(null)).toEqual({});
  });
});
