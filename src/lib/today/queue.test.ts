import { beforeEach, describe, expect, it, vi } from "vitest";
import { dequeue, enqueue, flushQueue, type QueuedChange, queueKey, readQueue } from "./queue";

const USER = "u1";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

let storage: ReturnType<typeof memoryStorage>;
beforeEach(() => {
  storage = memoryStorage();
});

const change = (occurrenceId: string, status: QueuedChange["status"], queuedAt: number) => ({
  occurrenceId,
  status,
  queuedAt,
});

describe("queue", () => {
  it("AC6: keeps changes in order across reads, as after a reload", () => {
    enqueue(storage, USER, change("a", "done", 1));
    enqueue(storage, USER, change("b", "skipped", 2));
    expect(readQueue(storage, USER).map((c) => c.occurrenceId)).toEqual(["a", "b"]);
  });

  it("AC6: a later change to the same task replaces the earlier one", () => {
    enqueue(storage, USER, change("a", "done", 1));
    enqueue(storage, USER, change("b", "done", 2));
    enqueue(storage, USER, change("a", "scheduled", 3));
    expect(readQueue(storage, USER)).toEqual([change("b", "done", 2), change("a", "scheduled", 3)]);
  });

  it("keeps a newer change when an older one is acknowledged", () => {
    enqueue(storage, USER, change("a", "done", 1));
    enqueue(storage, USER, change("a", "scheduled", 2));
    expect(dequeue(storage, USER, change("a", "done", 1))).toEqual([change("a", "scheduled", 2)]);
  });

  it("009 AC6: carries minutes, and a later change replaces them too", () => {
    enqueue(storage, USER, { ...change("a", "done", 1), actualMinutes: 12 });
    enqueue(storage, USER, { ...change("b", "done", 2), actualMinutes: null });
    expect(readQueue(storage, USER)).toEqual([
      { ...change("a", "done", 1), actualMinutes: 12 },
      { ...change("b", "done", 2), actualMinutes: null },
    ]);
    enqueue(storage, USER, change("a", "scheduled", 3));
    expect(readQueue(storage, USER)).toEqual([
      { ...change("b", "done", 2), actualMinutes: null },
      change("a", "scheduled", 3),
    ]);
  });

  it("009 AC6: drops entries with malformed minutes", () => {
    storage.setItem(
      queueKey(USER),
      JSON.stringify([
        { ...change("a", "done", 1), actualMinutes: "12" },
        { ...change("b", "done", 2), actualMinutes: 1.5 },
        { ...change("c", "done", 3), actualMinutes: 12 },
      ]),
    );
    expect(readQueue(storage, USER).map((c) => c.occurrenceId)).toEqual(["c"]);
  });

  it("is scoped to the user and ignores corrupt data", () => {
    enqueue(storage, USER, change("a", "done", 1));
    expect(readQueue(storage, "someone-else")).toEqual([]);
    storage.setItem(queueKey(USER), "{not json");
    expect(readQueue(storage, USER)).toEqual([]);
  });
});

describe("flushQueue", () => {
  it("AC6: sends in order and empties the queue", async () => {
    enqueue(storage, USER, change("a", "done", 1));
    enqueue(storage, USER, change("b", "done", 2));
    const sent: string[] = [];
    const result = await flushQueue(storage, USER, async (c) => {
      sent.push(c.occurrenceId);
      return "ok";
    });
    expect(sent).toEqual(["a", "b"]);
    expect(result).toEqual({ dropped: [], failed: false });
    expect(readQueue(storage, USER)).toEqual([]);
  });

  it("AC6: drops changes the server refuses for good and reports them", async () => {
    enqueue(storage, USER, change("a", "done", 1));
    enqueue(storage, USER, change("b", "done", 2));
    const result = await flushQueue(storage, USER, async (c) =>
      c.occurrenceId === "a" ? "gone" : "ok",
    );
    expect(result.dropped).toEqual([{ change: change("a", "done", 1), result: "gone" }]);
    expect(readQueue(storage, USER)).toEqual([]);
  });

  it("AC7: stops at a failure and keeps the rest for the next try", async () => {
    enqueue(storage, USER, change("a", "done", 1));
    enqueue(storage, USER, change("b", "done", 2));
    const send = vi.fn().mockResolvedValueOnce("ok").mockRejectedValueOnce(new Error("offline"));
    const result = await flushQueue(storage, USER, send);
    expect(result.failed).toBe(true);
    expect(readQueue(storage, USER)).toEqual([change("b", "done", 2)]);
  });
});
