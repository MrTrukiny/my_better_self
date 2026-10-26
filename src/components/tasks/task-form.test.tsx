import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionState } from "@/lib/inventory/action-state";
import { TaskForm } from "./task-form";

vi.mock("next/offline", () => ({ useOffline: () => false }));

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const MIRROR = { name: "Wipe the mirror", kind: "cleaning" as const, minutes: 3, frequencyDays: 7 };

describe("TaskForm", () => {
  it("AC5: submits name, kind, minutes, and frequency", async () => {
    const action = vi.fn<Action>(async () => ({ status: "success" }));
    const onSuccess = vi.fn();
    render(<TaskForm action={action} onSuccess={onSuccess} defaults={MIRROR} />);

    await userEvent.click(screen.getByRole("radio", { name: "Routine" }));
    const minutes = screen.getByRole("spinbutton", { name: "Minutes" });
    await userEvent.clear(minutes);
    await userEvent.type(minutes, "45");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    const formData = action.mock.calls[0]?.[1];
    expect(Object.fromEntries(formData?.entries() ?? [])).toEqual({
      name: "Wipe the mirror",
      kind: "routine",
      minutes: "45",
      frequencyDays: "7",
    });
  });

  it("shows the minutes cap for the chosen kind", async () => {
    render(<TaskForm action={vi.fn<Action>()} onSuccess={vi.fn()} defaults={MIRROR} />);
    const minutes = screen.getByRole("spinbutton", { name: "Minutes" });
    expect(minutes).toHaveAccessibleDescription(/up to 30/i);

    await userEvent.click(screen.getByRole("radio", { name: "Routine" }));
    expect(minutes).toHaveAccessibleDescription(/up to 120/i);
  });

  it("AC9: links field messages to their controls, focuses the first, and keeps the values", async () => {
    const action = vi.fn<Action>(async () => ({
      status: "error",
      fieldErrors: { frequencyDays: "Enter a whole number from 1 to 365." },
    }));
    render(<TaskForm action={action} onSuccess={vi.fn()} defaults={MIRROR} />);

    const frequency = screen.getByRole("spinbutton", { name: "Every how many days" });
    await userEvent.clear(frequency);
    await userEvent.type(frequency, "400");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(frequency).toHaveAttribute("aria-invalid", "true"));
    expect(frequency).toHaveAccessibleDescription("Enter a whole number from 1 to 365.");
    expect(frequency).toHaveFocus();
    expect(frequency).toHaveValue(400);
    expect(screen.getByLabelText("Name")).toHaveValue("Wipe the mirror");
  });
});
