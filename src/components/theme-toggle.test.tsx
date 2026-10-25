import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./theme-toggle";

const setTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme }),
}));

describe("ThemeToggle", () => {
  it("switches from light to dark", async () => {
    render(<ThemeToggle />);

    await userEvent.click(screen.getByRole("button", { name: "Toggle color theme" }));

    expect(setTheme).toHaveBeenCalledWith("dark");
  });
});
