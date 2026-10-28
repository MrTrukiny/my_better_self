import { describe, expect, it } from "vitest";
import { calendarSyncSelectUrl, googleCalendarUrl, lastSyncedLine } from "./format";

describe("Google Calendar links", () => {
  it("open the owner's own account", () => {
    expect(googleCalendarUrl("owner+home@example.com")).toBe(
      "https://calendar.google.com/calendar/r?authuser=owner%2Bhome%40example.com",
    );
    expect(calendarSyncSelectUrl("owner@example.com")).toBe(
      "https://calendar.google.com/calendar/syncselect?authuser=owner%40example.com",
    );
  });
});

const now = new Date("2026-10-27T14:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const MINUTE = 60_000;

describe("lastSyncedLine", () => {
  it("spec 007 AC7: says when the calendar last synced, in words", () => {
    expect(lastSyncedLine(ago(20_000), now)).toBe("Last synced just now");
    expect(lastSyncedLine(ago(MINUTE), now)).toBe("Last synced 1 minute ago");
    expect(lastSyncedLine(ago(10 * MINUTE), now)).toBe("Last synced 10 minutes ago");
    expect(lastSyncedLine(ago(60 * MINUTE), now)).toBe("Last synced 1 hour ago");
    expect(lastSyncedLine(ago(3 * 60 * MINUTE + 20 * MINUTE), now)).toBe("Last synced 3 hours ago");
    expect(lastSyncedLine(ago(24 * 60 * MINUTE), now)).toBe("Last synced 1 day ago");
    expect(lastSyncedLine(ago(2 * 24 * 60 * MINUTE + MINUTE), now)).toBe("Last synced 2 days ago");
  });

  it("spec 007 AC7: says when it never synced", () => {
    expect(lastSyncedLine(null, now)).toBe("Not synced yet");
  });

  it("treats a sync stamped slightly ahead of the clock as just now", () => {
    expect(lastSyncedLine(new Date(now.getTime() + 5_000), now)).toBe("Last synced just now");
  });
});
