import { describe, expect, it } from "vitest";
import { parseInput } from "@/lib/inventory/schemas";
import {
  CLEANING_MINUTES_MAX,
  FREQUENCY_DAYS_MAX,
  ROUTINE_MINUTES_MAX,
  TASK_NAME_MAX,
} from "./limits";
import { HOME_NOTE_MAX, homeProfileInputSchema, taskInputSchema } from "./schemas";

const validTask = { name: " Wipe the mirror ", kind: "cleaning", minutes: "5", frequencyDays: "7" };

describe("taskInputSchema", () => {
  it("AC5: parses a task edit into trimmed, typed values", () => {
    expect(parseInput(taskInputSchema, validTask)).toEqual({
      ok: true,
      data: { name: "Wipe the mirror", kind: "cleaning", minutes: 5, frequencyDays: 7 },
    });
  });

  it("requires a name and caps its length", () => {
    expect(parseInput(taskInputSchema, { ...validTask, name: "  " })).toMatchObject({
      ok: false,
      fieldErrors: { name: "Enter a name." },
    });
    expect(parseInput(taskInputSchema, { ...validTask, name: "a".repeat(TASK_NAME_MAX) }).ok).toBe(
      true,
    );
    expect(
      parseInput(taskInputSchema, { ...validTask, name: "a".repeat(TASK_NAME_MAX + 1) }).ok,
    ).toBe(false);
  });

  it("rejects an unknown kind", () => {
    expect(parseInput(taskInputSchema, { ...validTask, kind: "chore" })).toMatchObject({
      ok: false,
      fieldErrors: { kind: "Choose cleaning task or routine." },
    });
  });

  it(`AC3: caps cleaning tasks at ${CLEANING_MINUTES_MAX} minutes and routines at ${ROUTINE_MINUTES_MAX}`, () => {
    const cleaning = (minutes: number) =>
      parseInput(taskInputSchema, { ...validTask, minutes: String(minutes) });
    const routine = (minutes: number) =>
      parseInput(taskInputSchema, { ...validTask, kind: "routine", minutes: String(minutes) });

    expect(cleaning(1).ok).toBe(true);
    expect(cleaning(CLEANING_MINUTES_MAX).ok).toBe(true);
    expect(cleaning(0)).toMatchObject({
      ok: false,
      fieldErrors: { minutes: `Enter a whole number from 1 to ${CLEANING_MINUTES_MAX}.` },
    });
    expect(cleaning(CLEANING_MINUTES_MAX + 1).ok).toBe(false);
    expect(routine(ROUTINE_MINUTES_MAX).ok).toBe(true);
    expect(routine(ROUTINE_MINUTES_MAX + 1)).toMatchObject({
      ok: false,
      fieldErrors: { minutes: `Enter a whole number from 1 to ${ROUTINE_MINUTES_MAX}.` },
    });
  });

  it(`AC3: accepts frequencies from 1 to ${FREQUENCY_DAYS_MAX} whole days`, () => {
    const every = (frequencyDays: string) =>
      parseInput(taskInputSchema, { ...validTask, frequencyDays });

    expect(every("1").ok).toBe(true);
    expect(every(String(FREQUENCY_DAYS_MAX)).ok).toBe(true);
    for (const invalid of ["0", String(FREQUENCY_DAYS_MAX + 1), "2.5", "", "weekly"]) {
      expect(every(invalid)).toMatchObject({
        ok: false,
        fieldErrors: { frequencyDays: `Enter a whole number from 1 to ${FREQUENCY_DAYS_MAX}.` },
      });
    }
  });
});

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
