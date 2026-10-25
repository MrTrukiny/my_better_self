import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditNotice, useEditsDisabled } from "./edit-guard";

const { offline } = vi.hoisted(() => ({ offline: { value: false } }));

vi.mock("next/offline", () => ({
  useOffline: () => offline.value,
}));

function AddButton() {
  const disabled = useEditsDisabled();
  return (
    <button type="button" disabled={disabled}>
      Add room
    </button>
  );
}

beforeEach(() => {
  offline.value = false;
});

describe("edit guard", () => {
  it("leaves edits enabled and shows no notice when online", () => {
    render(
      <>
        <EditNotice />
        <AddButton />
      </>,
    );
    expect(screen.getByRole("button", { name: "Add room" })).toBeEnabled();
    expect(screen.queryByText(/need a connection/)).not.toBeInTheDocument();
  });

  it("AC7: disables edits and explains why when offline", () => {
    offline.value = true;
    render(
      <>
        <EditNotice />
        <AddButton />
      </>,
    );
    expect(screen.getByRole("button", { name: "Add room" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "You're offline. You can browse your inventory, but changes need a connection.",
    );
  });
});
