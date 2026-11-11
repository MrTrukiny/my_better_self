import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PlanDayView } from "@/lib/scheduler/format";
import { PlanDay } from "./plan-day";

vi.mock("next/offline", () => ({ useOffline: () => false }));

const day: PlanDayView = {
  date: "2026-10-27",
  isToday: false,
  off: false,
  start: "06:30",
  end: "07:15",
  budget: 45,
  total: 38,
  cleaning: [
    {
      id: "a",
      kind: "cleaning",
      name: "Kitchen surface clean",
      minutes: 38,
      roomName: "Kitchen",
      itemName: null,
    },
  ],
  routines: [],
};

describe("PlanDay", () => {
  it("spec 007 AC4: shows the session window and the planned minutes", () => {
    render(<PlanDay day={day} />);
    expect(screen.getByText("06:30–07:15 · 38 of 45 min")).toBeInTheDocument();
  });

  it("AC4: says when the session overlaps another event, with its time and a fix", () => {
    render(<PlanDay day={day} overlap />);
    expect(
      screen.getByText(/Overlaps another event in your calendar \(06:30–07:15\)/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Change the start time" })).toHaveAttribute(
      "href",
      "/schedule",
    );
  });

  it("spec 015 AC6: labels each task with its person in the household view", () => {
    const shared: PlanDayView = {
      ...day,
      off: true,
      cleaning: day.cleaning.map((task) => ({ ...task, person: "Sam" })),
      routines: [
        {
          id: "r",
          kind: "routine",
          name: "Make the bed",
          minutes: 2,
          roomName: null,
          itemName: null,
          person: "Ana",
        },
      ],
    };
    render(<PlanDay day={shared} household overlap />);
    expect(screen.getByText("Kitchen · Sam")).toBeInTheDocument();
    expect(screen.getByText("Make the bed · Ana")).toBeInTheDocument();
    expect(screen.getByText("38 min planned")).toBeInTheDocument();
    expect(screen.queryByText("Day off")).toBeNull();
    expect(screen.queryByText(/Overlaps another event/)).toBeNull();
  });

  it("AC4: says nothing without an overlap, or on a day without cleaning", () => {
    const { unmount } = render(<PlanDay day={day} />);
    expect(screen.queryByText(/Overlaps another event/)).toBeNull();
    unmount();

    render(<PlanDay day={{ ...day, cleaning: [], total: 0 }} overlap />);
    expect(screen.queryByText(/Overlaps another event/)).toBeNull();
  });
});
