import { describe, expect, it } from "vitest";
import {
  calendarSummary,
  homeProfileSummary,
  notificationsSummary,
  scheduleSummary,
} from "./summary";

const WEEKDAYS_ONLY = ["06:30", "06:30", "06:30", "06:30", "06:30", null, null];

function settings(startTimes: (string | null)[], weekdayMinutes = 45, weekendMinutes = 60) {
  return { startTimes, weekdayMinutes, weekendMinutes };
}

describe("scheduleSummary", () => {
  it("AC5: says when there is no schedule yet", () => {
    expect(scheduleSummary(null)).toBe("Not set");
  });

  it("AC4: names the days, the shared start time, and the minutes", () => {
    expect(scheduleSummary(settings(WEEKDAYS_ONLY))).toBe("Weekdays 06:30 · 45 min");
    expect(scheduleSummary(settings([null, null, null, null, null, "09:00", "09:00"]))).toBe(
      "Weekends 09:00 · 60 min",
    );
    expect(scheduleSummary(settings(Array(7).fill("06:30")))).toBe("Every day 06:30 · 45–60 min");
    expect(scheduleSummary(settings(Array(7).fill("06:30"), 60, 60))).toBe(
      "Every day 06:30 · 60 min",
    );
  });

  it("AC4: leaves the time out when days start at different times", () => {
    expect(
      scheduleSummary(settings(["06:30", "07:00", "06:30", null, "06:30", null, null], 30)),
    ).toBe("4 days a week · 30 min");
  });

  it("AC4: a week with no cleaning days", () => {
    expect(scheduleSummary(settings(Array(7).fill(null)))).toBe("No cleaning days");
  });
});

describe("calendarSummary", () => {
  it("AC4: connected, not connected, or needing attention", () => {
    expect(calendarSummary(null)).toBe("Not connected");
    expect(calendarSummary({ status: "ok" })).toBe("Connected");
    expect(calendarSummary({ status: "reauth" })).toBe("Needs reconnecting");
    expect(calendarSummary({ status: "error" })).toBe("Sync problem");
  });
});

describe("homeProfileSummary", () => {
  it("AC4: counts the helpers and mentions the note", () => {
    expect(homeProfileSummary({ helpers: [], note: null })).toBe("No helpers");
    expect(homeProfileSummary({ helpers: ["dishwasher"], note: null })).toBe("1 helper");
    expect(homeProfileSummary({ helpers: ["dishwasher", "dryer"], note: "Cat at home" })).toBe(
      "2 helpers · Note added",
    );
  });
});

describe("notificationsSummary", () => {
  const prefs = {
    beforeEnabled: true,
    beforeMinutes: 15,
    eveningEnabled: true,
    eveningTime: "20:00",
  };

  it("says when this device is off", () => {
    expect(notificationsSummary(prefs, false)).toBe("Off on this device");
  });

  it("lists the reminders that are on", () => {
    expect(notificationsSummary(prefs, true)).toBe("Before my session, 15 min · Evening, 20:00");
    expect(notificationsSummary({ ...prefs, beforeMinutes: 0, eveningEnabled: false }, true)).toBe(
      "Before my session, at start",
    );
    expect(
      notificationsSummary({ ...prefs, beforeEnabled: false, eveningEnabled: false }, true),
    ).toBe("On, no reminders");
  });
});
