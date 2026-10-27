import { describe, expect, it } from "vitest";
import { busyCalendarIds, overlapsBusy } from "./overlap";

const session = {
  startsAt: new Date("2026-10-27T11:30:00Z"),
  endsAt: new Date("2026-10-27T12:08:00Z"),
};

const busy = (start: string, end: string) => ({ start: new Date(start), end: new Date(end) });

describe("overlapsBusy", () => {
  it("AC4: flags a busy time inside, around, or across either end of the session", () => {
    expect(overlapsBusy(session, [busy("2026-10-27T11:40:00Z", "2026-10-27T11:50:00Z")])).toBe(
      true,
    );
    expect(overlapsBusy(session, [busy("2026-10-27T11:00:00Z", "2026-10-27T13:00:00Z")])).toBe(
      true,
    );
    expect(overlapsBusy(session, [busy("2026-10-27T11:00:00Z", "2026-10-27T11:31:00Z")])).toBe(
      true,
    );
    expect(overlapsBusy(session, [busy("2026-10-27T12:07:00Z", "2026-10-27T13:00:00Z")])).toBe(
      true,
    );
  });

  it("AC4: doesn't flag busy times that only touch the session's edges", () => {
    expect(overlapsBusy(session, [busy("2026-10-27T11:00:00Z", "2026-10-27T11:30:00Z")])).toBe(
      false,
    );
    expect(overlapsBusy(session, [busy("2026-10-27T12:08:00Z", "2026-10-27T13:00:00Z")])).toBe(
      false,
    );
  });

  it("spec 007 AC3: flags a busy time that starts after the planned tasks but within the block", () => {
    // 38 planned minutes end at 12:08Z; the 45-minute block ends at 12:15Z.
    const block = { startsAt: session.startsAt, endsAt: new Date("2026-10-27T12:15:00Z") };
    expect(overlapsBusy(block, [busy("2026-10-27T12:10:00Z", "2026-10-27T12:30:00Z")])).toBe(true);
    expect(overlapsBusy(block, [busy("2026-10-27T12:15:00Z", "2026-10-27T12:30:00Z")])).toBe(false);
  });

  it("AC4: is clear without busy times", () => {
    expect(overlapsBusy(session, [])).toBe(false);
  });
});

describe("busyCalendarIds", () => {
  it("AC4: reads every selected calendar except Cleaning", () => {
    expect(
      busyCalendarIds(
        [
          { id: "me@example.com", summary: "Me", selected: true },
          { id: "cleaning", summary: "Cleaning", selected: true },
          { id: "work", summary: "Work", selected: true },
          { id: "hidden", summary: "Holidays", selected: false },
        ],
        "cleaning",
      ),
    ).toEqual(["me@example.com", "work"]);
  });
});
