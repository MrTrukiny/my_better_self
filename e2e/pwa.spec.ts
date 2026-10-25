import { expect, test } from "./fixtures";

test("home page renders the app shell", async ({ page, signedInUser }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Toggle color theme" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Account menu for ${signedInUser.name}` }),
  ).toBeVisible();
});

test("serves a valid web app manifest", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();

  const response = await request.get(href as string);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
});

test("registers and activates the service worker", async ({ page }) => {
  await page.goto("/");
  const scope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.scope;
  });
  expect(scope).toMatch(/\/$/);
});

test("serves the offline fallback for uncached pages", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  // A fresh tab: an already-open page keeps Next's in-app offline handling active,
  // which retries the navigation instead of loading the fallback document.
  const offlineTab = await context.newPage();
  await offlineTab.goto("/route-that-was-never-cached");
  await expect(offlineTab.getByRole("heading", { name: "You are offline" })).toBeVisible();
  await context.setOffline(false);
});
