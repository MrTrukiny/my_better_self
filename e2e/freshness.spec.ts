import { expect, test } from "./fixtures";
import { addRoom } from "./support/inventory";
import { controlWithServiceWorker, expectCachedPage, openOffline } from "./support/offline";
import { REPLAN_TIMEOUT } from "./support/tasks";
import { cleaningToday, setUpToday, waitForSync } from "./support/today";

test("spec 014: rooms show how fresh they are, follow check-offs, and keep it offline", async ({
  page,
  context,
  signedInUser,
  testAuth,
}) => {
  test.slow();
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("ERR_INTERNET_DISCONNECTED")) {
      errors.push(message.text());
    }
  });
  await setUpToday(page);
  await page.goto("/rooms");
  await addRoom(page, "Bathroom");
  // The kitchen's tasks were added 10 days ago and never done; the 3-day one is far behind.
  await testAuth.ageTasks(signedInUser.id, 10);

  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/rooms");
  const list = page.getByRole("list", { name: "Rooms" });
  // AC1, AC6, AC8: a state with its room's name, or "No tasks yet".
  await expect(list.getByRole("link", { name: "Kitchen, Overdue, 1 item" })).toBeVisible();
  await expect(list.getByRole("link", { name: "Bathroom, No tasks yet, No items" })).toBeVisible();

  // AC5: the room page says it was never cleaned.
  await list.getByRole("link", { name: /^Kitchen/ }).click();
  const kitchen = page.getByRole("region", { name: "Kitchen" });
  await expect(kitchen.getByText("Overdue")).toBeVisible();
  await expect(kitchen.getByText("Not cleaned yet")).toBeVisible();

  // AC4: checking today's task freshens the room; unchecking reverts it.
  await page.goto("/");
  const box = cleaningToday(page).getByRole("checkbox").first();
  await expect(box).toBeVisible({ timeout: REPLAN_TIMEOUT });
  await box.check();
  await waitForSync(page);
  await page.goto("/rooms");
  await expect(list.getByRole("link", { name: "Kitchen, Good, 1 item" })).toBeVisible();
  await list.getByRole("link", { name: /^Kitchen/ }).click();
  await expect(kitchen.getByText("Last cleaned today")).toBeVisible();

  await page.goto("/");
  await box.uncheck();
  await waitForSync(page);
  await page.goto("/rooms");
  await expect(list.getByRole("link", { name: "Kitchen, Overdue, 1 item" })).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(errors).toEqual([]);

  // AC7: offline, the rooms page shows its last copy.
  await controlWithServiceWorker(page);
  await expectCachedPage(page, "/rooms", "Overdue");
  await openOffline(page, context, "/rooms");
  await expect(list.getByRole("link", { name: "Kitchen, Overdue, 1 item" })).toBeVisible();
});
