import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { addItem, addRoom, openRoom } from "./support/inventory";

const NOTICE = "You're offline. You can browse what's saved, but changes need a connection.";

/** Waits until the service worker holds a copy of `path` that contains `text`. */
async function expectCachedPage(page: Page, path: string, text: string) {
  await expect
    .poll(() =>
      page.evaluate(
        async ([url, expected]) => {
          const cached = await caches.match(url);
          return cached ? (await cached.text()).includes(expected) : false;
        },
        [path, text],
      ),
    )
    .toBe(true);
}

test("AC7: shows the latest inventory offline with edits disabled, and re-enables them online", async ({
  page,
  context,
  signedInUser: _,
}) => {
  await page.goto("/rooms");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await addRoom(page, "Kitchen");
  await addRoom(page, "Bathroom");
  await openRoom(page, "Kitchen");
  await addItem(page, { type: "Sink" });
  const kitchenPath = new URL(page.url()).pathname;
  await expectCachedPage(page, kitchenPath, "Sink");
  await expectCachedPage(page, "/rooms", "Bathroom");

  await context.setOffline(true);
  await page.goto("/rooms");

  const rooms = page.getByRole("region", { name: "Rooms" });
  await expect(rooms.getByRole("list", { name: "Rooms" })).toContainText("Kitchen");
  await expect(rooms.getByText(NOTICE)).toBeVisible();
  await expect(rooms.getByRole("button", { name: "Add room" })).toBeDisabled();

  await openRoom(page, "Kitchen");
  const kitchen = page.getByRole("region", { name: "Kitchen" });
  await expect(kitchen.getByRole("list", { name: "Items in Kitchen" })).toContainText("Sink");
  await expect(kitchen.getByRole("button", { name: "Add item" })).toBeDisabled();
  await expect(kitchen.getByRole("button", { name: "Edit Sink" })).toBeDisabled();
  await expect(kitchen.getByRole("button", { name: "Rename" })).toBeDisabled();
  await expect(kitchen.getByText(NOTICE)).toBeVisible();

  await context.setOffline(false);
  await expect(kitchen.getByRole("button", { name: "Add item" })).toBeEnabled();
  await expect(kitchen.getByText(NOTICE)).toBeHidden();
});
