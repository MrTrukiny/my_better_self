import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GenerateState } from "@/lib/tasks/generate-state";
import { SuggestAdjustmentsButton } from "./suggest-adjustments-button";

const offline = vi.hoisted(() => ({ value: false }));
vi.mock("next/offline", () => ({ useOffline: () => offline.value }));

const done = (state: GenerateState) => vi.fn(async () => state);

describe("SuggestAdjustmentsButton", () => {
  it("AC3: announces how many adjustments were suggested", async () => {
    const user = userEvent.setup();
    render(<SuggestAdjustmentsButton action={done({ status: "success", count: 2 })} />);
    await user.click(screen.getByRole("button", { name: "Suggest adjustments" }));
    expect(await screen.findByRole("status")).toHaveTextContent("2 adjustments suggested.");
  });

  it("AC5: says when there is nothing to adjust", async () => {
    const user = userEvent.setup();
    render(<SuggestAdjustmentsButton action={done({ status: "success", count: 0 })} />);
    await user.click(screen.getByRole("button", { name: "Suggest adjustments" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your tasks match your times. Nothing to adjust.",
    );
  });

  it("AC5: offers to try again after a failure", async () => {
    const user = userEvent.setup();
    const action = done({ status: "error", formError: "Couldn't suggest adjustments. Try again." });
    render(<SuggestAdjustmentsButton action={action} />);
    await user.click(screen.getByRole("button", { name: "Suggest adjustments" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't suggest adjustments.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("AC1: explains why it is unavailable when nothing qualifies", () => {
    render(
      <SuggestAdjustmentsButton
        action={done({ status: "success", count: 0 })}
        unavailableReason="Record times or add notes to get suggestions."
      />,
    );
    const button = screen.getByRole("button", { name: "Suggest adjustments" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Record times or add notes to get suggestions.");
  });

  it("AC7: is disabled offline", () => {
    offline.value = true;
    render(<SuggestAdjustmentsButton action={done({ status: "success", count: 0 })} />);
    expect(screen.getByRole("button", { name: "Suggest adjustments" })).toBeDisabled();
    offline.value = false;
  });
});
