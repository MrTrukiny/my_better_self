import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlanViewToggle } from "./view-toggle";

vi.mock("next/offline", () => ({ useOffline: () => false }));

describe("PlanViewToggle", () => {
  it("spec 015 AC6: marks the current view and links to the other", () => {
    render(<PlanViewToggle household />);
    expect(screen.getByRole("link", { name: "Household" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Mine" })).toHaveAttribute("href", "/plan");
    expect(screen.getByRole("link", { name: "Mine" })).not.toHaveAttribute("aria-current");
  });
});
