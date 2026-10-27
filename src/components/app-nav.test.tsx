import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NavLinks } from "./app-nav";

vi.mock("next/offline", () => ({ useOffline: () => false }));

describe("NavLinks", () => {
  it.each(["top", "tabs"] as const)(
    "AC1, AC2, AC8: the %s variant is a Main landmark with the five destinations in order",
    (variant) => {
      render(<NavLinks variant={variant} current="/" />);
      const nav = screen.getByRole("navigation", { name: "Main" });
      const links = within(nav).getAllByRole("link");
      expect(links.map((link) => link.textContent)).toEqual([
        "Today",
        "Plan",
        "Tasks",
        "Rooms",
        "Settings",
      ]);
      expect(links.map((link) => link.getAttribute("href"))).toEqual([
        "/",
        "/plan",
        "/tasks",
        "/rooms",
        "/settings",
      ]);
    },
  );

  it("AC3: marks the current destination only", () => {
    render(<NavLinks variant="tabs" current="/settings" />);
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Today" })).not.toHaveAttribute("aria-current");
  });

  it("marks nothing outside the navigation", () => {
    render(<NavLinks variant="top" current={null} />);
    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });
});
