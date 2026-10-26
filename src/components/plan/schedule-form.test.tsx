import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionState } from "@/lib/inventory/action-state";
import { defaultSettings } from "@/lib/scheduler/settings";
import { ScheduleForm } from "./schedule-form";

vi.mock("next/offline", () => ({ useOffline: () => false }));

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const DEFAULTS = defaultSettings("UTC");

describe("ScheduleForm", () => {
  it("AC1: shows the defaults and submits each day, the budgets, and the device time zone", async () => {
    const action = vi.fn<Action>(async () => ({ status: "success" }));
    render(<ScheduleForm action={action} settings={DEFAULTS} />);

    expect(screen.getByRole("group", { name: "Cleaning days" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Monday" })).toBeChecked();
    expect(screen.getByLabelText("Sunday start time")).toHaveValue("06:30");
    expect(screen.getByLabelText("Weekday minutes")).toHaveValue(45);
    expect(screen.getByLabelText("Weekend minutes")).toHaveValue(60);

    await userEvent.click(screen.getByRole("checkbox", { name: "Wednesday" }));
    expect(screen.getByLabelText("Wednesday start time")).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved."));
    expect(screen.getByRole("link", { name: "See your week" })).toHaveAttribute("href", "/plan");
    const formData = action.mock.calls[0]?.[1];
    expect(formData?.get("on0")).toBe("on");
    expect(formData?.get("on2")).toBeNull();
    expect(formData?.get("start6")).toBe("06:30");
    expect(formData?.get("weekendMinutes")).toBe("60");
    expect(formData?.get("timeZone")).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it("AC1: links a field message to its control and moves focus there", async () => {
    const action = vi.fn<Action>(async () => ({
      status: "error",
      fieldErrors: { weekdayMinutes: "Enter whole minutes from 30 to 120." },
    }));
    render(<ScheduleForm action={action} settings={DEFAULTS} />);

    const minutes = screen.getByLabelText("Weekday minutes");
    await userEvent.clear(minutes);
    await userEvent.type(minutes, "200");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(minutes).toHaveAccessibleDescription("Enter whole minutes from 30 to 120."),
    );
    expect(minutes).toHaveFocus();
    expect(minutes).toHaveValue(200);
  });

  it("AC1: explains that at least one day must stay on", async () => {
    const action = vi.fn<Action>(async () => ({
      status: "error",
      fieldErrors: { days: "Turn on at least one day." },
    }));
    render(<ScheduleForm action={action} settings={DEFAULTS} />);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Monday" })).toHaveAccessibleDescription(
        "Turn on at least one day.",
      ),
    );
  });
});
