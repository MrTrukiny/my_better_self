import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toDayNumber, toIsoDate } from "@/lib/scheduler/dates";
import type { EarlierTask } from "@/lib/today/earlier";
import { readQueue } from "@/lib/today/queue";
import type { CheckOffResult } from "@/lib/today/schemas";
import { EarlierDays, type EarlierDaysProps } from "./earlier-days";

vi.mock("next/offline", () => ({ useOffline: () => false }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (message: string) => toastError(message) } }));

const USER = "u1";
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
const daysAgo = (n: number) => toIsoDate(toDayNumber(TODAY) - n);

function task(
  id: string,
  name: string,
  status: EarlierTask["status"] = "scheduled",
  kind: EarlierTask["kind"] = "cleaning",
): EarlierTask {
  return {
    id,
    occurrenceId: `o-${id}`,
    kind,
    name,
    minutes: 10,
    roomId: kind === "cleaning" ? "r1" : null,
    roomName: kind === "cleaning" ? "Kitchen" : null,
    roomAddedAt: 1,
    itemName: null,
    itemType: null,
    itemAddedAt: null,
    status,
    actualMinutes: null,
  };
}

function renderDays(props: Partial<EarlierDaysProps> = {}) {
  const send = vi.fn<(change: unknown) => Promise<CheckOffResult>>(async () => "ok");
  render(
    <EarlierDays
      userId={USER}
      timeZone="UTC"
      days={[
        {
          date: daysAgo(1),
          dayOff: false,
          tasks: [
            task("floor", "Sweep floor"),
            task("stove", "Clean stove", "done"),
            task("bed", "Make the bed", "scheduled", "routine"),
          ],
        },
        { date: daysAgo(2), dayOff: true, tasks: [] },
        { date: daysAgo(3), dayOff: false, tasks: [task("dust", "Dust shelves", "done")] },
      ]}
      version="v1"
      send={send}
      {...props}
    />,
  );
  return { send };
}

describe("EarlierDays", () => {
  beforeEach(() => {
    localStorage.clear();
    toastError.mockClear();
    refresh.mockClear();
  });

  it("AC1: shows each day with its date and how many tasks are done", () => {
    renderDays();
    const yesterday = screen.getByRole("region", { name: new RegExp(dayName(1)) });
    expect(within(yesterday).getByText("1 of 2 done")).toBeInTheDocument();
    expect(within(yesterday).getByRole("checkbox", { name: /Sweep floor/ })).not.toBeChecked();
    expect(screen.getByRole("region", { name: new RegExp(dayName(3)) })).toBeInTheDocument();
  });

  it("UX: days with unchecked tasks start open; complete days start closed", () => {
    renderDays();
    const details = document.querySelectorAll("details");
    expect(details[0]).toHaveAttribute("open");
    expect(details[2]).not.toHaveAttribute("open");
  });

  it("UX: days off show it without controls", () => {
    renderDays();
    const dayOff = screen.getByRole("region", { name: new RegExp(dayName(2)) });
    expect(within(dayOff).getByText("Day off")).toBeInTheDocument();
    expect(within(dayOff).queryByRole("checkbox")).toBeNull();
  });

  it("AC2, AC8: checks a past task, with the date in its accessible name", async () => {
    const user = userEvent.setup();
    const { send } = renderDays();
    const checkbox = screen.getByRole("checkbox", {
      name: new RegExp(`^Sweep floor, ${dayName(1)}`),
    });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(screen.getByText("2 of 2 done")).toBeInTheDocument();
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ occurrenceId: "o-floor", status: "done" }),
      ),
    );
    await user.click(screen.getByRole("button", { name: `Skip Clean stove, ${dayName(1)}` }));
  });

  it("AC2: records the minutes a past task took", async () => {
    const user = userEvent.setup();
    const { send } = renderDays();
    const field = screen.getByRole("textbox", {
      name: `Minutes taken for Clean stove, ${dayName(1)}`,
    });
    await user.type(field, "12{Enter}");
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ occurrenceId: "o-stove", status: "done", actualMinutes: 12 }),
      ),
    );
  });

  it("AC2: days older than the window are read-only", () => {
    renderDays({
      days: [{ date: daysAgo(8), dayOff: false, tasks: [task("floor", "Sweep floor")] }],
    });
    expect(screen.getByRole("checkbox", { name: /Sweep floor/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("AC6: a change for a day that left the window is dropped with a notice", async () => {
    const user = userEvent.setup();
    renderDays({ send: async () => "past" });
    await user.click(screen.getByRole("checkbox", { name: /Sweep floor/ }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "A change for a day more than 7 days ago couldn't be saved.",
      ),
    );
    expect(refresh).toHaveBeenCalled();
    expect(readQueue(localStorage, USER)).toEqual([]);
  });

  it("AC7: says so when there are no past days", () => {
    renderDays({ days: [] });
    expect(screen.getByText(/No earlier days yet/)).toBeInTheDocument();
  });
});

function dayName(n: number): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${daysAgo(n)}T00:00:00Z`));
}
