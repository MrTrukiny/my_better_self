import { describe, expect, it } from "vitest";
import { toDayNumber } from "./dates";
import { fullRange, type PersonState, pendingHouseholdRange } from "./household-range";
import { defaultSettings, PLAN_DAYS } from "./settings";

const MADRID = defaultSettings("Europe/Madrid");
// Wednesday 2026-10-21 in Madrid, before the 06:30 session.
const WEDNESDAY = toDayNumber("2026-10-21");
const EARLY = new Date("2026-10-21T05:00:00+02:00");
const LAST = WEDNESDAY + PLAN_DAYS - 1;

function person(id: string, state: Partial<PersonState> = {}): PersonState {
  return {
    id,
    settings: MADRID,
    plannedThrough: LAST,
    replannedOn: WEDNESDAY,
    todayStarted: false,
    ...state,
  };
}

describe("fullRange", () => {
  it("starts each person at their own first replan day", () => {
    const range = fullRange([person("a"), person("b", { todayStarted: true })], EARLY);
    expect(range).toEqual({
      from: WEDNESDAY,
      to: LAST,
      people: [
        { id: "a", settings: MADRID, start: WEDNESDAY },
        { id: "b", settings: MADRID, start: WEDNESDAY + 1 },
      ],
      full: true,
    });
  });

  it("is null without people", () => {
    expect(fullRange([], EARLY)).toBeNull();
  });
});

describe("pendingHouseholdRange", () => {
  it("is null when everyone's week is planned", () => {
    expect(pendingHouseholdRange([person("a"), person("b")], EARLY)).toBeNull();
  });

  it("replans everyone when anyone is on a new day", () => {
    const range = pendingHouseholdRange(
      [person("a"), person("b", { replannedOn: WEDNESDAY - 1 })],
      EARLY,
    );
    expect(range?.full).toBe(true);
    expect(range?.people.map((p) => p.start)).toEqual([WEDNESDAY, WEDNESDAY]);
  });

  it("fills only the missing days and keeps what others already have", () => {
    const range = pendingHouseholdRange(
      [person("a"), person("b", { plannedThrough: LAST - 2 })],
      EARLY,
    );
    expect(range).toEqual({
      from: LAST - 1,
      to: LAST,
      people: [
        { id: "a", settings: MADRID, start: LAST + 1 },
        { id: "b", settings: MADRID, start: LAST - 1 },
      ],
      full: false,
    });
  });
});
