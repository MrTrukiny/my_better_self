import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dayLabel } from "@/lib/scheduler/format";
import type { TodayTask } from "@/lib/today/progress";
import { queueKey, readQueue } from "@/lib/today/queue";
import type { CheckOffResult } from "@/lib/today/schemas";
import { TodaySession, type TodaySessionProps } from "./today-session";

vi.mock("next/offline", () => ({ useOffline: () => false }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (message: string) => toastError(message) } }));

const USER = "u1";

function task(
  id: string,
  name: string,
  minutes: number,
  kind: TodayTask["kind"] = "cleaning",
): TodayTask {
  return {
    id,
    occurrenceId: `o-${id}`,
    kind,
    name,
    minutes,
    roomName: kind === "cleaning" ? "Kitchen" : null,
    itemName: null,
    status: "scheduled",
    actualMinutes: null,
    note: null,
  };
}

const TASKS = [
  task("counters", "Wipe counters", 15),
  task("floor", "Sweep floor", 10),
  task("stove", "Clean stove", 13),
  task("bed", "Make the bed", 2, "routine"),
];

function renderSession(props: Partial<TodaySessionProps> = {}) {
  const send = vi.fn<(change: unknown) => Promise<CheckOffResult>>(async () => "ok");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
  render(
    <TodaySession
      userId={USER}
      date={today}
      timeZone="UTC"
      start="07:00"
      budget={45}
      tasks={TASKS}
      pastStreak={2}
      version="v1"
      send={send}
      {...props}
    />,
  );
  return { send };
}

beforeEach(() => {
  localStorage.clear();
  refresh.mockClear();
  toastError.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response()),
  );
});

