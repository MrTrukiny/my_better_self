import { expect, test } from "./fixtures";
import { addItem, addRoom, openRoom } from "./support/inventory";
import { controlWithServiceWorker, expectCachedPage, OFFLINE_NOTICE } from "./support/offline";
import { proposalGroup, proposeTasks } from "./support/tasks";

test("AC8: task pages stay readable offline with generation and edits disabled", async ({
  page,
  context,
  signedInUser: _,
}) => {
  await page.goto("/rooms");
  await controlWithServiceWorker(page);
  await addRoom(page, "Bathroom");
  await openRoom(page, "Bathroom");
  await addItem(page, { type: "Mirror" });

  await page.goto("/tasks/review");
  await proposeTasks(page, /tasks proposed for the whole home/);
  await proposalGroup(page, "Bathroom")
    .getByRole("button", { name: "Accept Clean Mirror" })
    .click();
  await expect(proposalGroup(page, "Bathroom").getByText("Clean Mirror")).toBeHidden();
  await expectCachedPage(page, "/tasks", "3 proposals waiting for review");
  await expectCachedPage(page, "/tasks/review", "Bathroom deep clean");

  await context.setOffline(true);
  await page.goto("/tasks");
  const tasks = page.getByRole("region", { name: "Tasks" });
  await expect(tasks.getByText(OFFLINE_NOTICE)).toBeVisible();
  await expect(tasks.getByRole("region", { name: "Cleaning tasks" })).toContainText("Clean Mirror");
  await expect(tasks.getByRole("button", { name: "Edit Clean Mirror" })).toBeDisabled();
  await expect(tasks.getByRole("button", { name: "Delete Clean Mirror" })).toBeDisabled();

  await tasks.getByRole("link", { name: /waiting for review/ }).click();
  const review = page.getByRole("region", { name: "Propose tasks" });
  await expect(review.getByText(OFFLINE_NOTICE)).toBeVisible();
  await expect(review.getByRole("button", { name: "Propose tasks" })).toBeDisabled();
  await expect(review.getByRole("combobox", { name: "Propose for" })).toBeDisabled();
  await expect(proposalGroup(page, "Bathroom")).toContainText("Bathroom deep clean");
  await expect(review.getByRole("button", { name: "Accept Bathroom deep clean" })).toBeDisabled();
  await expect(review.getByRole("button", { name: /Accept all/ })).toBeDisabled();

  await context.setOffline(false);
  await expect(review.getByRole("button", { name: "Propose tasks" })).toBeEnabled();
});
