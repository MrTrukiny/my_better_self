import { expect, test } from "./fixtures";
import { REPLAN_TIMEOUT, saveHomeProfile } from "./support/tasks";
import { setUpToday } from "./support/today";

const SURFACE = "Kitchen surface clean";
const DEEP = "Kitchen deep clean";
const FLOOR = "Clean Floor";

test("spec 017 AC1–AC7: AI adjustments from recorded times and notes", async ({
  page,
  context,
  signedInUser,
  testAuth,
}) => {
  test.slow();
  const errors: string[] = [];
  page.on("console", (message) => {
    // Requests made while offline fail by design.
    if (message.type() === "error" && !message.text().includes("ERR_INTERNET_DISCONNECTED")) {
      errors.push(message.text());
    }
  });
  await setUpToday(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ colorScheme: "dark" });

  // AC1: nothing recorded yet.
  await page.goto("/tasks");
  await page.getByRole("link", { name: "Suggest adjustments" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Adjustments" })).toBeVisible();
  const suggest = page.getByRole("button", { name: "Suggest adjustments" });
  await expect(suggest).toBeDisabled();
  await expect(suggest).toHaveAccessibleDescription(
    "Record times or add notes to get suggestions.",
  );

  await testAuth.recordPastTimes(signedInUser.id, SURFACE, [15, 16, 15, 14]);
  await testAuth.recordPastTimes(signedInUser.id, FLOOR, [3]);
  await testAuth.noteLatestTime(signedInUser.id, FLOOR, "Full deep clean, moved the table");
  await testAuth.recordPastTimes(signedInUser.id, DEEP, [30]);
  await testAuth.noteLatestTime(signedInUser.id, DEEP, "Guests came");
  await page.reload();
  await expect(page.getByText("Reviews 3 tasks with recorded times or notes")).toBeVisible();

  // AC2, AC3, AC7: asked with the keyboard; each change says why.
  await suggest.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "3 adjustments suggested." }),
  ).toBeVisible({
    timeout: REPLAN_TIMEOUT,
  });
  const kitchen = page.getByRole("list", { name: "Kitchen" });
  await expect(kitchen.getByRole("listitem")).toHaveCount(3);
  const minutesCard = kitchen.getByRole("listitem").filter({ hasText: "10 → 15 min" });
  await expect(minutesCard).toContainText("Your last 4 times are closer to 15 min.");
  await expect(minutesCard).toContainText("Last 4: 14, 15, 16, 15 min");
  await expect(kitchen).toContainText(`New: Deep clean: ${FLOOR}, 30 min, every 30 days`);
  await expect(kitchen).toContainText("Note on");

  // AC6: pending suggestions survive a reload, and asking again replaces them.
  await page.reload();
  await expect(kitchen.getByRole("listitem")).toHaveCount(3);
  await suggest.click();
  await expect(
    page.getByRole("status").filter({ hasText: "3 adjustments suggested." }),
  ).toBeVisible({
    timeout: REPLAN_TIMEOUT,
  });
  await expect(kitchen.getByRole("listitem")).toHaveCount(3);

  // AC4: discard one, accept a new task, and edit the minutes before accepting.
  await page.getByRole("button", { name: `Discard adjustment for ${DEEP}` }).click();
  await expect(kitchen.getByRole("listitem")).toHaveCount(2);
  await page.getByRole("button", { name: `Accept adjustment for ${FLOOR}` }).click();
  await expect(kitchen.getByRole("listitem")).toHaveCount(1, { timeout: REPLAN_TIMEOUT });
  await page.getByRole("button", { name: `Edit adjustment for ${SURFACE}` }).click();
  const dialog = page.getByRole("dialog", { name: `Edit ${SURFACE}` });
  await expect(dialog.getByLabel("Minutes")).toHaveValue("15");
  await dialog.getByLabel("Minutes").fill("14");
  await dialog.getByRole("button", { name: "Accept" }).click();
  await expect(dialog).toBeHidden({ timeout: REPLAN_TIMEOUT });
  await expect(page.getByRole("heading", { name: "Pending adjustments" })).toBeHidden();

  await page.goto("/tasks");
  const tasks = page.getByRole("list", { name: "Kitchen" }).first();
  await expect(tasks.getByRole("listitem").filter({ hasText: SURFACE })).toContainText("14 min");
  await expect(
    tasks.getByRole("listitem").filter({ hasText: `Deep clean: ${FLOOR}` }),
  ).toContainText("30 min");
  await expect(tasks.getByRole("listitem").filter({ hasText: `Deep clean: ${DEEP}` })).toHaveCount(
    0,
  );

  // AC5: a failed request offers to try again and changes nothing.
  await saveHomeProfile(page, { note: "[fail]" });
  await page.goto("/tasks/adjustments");
  await suggest.click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Couldn't suggest adjustments." }),
  ).toBeVisible({ timeout: REPLAN_TIMEOUT });
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pending adjustments" })).toBeHidden();

  // AC7: asking is disabled offline.
  await context.setOffline(true);
  await expect(suggest).toBeDisabled();
  await context.setOffline(false);

  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(errors).toEqual([]);
});
