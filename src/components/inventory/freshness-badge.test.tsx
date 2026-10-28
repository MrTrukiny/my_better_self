import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FreshnessBadge } from "./freshness-badge";

describe("FreshnessBadge", () => {
  it("AC1: shows each state with a label and an icon", () => {
    for (const [state, label] of [
      ["fresh", "Fresh"],
      ["good", "Good"],
      ["due", "Due"],
      ["overdue", "Overdue"],
    ] as const) {
      const { container, unmount } = render(<FreshnessBadge state={state} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(container.querySelector("svg[aria-hidden]")).not.toBeNull();
      unmount();
    }
  });

  it("AC6: a room without cleaning tasks says so", () => {
    render(<FreshnessBadge state={null} />);
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
  });
});
