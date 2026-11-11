import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionState } from "@/lib/inventory/action-state";
import { InviteForm } from "./invite-form";

vi.mock("next/offline", () => ({ useOffline: () => false }));
vi.mock("@/app/(app)/household/actions", () => ({ invitePerson: vi.fn() }));

describe("InviteForm", () => {
  it("AC1: submits the email, confirms it, and clears the field", async () => {
    const action = vi.fn(
      async (_prev: ActionState, _formData: FormData): Promise<ActionState> => ({
        status: "success",
      }),
    );
    render(<InviteForm action={action} full={false} />);

    const input = screen.getByLabelText("Invite by email");
    await userEvent.type(input, "sam@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Invited sam@example.com.");
    expect(action.mock.calls[0]?.[1].get("email")).toBe("sam@example.com");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("AC1: shows why an email can't be invited and keeps it", async () => {
    const problem = "This person already uses My Better Self with their own home.";
    const action = vi.fn(
      async (): Promise<ActionState> => ({
        status: "error",
        fieldErrors: { email: problem },
        values: { email: "sam@example.com" },
      }),
    );
    render(<InviteForm action={action} full={false} />);

    const input = screen.getByLabelText("Invite by email");
    await userEvent.type(input, "sam@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));

    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));
    expect(input).toHaveAccessibleDescription(expect.stringContaining(problem));
    expect(input).toHaveValue("sam@example.com");
    expect(input).toHaveFocus();
  });

  it("AC1: is disabled once the household has 5 people", () => {
    render(<InviteForm action={vi.fn()} full />);
    expect(screen.getByLabelText("Invite by email")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Invite" })).toBeDisabled();
    expect(screen.getByText("A household has at most 5 people.")).toBeInTheDocument();
  });
});
