import { expect, test } from "./fixtures";
import { addItem, addRoom, openRoom } from "./support/inventory";
import {
  controlWithServiceWorker,
  expectCachedPage,
  goOffline,
  OFFLINE_NOTICE,
} from "./support/offline";
import { planDays, saveSchedule } from "./support/plan";
import { acceptAllProposals, proposeTasks } from "./support/tasks";

test("AC7: the plan stays readable offline and the schedule can't be changed", async ({
  page,
  context,
  signedInUser: _,
}) => {
  test.slow();
  await page.goto("/rooms");
  await controlWithServiceWorker(page);
  await addRoom(page, "Kitchen");
  await openRoom(page, "Kitchen");
  await addItem(page, { type: "Floor" });
  await page.goto("/tasks/review");
  await proposeTasks(page, /tasks proposed for the whole home/);
  await acceptAllProposals(page);
  await saveSchedule(page);

  await page.goto("/plan");
  await expect(planDays(page)).toHaveCount(7);
  await expectCachedPage(page, "/plan", "Kitchen surface clean");
  await expectCachedPage(page, "/schedule", "Weekend minutes");

  await goOffline(page, context);
  await page.goto("/plan");
  const plan = page.getByRole("region", { name: "Your week" });
  await expect(plan.getByText(OFFLINE_NOTICE)).toBeVisible();
  await expect(planDays(page)).toHaveCount(7);
  await expect(plan).toContainText("Kitchen surface clean");

  await plan.getByRole("link", { name: "Schedule" }).click();
  const schedule = page.getByRole("region", { name: "Schedule" });
  await expect(schedule.getByText(OFFLINE_NOTICE)).toBeVisible();
  await expect(schedule.getByRole("checkbox", { name: "Monday" })).toBeDisabled();
  await expect(schedule.getByLabel("Weekday minutes")).toBeDisabled();
  await expect(schedule.getByRole("button", { name: "Save" })).toBeDisabled();

  await context.setOffline(false);
  await expect(schedule.getByRole("button", { name: "Save" })).toBeEnabled();
});
