import { expect, type Page } from "@playwright/test";
import { addItem, addRoom, openRoom } from "./inventory";
import { weekdayFromToday } from "./plan";
import { acceptAllProposals, proposeTasks, REPLAN_TIMEOUT } from "./tasks";

/**
 * A kitchen with a floor (or the given item types), its proposed tasks, and a schedule whose
 * start time today is late, so today's session is still ahead whenever the test runs.
 */
export async function setUpToday(page: Page, itemTypes: string[] = ["Floor"]) {
  await page.goto("/rooms");
  await addRoom(page, "Kitchen");
  await openRoom(page, "Kitchen");
  for (const type of itemTypes) {
    await addItem(page, { type });
  }
  await page.goto("/tasks/review");
  await proposeTasks(page, /tasks proposed for the whole home/);
  await acceptAllProposals(page);

  await page.goto("/schedule");
  await page.getByLabel(`${weekdayFromToday(0)} start time`).fill("23:59");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible({
    timeout: REPLAN_TIMEOUT,
  });
}

export function cleaningToday(page: Page) {
  return page.getByRole("list", { name: "Cleaning today" });
}

export function tookField(page: Page) {
  return cleaningToday(page).getByRole("textbox", { name: /^Minutes taken for / });
}

export const TODAY_OFFLINE_NOTICE =
  "You're offline. What you check is saved on this device and syncs when you're back.";

/**
 * Waits until every check-off on this device has reached the server. Next reloads the page when
 * the connection comes back, so a read that lands mid-navigation just polls again.
 */
export async function waitForSync(page: Page) {
  await expect
    .poll(
      () =>
        page
          .evaluate(() => Object.keys(localStorage).some((key) => key.startsWith("mbs:check-off:")))
          .catch(() => true),
      { timeout: REPLAN_TIMEOUT },
    )
    .toBe(false);
}
