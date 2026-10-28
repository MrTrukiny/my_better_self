import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/notifications/reminders";
import { NotificationsPanel } from "./notifications-panel";

const offline = vi.hoisted(() => ({ value: false }));
vi.mock("next/offline", () => ({ useOffline: () => offline.value }));

const subscriptionJson = { endpoint: "https://push.example/1", keys: { p256dh: "k", auth: "a" } };

function fakeSubscription() {
  return {
    endpoint: subscriptionJson.endpoint,
    toJSON: () => subscriptionJson,
    unsubscribe: vi.fn(async () => true),
  };
}

let existing: ReturnType<typeof fakeSubscription> | null;
const pushManager = {
  getSubscription: vi.fn(async () => existing),
  subscribe: vi.fn(async () => {
    existing = fakeSubscription();
    return existing;
  }),
};
const notification = {
  permission: "default" as NotificationPermission,
  requestPermission: vi.fn(),
};
const subscribe = vi.fn(async () => ({ ok: true }));
const unsubscribe = vi.fn(async () => ({ ok: true }));
const savePrefs = vi.fn(async () => ({ status: "success" as const }));

function supportPush() {
  const registration = { pushManager };
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", notification);
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { getRegistration: async () => registration, ready: Promise.resolve(registration) },
  });
}

function renderPanel(subscribed = false) {
  return render(
    <NotificationsPanel
      publicKey="BAAA"
      subscribed={subscribed}
      prefs={DEFAULT_NOTIFICATION_PREFS}
      subscribe={subscribe}
      unsubscribe={unsubscribe}
      savePrefs={savePrefs}
    />,
  );
}

const deviceSwitch = () => screen.getByRole("switch", { name: "Notifications on this device" });

beforeEach(() => {
  existing = null;
  offline.value = false;
  notification.permission = "default";
  notification.requestPermission.mockReset();
  pushManager.getSubscription.mockClear();
  pushManager.subscribe.mockClear();
  subscribe.mockClear();
  unsubscribe.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("NotificationsPanel", () => {
  it("AC1: explains that the app must be installed where push isn't available", async () => {
    renderPanel();
    expect(await screen.findByRole("status")).toHaveTextContent(/add the app to your Home Screen/);
    expect(deviceSwitch()).toHaveAttribute("aria-disabled", "true");
  });

  it("AC1: asks for permission, subscribes, and shows the reminders", async () => {
    supportPush();
    notification.requestPermission.mockImplementation(async () => {
      notification.permission = "granted";
      return "granted";
    });
    renderPanel();
    expect(await screen.findByText("Notifications are off on this device.")).toBeInTheDocument();

    await userEvent.click(deviceSwitch());

    expect(await screen.findByText("Notifications are on for this device.")).toBeInTheDocument();
    expect(pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    });
    expect(subscribe).toHaveBeenCalledWith(subscriptionJson);
    expect(deviceSwitch()).toBeChecked();
    expect(screen.getByRole("switch", { name: "Before my session" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Evening reminder" })).toBeChecked();
  });

  it("AC1: says how to allow notifications after a denial", async () => {
    supportPush();
    notification.requestPermission.mockResolvedValue("denied");
    renderPanel();
    await userEvent.click(
      await screen.findByRole("switch", { name: "Notifications on this device" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      /blocked for this site. Allow them in your browser's site settings/,
    );
    expect(subscribe).not.toHaveBeenCalled();
    expect(screen.queryByRole("switch", { name: "Before my session" })).not.toBeInTheDocument();
  });

  it("AC7: turning off stops the browser subscription and the server's", async () => {
    supportPush();
    notification.permission = "granted";
    existing = fakeSubscription();
    const browserSubscription = existing;
    renderPanel(true);
    expect(await screen.findByText("Notifications are on for this device.")).toBeInTheDocument();

    await userEvent.click(deviceSwitch());

    expect(await screen.findByText("Notifications are off on this device.")).toBeInTheDocument();
    expect(browserSubscription.unsubscribe).toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("re-registers a browser subscription the server lost, and drops one the browser lost", async () => {
    supportPush();
    notification.permission = "granted";
    existing = fakeSubscription();
    const { unmount } = renderPanel(false);
    await vi.waitFor(() => expect(subscribe).toHaveBeenCalledWith(subscriptionJson));
    unmount();

    existing = null;
    renderPanel(true);
    await vi.waitFor(() => expect(unsubscribe).toHaveBeenCalled());
  });

  it("AC8: disables the controls offline", async () => {
    supportPush();
    notification.permission = "granted";
    existing = fakeSubscription();
    offline.value = true;
    renderPanel(true);
    expect(await screen.findByText("Notifications are on for this device.")).toBeInTheDocument();
    expect(deviceSwitch()).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("switch", { name: "Before my session" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
