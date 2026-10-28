import { describe, expect, it, vi } from "vitest";
import { openToday, parsePush, showReminder } from "./worker";

const ORIGIN = "https://app.example";

describe("parsePush", () => {
  it("reads the reminder sent by the server", () => {
    const data = {
      json: () => ({ title: "Cleaning in 15 min", body: "4 tasks, 45 min", tag: "before" }),
    };
    expect(parsePush(data)).toEqual({
      title: "Cleaning in 15 min",
      body: "4 tasks, 45 min",
      tag: "before",
    });
  });

  it("falls back to a generic reminder for missing or broken data", () => {
    const generic = {
      title: "My Better Self",
      body: "Time to check today's cleaning.",
      tag: "reminder",
    };
    expect(parsePush(null)).toEqual(generic);
    expect(
      parsePush({
        json: () => {
          throw new SyntaxError("bad");
        },
      }),
    ).toEqual(generic);
  });
});

describe("showReminder", () => {
  it("shows the notification, replacing an earlier one of the same kind", async () => {
    const showNotification = vi.fn(async () => {});
    await showReminder({ showNotification }, { title: "T", body: "B", tag: "evening" });
    expect(showNotification).toHaveBeenCalledWith("T", {
      body: "B",
      tag: "evening",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    });
  });
});

describe("openToday", () => {
  it("focuses an open window and takes it to Today", async () => {
    const window = {
      url: `${ORIGIN}/rooms`,
      focus: vi.fn(async () => window),
      navigate: vi.fn(async () => window),
    };
    const clients = { matchAll: vi.fn(async () => [window]), openWindow: vi.fn() };
    await openToday(clients, ORIGIN);
    expect(window.focus).toHaveBeenCalled();
    expect(window.navigate).toHaveBeenCalledWith(`${ORIGIN}/`);
    expect(clients.openWindow).not.toHaveBeenCalled();
  });

  it("opens Today when no window is open", async () => {
    const clients = { matchAll: vi.fn(async () => []), openWindow: vi.fn(async () => null) };
    await openToday(clients, ORIGIN);
    expect(clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/`);
  });

  it("opens a new window when the open one can't be navigated", async () => {
    const window = {
      url: `${ORIGIN}/plan`,
      focus: vi.fn(async () => window),
      navigate: vi.fn(async () => {
        throw new TypeError("not controlled");
      }),
    };
    const clients = { matchAll: vi.fn(async () => [window]), openWindow: vi.fn(async () => null) };
    await openToday(clients, ORIGIN);
    expect(clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/`);
  });
});
