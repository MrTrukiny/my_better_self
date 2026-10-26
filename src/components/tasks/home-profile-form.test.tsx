import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionState } from "@/lib/inventory/action-state";
import { HomeProfileForm } from "./home-profile-form";

vi.mock("next/offline", () => ({ useOffline: () => false }));
vi.mock("@/app/(app)/tasks/actions", () => ({ saveHomeProfile: vi.fn() }));

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

describe("HomeProfileForm", () => {
  it("AC1: shows the saved helpers and note, and submits the changes", async () => {
    const action = vi.fn<Action>(async () => ({ status: "success" }));
    render(
      <HomeProfileForm action={action} profile={{ helpers: ["robot-vacuum"], note: "Two cats" }} />,
    );

    const group = screen.getByRole("group", { name: "Helpers" });
    expect(screen.getByRole("checkbox", { name: "Robot vacuum" })).toBeChecked();
    expect(group).toBeInTheDocument();
    expect(screen.getByLabelText(/Note/)).toHaveValue("Two cats");

    await userEvent.click(screen.getByRole("checkbox", { name: "Dishwasher" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved."));
    const formData = action.mock.calls[0]?.[1];
    expect(formData?.getAll("helpers")).toEqual(["robot-vacuum", "dishwasher"]);
    expect(formData?.get("note")).toBe("Two cats");
  });

  it("AC1: links the note message to the field and keeps the entered values", async () => {
    const action = vi.fn<Action>(async () => ({
      status: "error",
      fieldErrors: { note: "Use 500 characters or fewer." },
    }));
    render(<HomeProfileForm action={action} profile={{ helpers: [], note: null }} />);

    const note = screen.getByLabelText(/Note/);
    await userEvent.type(note, "Long note");
    await userEvent.click(screen.getByRole("checkbox", { name: "Dryer" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(note).toHaveAccessibleDescription("Use 500 characters or fewer."));
    expect(note).toHaveFocus();
    expect(note).toHaveValue("Long note");
    expect(screen.getByRole("checkbox", { name: "Dryer" })).toBeChecked();
  });
});