describe("TodaySession", () => {
  it("AC1: shows the session with its time, progress, and routines apart", () => {
    renderSession();
    expect(screen.getByText(/07:00–07:45 · 38 of 45 min/)).toBeInTheDocument();
    expect(screen.getByText("0 of 38 min done")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Cleaning today" }).children).toHaveLength(3);
    expect(screen.getByRole("list", { name: "Routines today" })).toHaveTextContent("Make the bed");
    expect(screen.getByText("2-day streak")).toBeInTheDocument();
  });

  it("AC2: checking a task updates the progress at once and saves it", async () => {
    const user = userEvent.setup();
    const { send } = renderSession();
    await user.click(screen.getByRole("checkbox", { name: /Wipe counters/ }));
    expect(screen.getByText("15 of 38 min done")).toBeInTheDocument();
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ occurrenceId: "o-counters", status: "done" }),
      ),
    );
    await waitFor(() => expect(readQueue(localStorage, USER)).toEqual([]));

    await user.click(screen.getByRole("checkbox", { name: /Wipe counters/ }));
    expect(screen.getByText("0 of 38 min done")).toBeInTheDocument();
  });

  it("AC2: routines can be checked and don't count toward the progress", async () => {
    const user = userEvent.setup();
    renderSession();
    await user.click(screen.getByRole("checkbox", { name: "Make the bed" }));
    expect(screen.getByRole("checkbox", { name: "Make the bed" })).toBeChecked();
    expect(screen.getByText("0 of 38 min done")).toBeInTheDocument();
  });

  it("AC3 and spec 007 AC4: skipping leaves the total but keeps the end time; undo restores it", async () => {
    const user = userEvent.setup();
    renderSession();
    await user.click(screen.getByRole("button", { name: "Skip Clean stove" }));
    expect(screen.getByText("0 of 25 min done")).toBeInTheDocument();
    expect(screen.getByText(/07:00–07:45 · 25 of 45 min/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Undo skipping Clean stove" }));
    expect(screen.getByText("0 of 38 min done")).toBeInTheDocument();
  });

  it("AC5: finishing the last task completes the day and extends the streak", async () => {
    const user = userEvent.setup();
    renderSession();
    await user.click(screen.getByRole("checkbox", { name: /Wipe counters/ }));
    await user.click(screen.getByRole("checkbox", { name: /Sweep floor/ }));
    await user.click(screen.getByRole("button", { name: "Skip Clean stove" }));
    expect(screen.getByText("Done for today. 3-day streak.")).toBeInTheDocument();
  });

  it("AC6: shows changes queued on the device after a reload", () => {
    localStorage.setItem(
      queueKey(USER),
      JSON.stringify([{ occurrenceId: "o-floor", status: "done", queuedAt: 1 }]),
    );
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderSession();
    expect(screen.getByRole("checkbox", { name: /Sweep floor/ })).toBeChecked();
    expect(screen.getByText("Saved on this device")).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("AC6: a change to a task no longer in the plan is dropped with a notice", async () => {
    const user = userEvent.setup();
    renderSession({ send: async () => "gone" });
    await user.click(screen.getByRole("checkbox", { name: /Sweep floor/ }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        `"Sweep floor" is no longer in the plan, so that change wasn't saved.`,
      ),
    );
    expect(refresh).toHaveBeenCalled();
    expect(readQueue(localStorage, USER)).toEqual([]);
  });

  it("AC7: keeps the change and shows a notice only after repeated failures", async () => {
    const user = userEvent.setup();
    renderSession({ send: async () => "failed" });
    await user.click(screen.getByRole("checkbox", { name: /Wipe counters/ }));
    await act(async () => {});
    expect(screen.queryByText(/Couldn't save your changes yet/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Sweep floor/ }));
    expect(await screen.findByText(/Couldn't save your changes yet/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Wipe counters/ })).toBeChecked();
    expect(readQueue(localStorage, USER)).toHaveLength(2);
  });

  it("009 AC1, AC2, AC7: numbers cleaning tasks with back-to-back slots; routines have none", () => {
    renderSession();
    const rows = screen.getByRole("list", { name: "Cleaning today" }).children;
    expect(rows[0]).toHaveTextContent("1 · 07:00–07:15");
    expect(rows[1]).toHaveTextContent("2 · 07:15–07:25");
    expect(rows[2]).toHaveTextContent("3 · 07:25–07:38");
    const routines = screen.getByRole("list", { name: "Routines today" });
    expect(routines).not.toHaveTextContent("·");
    expect(screen.queryByRole("textbox", { name: /Make the bed/ })).not.toBeInTheDocument();
  });

  it("009 AC2: slots don't move when a task is skipped", async () => {
    const user = userEvent.setup();
    renderSession();
    await user.click(screen.getByRole("button", { name: "Skip Wipe counters" }));
    const rows = screen.getByRole("list", { name: "Cleaning today" }).children;
    expect(rows[1]).toHaveTextContent("2 · 07:15–07:25");
  });

  it("009 AC3, AC5: a done task takes the minutes it took, saved on Enter", async () => {
    const user = userEvent.setup();
    const { send } = renderSession();
    expect(screen.queryByRole("textbox", { name: /Minutes taken/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Wipe counters/ }));
    const field = screen.getByRole("textbox", { name: "Minutes taken for Wipe counters" });
    await user.type(field, "12{Enter}");
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ occurrenceId: "o-counters", status: "done", actualMinutes: 12 }),
      ),
    );
    expect(screen.getByText("Took 12 min so far")).toBeInTheDocument();
    expect(screen.getByText("15 of 38 min done")).toBeInTheDocument();
  });

  it("009 AC3, AC8: a value out of range shows an announced message and isn't saved", async () => {
    const user = userEvent.setup();
    const { send } = renderSession();
    await user.click(screen.getByRole("checkbox", { name: /Wipe counters/ }));
    const field = screen.getByRole("textbox", { name: "Minutes taken for Wipe counters" });
    await user.type(field, "300");
    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter whole minutes from 1 to 240.");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Enter whole minutes from 1 to 240.");
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ actualMinutes: 300 }));
  });

  it("009 AC3: clearing the field removes the minutes", async () => {
    const user = userEvent.setup();
    const done = { ...TASKS[0], status: "done" as const, actualMinutes: 12 };
    const { send } = renderSession({ tasks: [done, ...TASKS.slice(1)] });
    expect(screen.getByText("Took 12 min so far")).toBeInTheDocument();
    const field = screen.getByRole("textbox", { name: "Minutes taken for Wipe counters" });
    expect(field).toHaveValue("12");
    await user.clear(field);
    await user.tab();
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          occurrenceId: "o-counters",
          status: "done",
          actualMinutes: null,
        }),
      ),
    );
    expect(screen.queryByText(/so far/)).not.toBeInTheDocument();
  });

  it("009 AC4: unchecking a task removes its minutes", async () => {
    const user = userEvent.setup();
    const done = { ...TASKS[0], status: "done" as const, actualMinutes: 12 };
    renderSession({ tasks: [done, ...TASKS.slice(1)] });
    await user.click(screen.getByRole("checkbox", { name: /Wipe counters/ }));
    expect(screen.queryByText(/so far/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Wipe counters/ }));
    expect(screen.getByRole("textbox", { name: "Minutes taken for Wipe counters" })).toHaveValue(
      "",
    );
  });

  it("009 AC6: shows minutes queued on the device after a reload", () => {
    localStorage.setItem(
      queueKey(USER),
      JSON.stringify([{ occurrenceId: "o-floor", status: "done", actualMinutes: 8, queuedAt: 1 }]),
    );
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderSession();
    expect(screen.getByRole("textbox", { name: "Minutes taken for Sweep floor" })).toHaveValue("8");
    expect(screen.getByText("Took 8 min so far")).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("AC4: an offline copy from an earlier day can't be checked", () => {
    renderSession({ date: "2020-01-01" });
    expect(screen.getByText(/This is the session saved for/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Wipe counters/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

describe("TodaySession timers (spec 016)", () => {
  const MINUTE = 60_000;
  const timerKey = `mbs:timer:${USER}`;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date("2026-11-10T08:00:00Z") });
    return () => vi.useRealTimers();
  });

  const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
  const startButton = (name: string) =>
    screen.getByRole("button", { name: `Start timer for ${name}` });

  it("AC1, AC8: starting shows the running time with pause and stop, and announces it", async () => {
    const user = setup();
    renderSession({ date: today() });
    await user.click(startButton("Wipe counters"));
    await act(() => vi.advanceTimersByTimeAsync(65_000));

    const row = screen.getByRole("checkbox", { name: /Wipe counters/ }).closest("li");
    expect(row).toHaveTextContent("01:05");
    expect(screen.getByRole("button", { name: "Pause timer for Wipe counters" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Stop timer for Wipe counters" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Skip Wipe counters" })).not.toBeInTheDocument();
    expect(startButton("Sweep floor")).toBeVisible();
    expect(screen.getByText("Timer started for Wipe counters.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wipe counters" })).toHaveAttribute(
      "href",
      "#task-o-counters",
    );
  });

  it("AC2: starting another timer pauses the first and keeps its time", async () => {
    const user = setup();
    renderSession({ date: today() });
    await user.click(startButton("Wipe counters"));
    await act(() => vi.advanceTimersByTimeAsync(2 * MINUTE));
    await user.click(startButton("Sweep floor"));

    expect(screen.getByRole("button", { name: "Resume timer for Wipe counters" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Pause timer for Sweep floor" })).toBeVisible();
    await act(() => vi.advanceTimersByTimeAsync(5 * MINUTE));
    const first = screen.getByRole("checkbox", { name: /Wipe counters/ }).closest("li");
    expect(first).toHaveTextContent("02:00");
  });

  it("AC3: pausing stops the time, and resuming continues from it", async () => {
    const user = setup();
    renderSession({ date: today() });
    await user.click(startButton("Wipe counters"));
    await act(() => vi.advanceTimersByTimeAsync(3 * MINUTE));
    await user.click(screen.getByRole("button", { name: "Pause timer for Wipe counters" }));
    expect(screen.getByText("Timer paused for Wipe counters.")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(10 * MINUTE));
    const row = () => screen.getByRole("checkbox", { name: /Wipe counters/ }).closest("li");
    expect(row()).toHaveTextContent("03:00");
    await user.click(screen.getByRole("button", { name: "Resume timer for Wipe counters" }));
    await act(() => vi.advanceTimersByTimeAsync(MINUTE));
    expect(row()).toHaveTextContent("04:00");
  });

  it("AC4, AC5: stopping checks the task off with the measured minutes, which stay editable", async () => {
    const user = setup();
    const { send } = renderSession({ date: today() });
    await user.click(startButton("Wipe counters"));
    await act(() => vi.advanceTimersByTimeAsync(12 * MINUTE + 30_000));
    await user.click(screen.getByRole("button", { name: "Stop timer for Wipe counters" }));

    expect(screen.getByRole("checkbox", { name: /Wipe counters/ })).toBeChecked();
    const took = screen.getByRole("textbox", { name: "Minutes taken for Wipe counters" });
    expect(took).toHaveValue("13");
    expect(screen.getByText("Timer stopped. Wipe counters took 13 min.")).toBeInTheDocument();
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ occurrenceId: "o-counters", status: "done", actualMinutes: 13 }),
      ),
    );
    expect(localStorage.getItem(timerKey)).toBeNull();

    await user.clear(took);
    await user.type(took, "10{Enter}");
    await waitFor(() =>
      expect(send).toHaveBeenLastCalledWith(
        expect.objectContaining({ occurrenceId: "o-counters", actualMinutes: 10 }),
      ),
    );
  });

  it("AC4: a timer left running is capped at 240 minutes, with a notice", async () => {
    const user = setup();
    localStorage.setItem(
      timerKey,
      JSON.stringify({
        "o-counters": { date: today(), elapsedMs: 0, startedAt: Date.now() - 300 * MINUTE },
      }),
    );
    renderSession({ date: today() });
    await user.click(screen.getByRole("button", { name: "Stop timer for Wipe counters" }));
    expect(screen.getByRole("textbox", { name: "Minutes taken for Wipe counters" })).toHaveValue(
      "240",
    );
    expect(screen.getByText("Timer capped at 240 min. Correct it if needed.")).toBeInTheDocument();
  });

  it("AC5: checking a timed task stops its timer; unchecking clears it", async () => {
    const user = setup();
    renderSession({ date: today() });
    await user.click(startButton("Sweep floor"));
    await act(() => vi.advanceTimersByTimeAsync(4 * MINUTE));
    await user.click(screen.getByRole("checkbox", { name: /Sweep floor/ }));
    expect(screen.getByRole("textbox", { name: "Minutes taken for Sweep floor" })).toHaveValue("4");

    await user.click(screen.getByRole("checkbox", { name: /Sweep floor/ }));
    expect(startButton("Sweep floor")).toBeVisible();
    expect(localStorage.getItem(timerKey)).toBeNull();
  });

  it("AC7: a timer survives a reload and keeps counting from its start", () => {
    localStorage.setItem(
      timerKey,
      JSON.stringify({
        "o-floor": { date: today(), elapsedMs: 2 * MINUTE, startedAt: Date.now() - 3 * MINUTE },
        "o-stove": { date: today(), elapsedMs: 90_000, startedAt: null },
      }),
    );
    renderSession({ date: today() });
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("checkbox", { name: /Sweep floor/ }).closest("li")).toHaveTextContent(
      "05:01",
    );
    expect(screen.getByRole("button", { name: "Resume timer for Clean stove" })).toBeVisible();
    expect(screen.getByText(/^Timing:/)).toHaveTextContent("Timing: Sweep floor, 05:01");
  });

  it("AC7: a timer left on an earlier day can be stopped and saved", async () => {
    const user = setup();
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    localStorage.setItem(
      timerKey,
      JSON.stringify({ "o-old": { date: yesterday, elapsedMs: 20 * MINUTE, startedAt: null } }),
    );
    const { send } = renderSession({ date: today() });
    expect(screen.getByText(/A timer from/)).toHaveTextContent(
      `A timer from ${dayLabel(yesterday)} is paused, 20:00.`,
    );
    await user.click(screen.getByRole("button", { name: "Stop and save" }));
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ occurrenceId: "o-old", status: "done", actualMinutes: 20 }),
      ),
    );
    expect(screen.queryByText(/A timer from/)).not.toBeInTheDocument();
  });

  it("AC7: a timer whose task is gone can be discarded", async () => {
    const user = setup();
    localStorage.setItem(
      timerKey,
      JSON.stringify({ "o-gone": { date: today(), elapsedMs: MINUTE, startedAt: null } }),
    );
    const { send } = renderSession({ date: today() });
    expect(screen.queryByRole("button", { name: "Stop and save" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByText(/A timer from/)).not.toBeInTheDocument();
    expect(localStorage.getItem(timerKey)).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("AC6: a done task's note is saved and removed when unchecked", async () => {
    const user = setup();
    const { send } = renderSession({ date: today() });
    expect(screen.queryByRole("button", { name: "Add note for Wipe counters" })).toBeNull();
    await user.click(screen.getByRole("checkbox", { name: /Wipe counters/ }));
    await user.click(screen.getByRole("button", { name: "Add note for Wipe counters" }));
    await user.keyboard("Full deep clean{Enter}");
    expect(screen.getByText("Full deep clean")).toBeVisible();
    await waitFor(() =>
      expect(send).toHaveBeenLastCalledWith(
        expect.objectContaining({
          occurrenceId: "o-counters",
          status: "done",
          note: "Full deep clean",
        }),
      ),
    );

    await user.click(screen.getByRole("checkbox", { name: /Wipe counters/ }));
    await user.click(screen.getByRole("checkbox", { name: /Wipe counters/ }));
    expect(screen.queryByText("Full deep clean")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add note for Wipe counters" })).toBeVisible();
  });

  it("routines have no timer", () => {
    renderSession({ date: today() });
    expect(
      screen.queryByRole("button", { name: "Start timer for Make the bed" }),
    ).not.toBeInTheDocument();
  });
});
