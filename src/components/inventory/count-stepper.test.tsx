import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CountStepper } from "./count-stepper";

function renderStepper(defaultValue = "1") {
  render(
    <form aria-label="item">
      <label htmlFor="count">Count</label>
      <CountStepper id="count" name="count" defaultValue={defaultValue} />
    </form>,
  );
  return {
    input: screen.getByRole("spinbutton", { name: "Count" }),
    decrease: screen.getByRole("button", { name: "Decrease count" }),
    increase: screen.getByRole("button", { name: "Increase count" }),
  };
}

describe("CountStepper", () => {
  it("AC3: steps up and down with the buttons", async () => {
    const { input, increase, decrease } = renderStepper("2");

    await userEvent.click(increase);
    expect(input).toHaveValue(3);
    await userEvent.click(decrease);
    await userEvent.click(decrease);
    expect(input).toHaveValue(1);
  });

  it("AC6: can't go below 1 or above 99 with the buttons", async () => {
    const low = renderStepper("1");
    expect(low.decrease).toBeDisabled();
    await userEvent.click(low.increase);
    expect(low.decrease).toBeEnabled();
  });

  it("disables increase at the maximum", () => {
    const { increase } = renderStepper("99");
    expect(increase).toBeDisabled();
  });

  it("AC8: accepts typed values and submits them under its name", async () => {
    const { input } = renderStepper();

    await userEvent.clear(input);
    await userEvent.type(input, "12");

    const form = screen.getByRole("form", { name: "item" }) as HTMLFormElement;
    expect(new FormData(form).get("count")).toBe("12");
  });
});
