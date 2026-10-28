import { expect, test } from "./fixtures";
import { REPLAN_TIMEOUT } from "./support/tasks";
import { cleaningToday, setUpToday, TODAY_OFFLINE_NOTICE, waitForSync } from "./support/today";

const DAY_NAME = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), /;

test.describe("Earlier days", () => {
  test("AC7: a new owner has no earlier days", async ({ page, signedInUser: _ }) => {
    await page.goto("/earlier-days");
    await expect(page.getByRole("heading", { level: 1, name: "Earlier days" })).toBeVisible();
    await expect(page.getByText(/No earlier days yet/)).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Today" }).first(),
    ).toHaveAttribute("aria-current", "page");
  });

  test("AC1–AC3, AC6, AC8: checks off yesterday's session with the keyboard, also offline", async ({
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
    await page.goto("/");
    await expect(page.getByRole("list", { name: "Cleaning today" })).toBeVisible({
      timeout: REPLAN_TIMEOUT,
    });
    await testAuth.moveFirstDayBack(signedInUser.id, 1);

    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    const link = page.getByRole("link", { name: "Earlier days · 1 unchecked" });
    await expect(link).toBeVisible({ timeout: REPLAN_TIMEOUT });
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/earlier-days$/);

    const day = page.getByRole("region", { name: DAY_NAME }).first();
    const dayName = (await day.getByRole("heading", { level: 2 }).textContent())?.trim() ?? "";
    const boxes = day.getByRole("list", { name: `Cleaning on ${dayName}` }).getByRole("checkbox");
    const count = await boxes.count();
    expect(count).toBeGreaterThan(0);
    await expect(day.getByText(`0 of ${count} done`)).toBeVisible();
    await expect(boxes.first()).toHaveAccessibleName(new RegExp(`, ${dayName}`));

    // The last one is checked offline and sent when the connection returns.
    for (let i = 0; i < count - 1; i++) {
      await boxes.nth(i).focus();
      await page.keyboard.press("Space");
      await expect(boxes.nth(i)).toBeChecked();
    }
    await waitForSync(page);

    await context.setOffline(true);
    const earlier = page.getByRole("region", { name: "Earlier days" });
    await expect(earlier.getByText(TODAY_OFFLINE_NOTICE, { exact: true })).toBeVisible();
    await boxes.nth(count - 1).focus();
    await page.keyboard.press("Space");
    await expect(boxes.nth(count - 1)).toBeChecked();
    await expect(day.getByText("Saved on this device", { exact: true })).toBeVisible();
    await context.setOffline(false);
    await waitForSync(page);
    await expect(day.getByText(`${count} of ${count} done`)).toBeVisible();

    // A complete day starts closed.
    await page.reload();
    await expect(day.getByText(`${count} of ${count} done`)).toBeVisible();
    await expect(boxes.first()).toBeHidden();
    await day.getByText(dayName, { exact: true }).click();
    for (let i = 0; i < count; i++) {
      await expect(boxes.nth(i)).toBeChecked();
    }

    // AC4: unchecking a past task plans it again from today; checking it takes it back out.
    const taskName = (
      await boxes.first().evaluate((box) => {
        const label = document.getElementById(box.getAttribute("aria-labelledby") ?? "");
        return label?.textContent ?? "";
      })
    ).split(",")[0];
    const todayPage = await context.newPage();
    await boxes.first().uncheck();
    await waitForSync(page);
    await todayPage.goto("/");
    await expect(cleaningToday(todayPage)).toContainText(taskName, { timeout: REPLAN_TIMEOUT });
    await boxes.first().check();
    await waitForSync(page);
    await todayPage.reload();
    await expect(todayPage.getByText("Nothing to clean today, enjoy the day.")).toBeVisible({
      timeout: REPLAN_TIMEOUT,
    });
    await todayPage.close();

    // The completed day counts toward the streak, and the link has nothing left to check.
    await page.goto("/");
    await expect(page.getByText("1-day streak")).toBeVisible({ timeout: REPLAN_TIMEOUT });
    await expect(page.getByText("Nothing to clean today, enjoy the day.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Earlier days", exact: true })).toBeVisible();

    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(errors).toEqual([]);
  });
});
