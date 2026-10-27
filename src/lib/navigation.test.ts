import { describe, expect, it } from "vitest";
import { NAV_ITEMS, sectionFor } from "./navigation";

describe("NAV_ITEMS", () => {
  it("lists the destinations from daily use to setup", () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      "Today",
      "Plan",
      "Tasks",
      "Rooms",
      "Settings",
    ]);
  });
});

describe("sectionFor", () => {
  it("AC3: maps every page to the destination it belongs to", () => {
    expect(sectionFor("/")).toBe("/");
    expect(sectionFor("/plan")).toBe("/plan");
    expect(sectionFor("/tasks")).toBe("/tasks");
    expect(sectionFor("/tasks/review")).toBe("/tasks");
    expect(sectionFor("/rooms")).toBe("/rooms");
    expect(sectionFor("/rooms/abc")).toBe("/rooms");
    expect(sectionFor("/settings")).toBe("/settings");
    expect(sectionFor("/schedule")).toBe("/settings");
    expect(sectionFor("/home-profile")).toBe("/settings");
  });

  it("matches whole segments only", () => {
    expect(sectionFor("/planner")).toBeNull();
    expect(sectionFor("/privacy")).toBeNull();
  });
});
