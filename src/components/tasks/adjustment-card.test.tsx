import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingAdjustment } from "@/lib/tasks/queries";
import { AdjustmentList } from "./adjustment-list";

const actions = vi.hoisted(() => ({
  acceptAdjustment: vi.fn(async () => ({ status: "success" as const })),
  acceptEditedAdjustment: vi.fn(async () => ({ status: "success" as const })),
  discardAdjustment: vi.fn(async () => ({ status: "success" as const })),
}));
vi.mock("@/app/(app)/tasks/adjustments/actions", () => actions);
vi.mock("@/app/(app)/tasks/actions", () => ({}));
const offline = vi.hoisted(() => ({ value: false }));
vi.mock("next/offline", () => ({ useOffline: () => offline.value }));

const STOVE = {
  id: "task-stove",
  kind: "cleaning" as const,
  name: "Clean stove",
  minutes: 10,
  frequencyDays: 7,
  roomId: "r1",
  roomName: "Kitchen",
  itemId: "i1",
  itemName: "Stove",
};

function adjustment(over: Partial<PendingAdjustment>): PendingAdjustment {
  return {
    id: "a1",
    change: "minutes",
    name: null,
    minutes: 15,
    frequencyDays: null,
    reason: "Your last 3 times were 15 to 22 minutes.",
    evidence: "Last 3: 15, 22, 15 min · Note on Oct 13: Full deep clean",
    task: STOVE,
    roomId: "r1",
    roomName: "Kitchen",
    ...over,
  };
}

const ADJUSTMENTS = [
  adjustment({}),
  adjustment({ id: "a2", change: "frequency", minutes: null, frequencyDays: 14 }),
  adjustment({
    id: "a3",
    change: "new_task",
    name: "Deep clean the oven",
    minutes: 30,
    frequencyDays: 30,
  }),
];

describe("AdjustmentList", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    offline.value = false;
    for (const action of Object.values(actions)) {
      action.mockClear();
    }
  });

  it("AC3: shows each change with its task, place, reason, and evidence, grouped by room", () => {
    render(<AdjustmentList adjustments={ADJUSTMENTS} roomOrder={["r1"]} />);
    const kitchen = screen.getByRole("list", { name: "Kitchen" });
    const [minutes, frequency, newTask] = within(kitchen).getAllByRole("listitem");
    expect(minutes).toHaveTextContent("Clean stove");
    expect(minutes).toHaveTextContent("Stove");
    expect(minutes).toHaveTextContent("10 → 15 min");
    expect(minutes).toHaveTextContent("Your last 3 times were 15 to 22 minutes.");
    expect(minutes).toHaveTextContent("Last 3: 15, 22, 15 min · Note on Oct 13: Full deep clean");
    expect(frequency).toHaveTextContent("Every 7 → 14 days");
    expect(newTask).toHaveTextContent("New: Deep clean the oven, 30 min, every 30 days");
  });

  it("AC4, AC7: accepts and discards one suggestion by its named buttons", async () => {
    const user = userEvent.setup();
    render(<AdjustmentList adjustments={[ADJUSTMENTS[0] as PendingAdjustment]} roomOrder={[]} />);
    await user.click(screen.getByRole("button", { name: "Accept adjustment for Clean stove" }));
    expect(actions.acceptAdjustment).toHaveBeenCalledWith("a1");
    await user.click(screen.getByRole("button", { name: "Discard adjustment for Clean stove" }));
    expect(actions.discardAdjustment).toHaveBeenCalledWith("a1");
  });

  it("AC4: edits the values before accepting, starting from the suggested ones", async () => {
    const user = userEvent.setup();
    render(<AdjustmentList adjustments={[ADJUSTMENTS[2] as PendingAdjustment]} roomOrder={[]} />);
    await user.click(screen.getByRole("button", { name: "Edit adjustment for Clean stove" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit new task" });
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Deep clean the oven");
    expect(within(dialog).getByLabelText("Minutes")).toHaveValue(30);
    const minutes = within(dialog).getByLabelText("Minutes");
    await user.clear(minutes);
    await user.type(minutes, "25");
    await user.click(within(dialog).getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(actions.acceptEditedAdjustment).toHaveBeenCalled());
    const [id, , formData] = actions.acceptEditedAdjustment.mock.calls[0] as unknown as [
      string,
      unknown,
      FormData,
    ];
    expect(id).toBe("a3");
    expect(formData.get("minutes")).toBe("25");
    expect(formData.get("name")).toBe("Deep clean the oven");
  });

  it("AC7: actions are disabled offline", () => {
    offline.value = true;
    render(<AdjustmentList adjustments={[ADJUSTMENTS[0] as PendingAdjustment]} roomOrder={[]} />);
    for (const name of ["Accept", "Discard", "Edit"]) {
      expect(
        screen.getByRole("button", { name: `${name} adjustment for Clean stove` }),
      ).toBeDisabled();
    }
  });

  it("renders nothing without suggestions", () => {
    const { container } = render(<AdjustmentList adjustments={[]} roomOrder={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
