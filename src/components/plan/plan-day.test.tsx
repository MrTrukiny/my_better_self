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
  end: "07:08",
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
  it("AC4: says when the session overlaps another event, with its time and a fix", () => {
    render(<PlanDay day={day} overlap />);
    expect(
      screen.getByText(/Overlaps another event in your calendar \(06:30–07:08\)/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Change the start time" })).toHaveAttribute(
      "href",
      "/schedule",
    );
  });

  it("AC4: says nothing without an overlap, or on a day without cleaning", () => {
    const { unmount } = render(<PlanDay day={day} />);
    expect(screen.queryByText(/Overlaps another event/)).toBeNull();
    unmount();

    render(<PlanDay day={{ ...day, cleaning: [], total: 0 }} overlap />);
    expect(screen.queryByText(/Overlaps another event/)).toBeNull();
  });
});
