import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { isSignedByQStash, deliverReminder } = vi.hoisted(() => ({
  isSignedByQStash: vi.fn(),
  deliverReminder: vi.fn(),
}));
vi.mock("@/lib/notifications/qstash", () => ({ isSignedByQStash }));
vi.mock("@/lib/notifications/deliver", () => ({ deliverReminder }));

const { POST } = await import("./route");

const message = { userId: "user-1", kind: "before", date: "2026-10-28", time: "06:15" };

function request(body: unknown, signature: string | null = "signed") {
  return new NextRequest("http://localhost/api/notifications/send", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: signature ? { "upstash-signature": signature } : {},
  });
}

beforeEach(() => {
  isSignedByQStash.mockReset().mockResolvedValue(true);
  deliverReminder.mockReset().mockResolvedValue("sent");
});

describe("POST /api/notifications/send", () => {
  it("rejects requests QStash didn't sign", async () => {
    isSignedByQStash.mockResolvedValue(false);
    const response = await POST(request(message, null));
    expect(response.status).toBe(401);
    expect(isSignedByQStash).toHaveBeenCalledWith(null, JSON.stringify(message));
    expect(deliverReminder).not.toHaveBeenCalled();
  });

  it("rejects a signed body that isn't a reminder", async () => {
    const response = await POST(request({ ...message, kind: "weekly" }));
    expect(response.status).toBe(400);
    expect(deliverReminder).not.toHaveBeenCalled();
  });

  it("delivers a signed reminder for the owner it names", async () => {
    const response = await POST(request(message));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: "sent" });
    expect(deliverReminder).toHaveBeenCalledWith("user-1", {
      kind: "before",
      date: "2026-10-28",
      time: "06:15",
    });
  });
});
