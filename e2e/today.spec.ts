import { expect, test } from "./fixtures";
import { weekdayFromToday } from "./support/plan";
import { REPLAN_TIMEOUT } from "./support/tasks";
import { cleaningToday, setUpToday, waitForSync } from "./support/today";

test.describe("Today", () => {
  test("AC1: asks for a schedule before there is a session", async ({ page, signedInUser: _ }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Set your schedule" })).toBeVisible();
    await expect(page.getByRole("link", { name: "See your week" })).toBeVisible();
  });

  test("AC1, AC2, AC3, AC5, AC8: checks off and skips today's session with the keyboard", async ({
    page,
    signedInUser: _,
  }) => {
    test.slow();
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await setUpToday(page);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");

    const session = cleaningToday(page);
    const boxes = session.getByRole("checkbox");
    await expect(boxes.first()).toBeVisible({ timeout: REPLAN_TIMEOUT });
    const count = await boxes.count();
    expect(count).toBeGreaterThan(0);
    // setUpToday starts today's session at 23:59; it lasts the day's default budget.
    const weekend = ["Saturday", "Sunday"].includes(weekdayFromToday(0));
    const sessionWindow = weekend ? "23:59–00:59 · \\d+ of 60 min" : "23:59–00:44 · \\d+ of 45 min";
    await expect(page.getByText(new RegExp(sessionWindow))).toBeVisible();
    await expect(page.getByText("Start a streak today")).toBeVisible();
    await expect(page.getByText(/^0 of \d+ min done$/)).toBeVisible();
    await expect(page.getByRole("list", { name: "Routines today" })).toContainText(
      "Take out the trash",
    );

    // Skip the last task and bring it back.
    const skip = session.getByRole("button", { name: /^Skip / }).last();
    const skipName = (await skip.getAttribute("aria-label"))?.replace("Skip ", "") ?? "";
    await skip.focus();
    await page.keyboard.press("Enter");
    await expect(session.getByRole("button", { name: `Undo skipping ${skipName}` })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(session.getByRole("button", { name: `Skip ${skipName}` })).toBeVisible();

    // Check everything with the keyboard; the last one completes the day.
    for (let i = 0; i < count; i++) {
      await boxes.nth(i).focus();
      await page.keyboard.press("Space");
      await expect(boxes.nth(i)).toBeChecked();
    }
    await expect(page.getByText("Done for today. 1-day streak.")).toBeVisible();

    await waitForSync(page);
    await page.reload();
    await expect(boxes.first()).toBeChecked();
    await expect(boxes).toHaveCount(count);
    for (let i = 0; i < count; i++) {
      await expect(boxes.nth(i)).toBeChecked();
    }
    await expect(page.getByText("Done for today. 1-day streak.")).toBeVisible();

    // Unchecking undoes it.
    await boxes.first().uncheck();
    await expect(page.getByText("Start a streak today")).toBeVisible();
    await waitForSync(page);
    await page.reload();
    await expect(boxes.first()).not.toBeChecked();

    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(errors).toEqual([]);
  });
});
