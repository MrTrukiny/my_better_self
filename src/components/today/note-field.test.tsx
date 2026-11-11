import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NoteField } from "./note-field";

function renderField(value: string | null = null) {
  const onSave = vi.fn();
  const view = render(
    <NoteField taskName="Clean stove" value={value} disabled={false} onSave={onSave} />,
  );
  return {
    onSave,
    rerender: (next: string | null) =>
      view.rerender(
        <NoteField taskName="Clean stove" value={next} disabled={false} onSave={onSave} />,
      ),
  };
}

describe("NoteField", () => {
  it("AC6: adds a note on Enter and returns focus to its button", async () => {
    const user = userEvent.setup();
    const { onSave, rerender } = renderField();
    await user.click(screen.getByRole("button", { name: "Add note for Clean stove" }));
    const field = screen.getByRole("textbox", { name: "Note for Clean stove" });
    expect(field).toHaveFocus();
    await user.type(field, "  Full deep clean  {Enter}");
    expect(onSave).toHaveBeenCalledWith("Full deep clean");
    rerender("Full deep clean");
    expect(screen.getByText("Full deep clean")).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit note for Clean stove" })).toHaveFocus();
  });

  it("AC6: edits a note on blur and clears it when emptied", async () => {
    const user = userEvent.setup();
    const { onSave } = renderField("Full deep clean");
    await user.click(screen.getByRole("button", { name: "Edit note for Clean stove" }));
    const field = screen.getByRole("textbox", { name: "Note for Clean stove" });
    expect(field).toHaveValue("Full deep clean");
    await user.clear(field);
    await user.tab();
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it("AC6: doesn't save an unchanged note, and Escape cancels", async () => {
    const user = userEvent.setup();
    const { onSave } = renderField("Same");
    await user.click(screen.getByRole("button", { name: "Edit note for Clean stove" }));
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Edit note for Clean stove" }));
    await user.keyboard(" more{Escape}");
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Same")).toBeVisible();
  });

  it("AC6: a note over 200 characters shows a message and isn't saved", async () => {
    const user = userEvent.setup();
    const { onSave } = renderField();
    await user.click(screen.getByRole("button", { name: "Add note for Clean stove" }));
    const field = screen.getByRole("textbox", { name: "Note for Clean stove" });
    await user.click(field);
    await user.paste("x".repeat(201));
    await user.keyboard("{Enter}");
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Keep the note to 200 characters or fewer.",
    );
    expect(field).toHaveAttribute("aria-invalid", "true");
  });
});
