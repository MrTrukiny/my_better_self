import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createItem } from "@/app/(app)/rooms/actions";
import type { ActionState } from "@/lib/inventory/action-state";
import { AddItemButton, ItemForm } from "./item-form";

vi.mock("next/offline", () => ({ useOffline: () => false }));
vi.mock("@/app/(app)/rooms/actions", () => ({ createItem: vi.fn(), updateItem: vi.fn() }));

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function successAction() {
  return vi.fn<Action>(async () => ({ status: "success", id: "i1" }));
}

const WINDOW = { type: "window", name: "Window", count: 1, note: null };

describe("ItemForm", () => {
  it("AC3: changing the type fills the name until the name is edited", async () => {
    render(<ItemForm action={successAction()} onSuccess={vi.fn()} submitLabel="Add item" />);

    await userEvent.click(screen.getByRole("combobox", { name: "Type" }));
    await userEvent.click(await screen.findByRole("option", { name: "Mirror" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Mirror");

    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "Hall mirror");
    await userEvent.click(screen.getByRole("combobox", { name: "Type" }));
    await userEvent.click(await screen.findByRole("option", { name: "Window" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Hall mirror");
  });

  it("AC3: submits type, name, count, and note with a default count of 1", async () => {
    const action = successAction();
    const onSuccess = vi.fn();
    render(<ItemForm action={action} onSuccess={onSuccess} submitLabel="Save" defaults={WINDOW} />);

    await userEvent.type(screen.getByLabelText(/Note/), "Sliding door side");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    const formData = action.mock.calls[0]?.[1];
    expect(Object.fromEntries(formData?.entries() ?? [])).toMatchObject({
      type: "window",
      name: "Window",
      count: "1",
      note: "Sliding door side",
    });
  });

  it("AC6: links field messages to their controls and keeps the entered values", async () => {
    const action = vi.fn<Action>(async () => ({
      status: "error",
      fieldErrors: { count: "Enter a whole number from 1 to 99." },
    }));
    render(<ItemForm action={action} onSuccess={vi.fn()} submitLabel="Save" defaults={WINDOW} />);

    const count = screen.getByRole("spinbutton", { name: "Count" });
    await userEvent.clear(count);
    await userEvent.type(count, "100");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(count).toHaveAttribute("aria-invalid", "true"));
    expect(count).toHaveAccessibleDescription("Enter a whole number from 1 to 99.");
    expect(count).toHaveValue(100);
    expect(count).toHaveFocus();
    expect(screen.getByLabelText("Name")).toHaveValue("Window");
  });

  it("AC3: after adding, 'Add another' resets the form with focus on the type picker", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    vi.mocked(createItem).mockResolvedValue({ status: "success", id: "i1" });
    render(<AddItemButton roomId="r1" />);

    await userEvent.click(screen.getByRole("button", { name: "Add item" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Type" }));
    await userEvent.click(await screen.findByRole("option", { name: "Shelf" }));
    const count = screen.getByRole("spinbutton", { name: "Count" });
    await userEvent.clear(count);
    await userEvent.type(count, "3");
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Added Shelf x3.");
    await userEvent.click(screen.getByRole("button", { name: "Add another" }));

    const type = await screen.findByRole("combobox", { name: "Type" });
    await waitFor(() => expect(type).toHaveFocus());
    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByRole("spinbutton", { name: "Count" })).toHaveValue(1);
    vi.unstubAllGlobals();
  });

  it("shows a type message when no type is chosen", async () => {
    const action = vi.fn<Action>(async () => ({
      status: "error",
      fieldErrors: { type: "Choose a type.", name: "Enter a name." },
    }));
    render(<ItemForm action={action} onSuccess={vi.fn()} submitLabel="Add item" />);

    await userEvent.click(screen.getByRole("button", { name: "Add item" }));

    const type = screen.getByRole("combobox", { name: "Type" });
    await waitFor(() => expect(type).toHaveAccessibleDescription("Choose a type."));
    expect(type).toHaveFocus();
  });
});
