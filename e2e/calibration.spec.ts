import { expect, test } from "./fixtures";
import { REPLAN_TIMEOUT } from "./support/tasks";
import { cleaningToday, setUpToday, tookField, waitForSync } from "./support/today";

test("spec 011 AC1, AC3–AC5, AC8: recorded times calibrate an estimate; a manual edit resets it", async ({
  page,
  signedInUser,
  testAuth,
}) => {
  test.slow();
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await setUpToday(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  // Today's first task, with its estimate.
  const row = cleaningToday(page).getByRole("listitem").first();
  await expect(row).toBeVisible({ timeout: REPLAN_TIMEOUT });
  const taskName =
    (await row.getByRole("checkbox").evaluate((box) => {
      const label = document.getElementById(box.getAttribute("aria-labelledby") ?? "");
      return label?.querySelector("span > span")?.textContent ?? "";
    })) || "";
  const estimate = Number(/(\d+) min/.exec((await row.textContent()) ?? "")?.[1]);
  expect(taskName).not.toBe("");
  const actual = estimate >= 20 ? estimate - 5 : estimate + 5;

  // Three times from earlier days calibrate it as soon as today's is checked; the time recorded
  // today keeps the median where it is.
  await testAuth.recordPastTimes(signedInUser.id, taskName, [actual, actual + 1, actual - 1]);
  await row.getByRole("checkbox").check();
  await tookField(page).fill(String(actual));
  await tookField(page).press("Enter");
  await waitForSync(page);

  // AC3: today's session started, so it keeps the minutes it was planned with.
  await page.reload();
  await expect(row).toContainText(`${estimate} min`);

  // AC4: the tasks page and the edit form explain the new estimate.
  const note = `Adjusted from ${estimate} to ${actual} min from your last 3 times`;
  await page.goto("/tasks");
  const taskRow = page.getByRole("listitem").filter({ hasText: taskName });
  await expect(taskRow).toContainText(note, { timeout: REPLAN_TIMEOUT });
  await expect(taskRow).toContainText(`${actual} min`);
  await taskRow.getByRole("button", { name: `Edit ${taskName}` }).click();
  const dialog = page.getByRole("dialog", { name: "Edit task" });
  const minutes = dialog.getByRole("spinbutton", { name: "Minutes" });
  await expect(minutes).toHaveValue(String(actual));
  await expect(minutes).toHaveAccessibleDescription(new RegExp(note));

  // AC5: minutes set by hand are kept, and the note goes away.
  await minutes.fill(String(estimate));
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden({ timeout: REPLAN_TIMEOUT });
  await expect(taskRow).toContainText(`${estimate} min`);
  await expect(taskRow).not.toContainText("Adjusted from");

  // Older times no longer count: changing today's time doesn't calibrate again.
  await page.goto("/");
  await tookField(page).fill(String(actual + 1));
  await tookField(page).press("Enter");
  await waitForSync(page);
  await page.goto("/tasks");
  await expect(taskRow).toContainText(`${estimate} min`);
  await expect(taskRow).not.toContainText("Adjusted from");

  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(errors).toEqual([]);
});
