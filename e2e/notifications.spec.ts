import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Headless browsers have no push service, so `PushManager` is stubbed with a subscription kept
 * in localStorage, which survives reloads like a real one. Everything else is real.
 */
async function stubPush(page: Page, permission: "granted" | "denied") {
  await page.addInitScript((permission) => {
    const KEY = "e2e:push-endpoint";
    const subscription = (endpoint: string) => ({
      endpoint,
      toJSON: () => ({ endpoint, keys: { p256dh: "e2e-p256dh", auth: "e2e-auth" } }),
      unsubscribe: async () => {
        localStorage.removeItem(KEY);
        return true;
      },
    });
    PushManager.prototype.getSubscription = async () => {
      const endpoint = localStorage.getItem(KEY);
      return (endpoint ? subscription(endpoint) : null) as unknown as PushSubscription;
    };
    PushManager.prototype.subscribe = async () => {
      const endpoint = `https://push.example/${crypto.randomUUID()}`;
      localStorage.setItem(KEY, endpoint);
      return subscription(endpoint) as unknown as PushSubscription;
    };
    Object.defineProperty(Notification, "permission", { get: () => permission });
    Notification.requestPermission = async () => permission;
  }, permission);
}

const deviceSwitch = (page: Page) =>
  page.getByRole("switch", { name: "Notifications on this device" });

test("spec 012: turn notifications on, choose reminders, and stop them on this device", async ({
  page,
  signedInUser,
  testAuth,
}) => {
  test.slow();
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  await stubPush(page, "granted");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ colorScheme: "dark" });

  // AC1: Settings has a Notifications row that summarizes this device.
  await page.goto("/settings");
  const row = page.getByRole("link", { name: /^Notifications/ });
  await expect(row).toContainText("Off on this device");
  await row.click();
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expect(page.getByText("Notifications are off on this device.")).toBeVisible();

  // AC1, AC8: turn them on with the keyboard.
  await deviceSwitch(page).focus();
  await page.keyboard.press("Space");
  await expect(page.getByText("Notifications are on for this device.")).toBeVisible();
  await expect(deviceSwitch(page)).toBeChecked();
  await expect.poll(() => testAuth.pushSubscriptionCount(signedInUser.id)).toBe(1);

  // AC2, AC4: both reminders start on with the defaults; change them and save.
  await expect(page.getByRole("switch", { name: "Before my session" })).toBeChecked();
  await expect(page.getByRole("combobox", { name: "How long before" })).toContainText(
    "15 minutes before",
  );
  await expect(page.getByLabel("Time", { exact: true })).toHaveValue("20:00");
  await page.getByRole("combobox", { name: "How long before" }).click();
  await page.getByRole("option", { name: "30 minutes before" }).click();
  await page.getByRole("switch", { name: "Evening reminder" }).click();
  await expect(page.getByLabel("Time", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  await page.goto("/settings");
  await expect(row).toContainText("Before my session, 30 min");

  // The choices persist, and the device stays on after a reload.
  await row.click();
  await expect(deviceSwitch(page)).toBeChecked();
  await expect(page.getByRole("combobox", { name: "How long before" })).toContainText(
    "30 minutes before",
  );
  await expect(page.getByRole("switch", { name: "Evening reminder" })).not.toBeChecked();

  // AC7: turning off removes this device's subscription.
  await deviceSwitch(page).click();
  await expect(page.getByText("Notifications are off on this device.")).toBeVisible();
  await expect.poll(() => testAuth.pushSubscriptionCount(signedInUser.id)).toBe(0);
  await expect(page.getByRole("switch", { name: "Before my session" })).toHaveCount(0);

  // AC7: signing out removes it too.
  await deviceSwitch(page).click();
  await expect(page.getByText("Notifications are on for this device.")).toBeVisible();
  await expect.poll(() => testAuth.pushSubscriptionCount(signedInUser.id)).toBe(1);
  await page.getByRole("button", { name: /^Account menu for / }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL(/\/sign-in/);
  await expect.poll(() => testAuth.pushSubscriptionCount(signedInUser.id)).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem("e2e:push-endpoint"))).toBeNull();

  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(errors).toEqual([]);
});

test("spec 012: explains how to allow notifications after a denial", async ({
  page,
  signedInUser,
  testAuth,
}) => {
  await stubPush(page, "denied");
  await page.goto("/notifications");
  await expect(page.getByText(/blocked for this site/)).toBeVisible();
  await deviceSwitch(page).click();
  await expect(page.getByText(/Allow them in your browser's site settings/)).toBeVisible();
  await expect(deviceSwitch(page)).not.toBeChecked();
  expect(await testAuth.pushSubscriptionCount(signedInUser.id)).toBe(0);
});
