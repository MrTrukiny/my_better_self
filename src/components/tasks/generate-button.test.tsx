import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerateState } from "@/lib/tasks/generate-state";
import { GenerateButton } from "./generate-button";

vi.mock("next/offline", () => ({ useOffline: () => false }));

function deferred() {
  let resolve: (state: GenerateState) => void = () => {};
  const promise = new Promise<GenerateState>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("GenerateButton", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("AC2: shows progress, can't be triggered twice, and announces the result", async () => {
    const pending = deferred();
    const action = vi.fn(() => pending.promise);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<GenerateButton action={action} scopeLabel="the whole home" />);

    const button = screen.getByRole("button", { name: "Propose tasks" });
    await user.click(button);
    expect(screen.getByRole("button", { name: /Reading your inventory/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Reading your inventory/ }));
    expect(action).toHaveBeenCalledOnce();

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByRole("button", { name: /Proposing tasks/ })).toBeDisabled();

    await act(async () => pending.resolve({ status: "success", count: 12 }));
    expect(screen.getByRole("status")).toHaveTextContent("12 tasks proposed for the whole home.");
    expect(screen.getByRole("button", { name: "Propose tasks" })).toBeEnabled();
  });

  it("AC6: says so when there is nothing new to propose", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <GenerateButton
        action={async () => ({ status: "success", count: 0 })}
        scopeLabel="Kitchen"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Propose tasks" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "No new tasks to propose for Kitchen.",
    );
  });

  it("AC8: shows the error with Try again, which runs it again", async () => {
    const action = vi
      .fn<() => Promise<GenerateState>>()
      .mockResolvedValueOnce({ status: "error", formError: "Couldn't propose tasks. Try again." })
      .mockResolvedValueOnce({ status: "success", count: 3 });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<GenerateButton action={action} scopeLabel="Kitchen" />);

    await user.click(screen.getByRole("button", { name: "Propose tasks" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't propose tasks.");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("status")).toHaveTextContent("3 tasks proposed for Kitchen.");
    expect(action).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("AC2: is unavailable with a reason when there is nothing to plan", () => {
    render(
      <GenerateButton
        action={vi.fn()}
        scopeLabel="the whole home"
        unavailableReason="Add a room first."
      />,
    );
    const button = screen.getByRole("button", { name: "Propose tasks" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Add a room first.");
  });
});
