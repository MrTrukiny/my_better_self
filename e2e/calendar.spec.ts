import { expect, test } from "./fixtures";
import {
  calendarSection,
  connectCalendar,
  E2E_CRON_SECRET,
  expectPlanEventually,
  OVERLAP_TEXT,
} from "./support/calendar";
import { addItem, addRoom, openRoom } from "./support/inventory";
import {
  controlWithServiceWorker,
  expectCachedPage,
  goOffline,
  OFFLINE_NOTICE,
} from "./support/offline";
import { planDays, saveSchedule } from "./support/plan";
import { acceptAllProposals, proposeTasks, REPLAN_TIMEOUT } from "./support/tasks";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

test.describe("Google Calendar sync", () => {
  test("AC1, AC3, and AC4: connects, flags overlaps, and follows start time changes", async ({
    page,
    signedInUser,
  }) => {
    test.slow();
    await page.goto("/rooms");
    await addRoom(page, "Kitchen");
    await openRoom(page, "Kitchen");
    await addItem(page, { type: "Floor" });
    await page.goto("/tasks/review");
    await proposeTasks(page, /tasks proposed for the whole home/);
    await acceptAllProposals(page);
    await saveSchedule(page);

    await page.goto("/schedule");
    const section = calendarSection(page);
    await expect(section).toContainText("Adds each day's session to a Cleaning calendar");
    await connectCalendar(page);
    await expect(section).toContainText(signedInUser.email);
    await expect(section.getByRole("button", { name: "Disconnect" })).toBeVisible();

    // The fake calendar is busy from 06:00 to 07:00 every day; sessions start at 06:30.
    await expectPlanEventually(page, async () => {
      await expect(planDays(page)).toHaveCount(7);
      await expect(page.getByText(OVERLAP_TEXT).first()).toBeVisible({ timeout: 1_000 });
    });
    await expect(page.getByRole("link", { name: "Change the start time" }).first()).toHaveAttribute(
      "href",
      "/schedule",
    );

    await page.goto("/schedule");
    for (const day of WEEKDAYS) {
      await page.getByLabel(`${day} start time`).fill("08:00");
    }
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible({
      timeout: REPLAN_TIMEOUT,
    });
    await expectPlanEventually(page, async () => {
      await expect(planDays(page)).toHaveCount(7);
      await expect(page.getByText(OVERLAP_TEXT)).toHaveCount(0, { timeout: 1_000 });
    });
  });

  test("AC1: a cancelled consent connects nothing and says so", async ({
    page,
    signedInUser: _,
  }) => {
    await page.goto("/schedule?calendar=denied&error=access_denied");
    const section = calendarSection(page);
    await expect(section.getByRole("status")).toHaveText(
      "Google Calendar wasn't connected. You can try again whenever you like.",
    );
    await expect(section.getByRole("button", { name: "Connect Google Calendar" })).toBeEnabled();
  });

  test("AC6 and AC8: disconnects with the keyboard after confirming, at 360px in dark mode", async ({
    page,
    signedInUser: _,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.setViewportSize({ width: 360, height: 780 });
    await page.emulateMedia({ colorScheme: "dark" });
    await saveSchedule(page);

    const section = calendarSection(page);
    const connect = section.getByRole("button", { name: "Connect Google Calendar" });
    await connect.focus();
    await page.keyboard.press("Enter");
    await expect(section.getByRole("status")).toHaveText("Connected: Cleaning", {
      timeout: REPLAN_TIMEOUT,
    });
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360,
    );

    const disconnect = section.getByRole("button", { name: "Disconnect" });
    await disconnect.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("alertdialog", { name: "Disconnect Google Calendar?" });
    await expect(dialog).toContainText("The Cleaning calendar and its events will be deleted");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(section.getByRole("status")).toHaveText("Connected: Cleaning");

    await disconnect.focus();
    await page.keyboard.press("Enter");
    await dialog.getByRole("button", { name: "Disconnect calendar" }).focus();
    await page.keyboard.press("Enter");
    await expect(connect).toBeVisible({ timeout: REPLAN_TIMEOUT });
    await expect(section).not.toContainText("Connected");

    await page.goto("/plan");
    await expect(page.getByRole("heading", { level: 1, name: "Your week" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("AC8: calendar controls are disabled offline, and the status stays readable", async ({
    page,
    context,
    signedInUser: _,
  }) => {
    test.slow();
    await page.goto("/schedule");
    await controlWithServiceWorker(page);
    await saveSchedule(page);
    await connectCalendar(page);
    await expectCachedPage(page, "/schedule", "Connected: ");

    await goOffline(page, context);
    await page.goto("/schedule");
    const schedule = page.getByRole("region", { name: "Schedule" });
    await expect(schedule.getByText(OFFLINE_NOTICE)).toBeVisible();
    const section = calendarSection(page);
    await expect(section.getByRole("status")).toHaveText("Connected: Cleaning");
    await expect(section.getByRole("button", { name: "Disconnect" })).toBeDisabled();

    await context.setOffline(false);
    await expect(section.getByRole("button", { name: "Disconnect" })).toBeEnabled();
  });
});

test.describe("Daily job", () => {
  test("AC5: rejects callers without the job secret and runs with it", async ({ request }) => {
    const missing = await request.get("/api/cron/daily", { maxRedirects: 0 });
    expect(missing.status()).toBe(401);
    const wrong = await request.get("/api/cron/daily", {
      headers: { authorization: "Bearer wrong" },
      maxRedirects: 0,
    });
    expect(wrong.status()).toBe(401);

    const ok = await request.get("/api/cron/daily", {
      headers: { authorization: `Bearer ${E2E_CRON_SECRET}` },
      timeout: 60_000,
    });
    expect(ok.status()).toBe(200);
    // Other tests connect and delete owners meanwhile, so only the shape is stable here.
    expect(await ok.json()).toEqual({
      owners: expect.any(Number),
      synced: expect.any(Number),
      failed: expect.any(Number),
    });
  });
});
