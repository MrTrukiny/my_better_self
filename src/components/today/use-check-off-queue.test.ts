import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { enqueue, readQueue } from "@/lib/today/queue";
import type { CheckOffResult } from "@/lib/today/schemas";
import { useCheckOffQueue } from "./use-check-off-queue";

const USER = "u1";

describe("useCheckOffQueue", () => {
  beforeEach(() => localStorage.clear());

  it("two mounted queues send each change once, in order", async () => {
    enqueue(localStorage, USER, { occurrenceId: "o1", status: "done", queuedAt: 1 });
    const sent: string[] = [];
    const send = vi.fn(async (change: { occurrenceId: string }): Promise<CheckOffResult> => {
      sent.push(change.occurrenceId);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return "ok";
    });
    const options = { userId: USER, send, onDropped: vi.fn(), onSynced: vi.fn() };
    const first = renderHook(() => useCheckOffQueue(options));
    const second = renderHook(() => useCheckOffQueue(options));

    await waitFor(() => expect(readQueue(localStorage, USER)).toEqual([]));
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(second.result.current.queue).toEqual([]));
    expect(first.result.current.queue).toEqual([]);
    expect(sent).toEqual(["o1"]);
  });
});
