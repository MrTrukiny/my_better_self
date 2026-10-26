import { expect, test } from "./fixtures";
import { controlWithServiceWorker, expectCachedPage } from "./support/offline";
import { REPLAN_TIMEOUT } from "./support/tasks";
import { cleaningToday, setUpToday, TODAY_OFFLINE_NOTICE, waitForSync } from "./support/today";

test("AC6: check-offs made offline are kept on the device and synced when back online", async ({
  page,
  context,
  signedInUser: _,
}) => {
  test.slow();
  await setUpToday(page);
  await page.goto("/");
  await controlWithServiceWorker(page);
  const first = cleaningToday(page).getByRole("checkbox").first();
  await expect(first).toBeVisible({ timeout: REPLAN_TIMEOUT });
  await expectCachedPage(page, "/", "Cleaning today");

  await context.setOffline(true);
  await expect(page.getByText(TODAY_OFFLINE_NOTICE)).toBeVisible();
  await first.check();
  await expect(first).toBeChecked();
  await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();

  // Reopened offline, the change is still there.
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("/");
  await expect(reopened.getByText(TODAY_OFFLINE_NOTICE)).toBeVisible();
  await expect(cleaningToday(reopened).getByRole("checkbox").first()).toBeChecked();
  await expect(reopened.getByText("Saved on this device", { exact: true })).toBeVisible();

  await context.setOffline(false);
  await expect(reopened.getByText("Saved on this device", { exact: true })).toBeHidden({
    timeout: REPLAN_TIMEOUT,
  });
  await waitForSync(reopened);
  await reopened.reload();
  await expect(cleaningToday(reopened).getByRole("checkbox").first()).toBeChecked();
});
