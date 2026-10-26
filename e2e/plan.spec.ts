import { expect, test } from "./fixtures";
import { addItem, addRoom, openRoom } from "./support/inventory";
import { planDays, saveSchedule, weekdayFromToday } from "./support/plan";
import { acceptAllProposals, proposeTasks, REPLAN_TIMEOUT } from "./support/tasks";

test.describe("Scheduler", () => {
  test("AC1: asks for a schedule first, then saves days, times, and budgets", async ({
    page,
    signedInUser: _,
  }) => {
    await page.goto("/plan");
    await expect(page.getByRole("heading", { name: "Set your schedule" })).toBeVisible();
    await page.getByRole("link", { name: "Set your schedule" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Schedule" })).toBeVisible();
    await expect(page.getByLabel("Monday start time")).toHaveValue("06:30");
    await page.getByRole("checkbox", { name: "Tuesday", exact: true }).uncheck();
    await expect(page.getByLabel("Tuesday start time")).toBeDisabled();
    await page.getByLabel("Saturday start time").fill("09:15");
    await page.getByLabel("Weekend minutes").fill("200");
    await page.getByRole("button", { name: "Save" }).click();

    const weekend = page.getByLabel("Weekend minutes");
    await expect(weekend).toHaveAccessibleDescription("Enter whole minutes from 30 to 120.");
    await expect(weekend).toBeFocused();
    await weekend.fill("90");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("checkbox", { name: "Tuesday", exact: true })).not.toBeChecked();
    await expect(page.getByLabel("Saturday start time")).toHaveValue("09:15");
    await expect(page.getByLabel("Weekend minutes")).toHaveValue("90");

    await page.getByRole("link", { name: "Plan", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Tasks come first" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Propose tasks" })).toBeVisible();
  });

  test("AC2, AC3, and AC6: plans the week within budget and replans when tasks change", async ({
    page,
    signedInUser: _,
  }) => {
    test.slow();
    await page.goto("/rooms");
    await addRoom(page, "Kitchen");
    await openRoom(page, "Kitchen");
    await addItem(page, { type: "Floor" });
    await page.goto("/tasks/review");
    await proposeTasks(page, /tasks proposed for the whole home/);
    await acceptAllProposals(page);

    const tomorrow = weekdayFromToday(1);
    await saveSchedule(page, { daysOff: [tomorrow] });
    await page.getByRole("link", { name: "See your week" }).click();

    const days = planDays(page);
    await expect(days).toHaveCount(7);
    await expect(days.first()).toContainText("Today");
    await expect(
      page.getByText(/Your tasks need about \d+ min a day; you have about \d+\./),
    ).toBeVisible();

    const dayOff = days.nth(1);
    await expect(dayOff.getByRole("heading", { level: 2 })).toContainText(tomorrow);
    await expect(dayOff).toContainText("Day off");
    await expect(dayOff.getByRole("list", { name: /^Cleaning on/ })).toHaveCount(0);
    await expect(dayOff.getByRole("list", { name: /^Routines on/ })).toContainText(
      "Take out the trash",
    );

    // Every 3 days: it comes up within the first 3 days, then at least once more in the week.
    const surface = days.filter({ hasText: "Kitchen surface clean" });
    expect(await surface.count()).toBeGreaterThanOrEqual(2);
    for (const totals of await days.getByText(/ of \d+ min$/).allTextContents()) {
      const [, used, budget] = /(\d+) of (\d+) min/.exec(totals) ?? [];
      expect(Number(used)).toBeLessThanOrEqual(Number(budget));
    }

    await page.goto("/tasks");
    await page.getByRole("button", { name: "Delete Kitchen surface clean" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Kitchen surface clean", { exact: true })).toBeHidden({
      timeout: REPLAN_TIMEOUT,
    });
    await page.goto("/plan");
    await expect(planDays(page)).toHaveCount(7);
    await expect(page.getByText("Kitchen surface clean")).toHaveCount(0);
  });
});
