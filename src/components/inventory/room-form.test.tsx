import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionState } from "@/lib/inventory/action-state";
import { DUPLICATE_ROOM_NAME } from "@/lib/inventory/schemas";
import { RoomForm } from "./room-form";

vi.mock("next/offline", () => ({ useOffline: () => false }));
vi.mock("@/app/(app)/rooms/actions", () => ({ createRoom: vi.fn(), renameRoom: vi.fn() }));

describe("RoomForm", () => {
  it("AC2: submits the name and reports success", async () => {
    const action = vi.fn(
      async (_prev: ActionState, _formData: FormData): Promise<ActionState> => ({
        status: "success",
        id: "r1",
      }),
    );
    const onSuccess = vi.fn();
    render(<RoomForm action={action} onSuccess={onSuccess} submitLabel="Add room" />);

    await userEvent.type(screen.getByLabelText("Name"), "Kitchen");
    await userEvent.click(screen.getByRole("button", { name: "Add room" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    const formData = action.mock.calls[0]?.[1];
    expect(formData?.get("name")).toBe("Kitchen");
  });

  it("AC6: shows a field message linked to the input and keeps the value", async () => {
    const action = vi.fn(
      async (): Promise<ActionState> => ({
        status: "error",
        fieldErrors: { name: DUPLICATE_ROOM_NAME },
        values: { name: "Kitchen" },
      }),
    );
    const onSuccess = vi.fn();
    render(<RoomForm action={action} onSuccess={onSuccess} submitLabel="Add room" />);

    const input = screen.getByLabelText("Name");
    await userEvent.type(input, "Kitchen");
    await userEvent.click(screen.getByRole("button", { name: "Add room" }));

    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));
    expect(input).toHaveAccessibleDescription(DUPLICATE_ROOM_NAME);
    expect(input).toHaveValue("Kitchen");
    expect(input).toHaveFocus();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows a form error when the save fails", async () => {
    const action = vi.fn(
      async (): Promise<ActionState> => ({
        status: "error",
        formError: "Couldn't save your changes. Try again.",
        values: { name: "Kitchen" },
      }),
    );
    render(<RoomForm action={action} onSuccess={vi.fn()} submitLabel="Save" />);

    await userEvent.type(screen.getByLabelText("Name"), "Kitchen");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Couldn't save your changes. Try again.")).toBeInTheDocument();
  });

  it("disables the submit button while saving", async () => {
    let resolve: (state: ActionState) => void = () => {};
    const action = vi.fn(
      () =>
        new Promise<ActionState>((done) => {
          resolve = done;
        }),
    );
    render(<RoomForm action={action} onSuccess={vi.fn()} submitLabel="Add room" />);

    await userEvent.type(screen.getByLabelText("Name"), "Kitchen");
    await userEvent.click(screen.getByRole("button", { name: "Add room" }));

    const busy = await screen.findByRole("button", { name: "Saving..." });
    expect(busy).toBeDisabled();
    resolve({ status: "success" });
  });

  it("prefills the current name when renaming", () => {
    render(
      <RoomForm action={vi.fn()} onSuccess={vi.fn()} submitLabel="Save" defaultName="Kitchen" />,
    );
    expect(screen.getByLabelText("Name")).toHaveValue("Kitchen");
  });
});
