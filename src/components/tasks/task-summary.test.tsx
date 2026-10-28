import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskEntry } from "@/lib/tasks/queries";
import { TaskSummary } from "./proposal-card";

vi.mock("@/app/(app)/tasks/actions", () => ({}));
vi.mock("next/offline", () => ({ useOffline: () => false }));

const TASK: TaskEntry = {
  id: "t1",
  kind: "cleaning",
  name: "Mop the floor",
  minutes: 15,
  frequencyDays: 7,
  roomId: "r1",
  roomName: "Kitchen",
  itemId: null,
  itemName: null,
};

describe("TaskSummary", () => {
  it("spec 011 AC4, AC8: shows a calibrated estimate's note in the row", () => {
    render(
      <ul>
        <li>
          <TaskSummary entry={{ ...TASK, calibration: { from: 10, samples: 3 } }} />
        </li>
      </ul>,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent(
      "Adjusted from 10 to 15 min from your last 3 times",
    );
  });

  it("spec 011 AC5: shows no note for minutes set by hand", () => {
    render(<TaskSummary entry={{ ...TASK, calibration: null }} />);
    expect(screen.queryByText(/Adjusted from/)).toBeNull();
  });
});
