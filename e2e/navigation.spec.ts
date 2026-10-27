import { expect, test } from "./fixtures";
import { controlWithServiceWorker, expectCachedPage, openOffline } from "./support/offline";
import { saveSchedule } from "./support/plan";

const DESTINATIONS = ["Today", "Plan", "Tasks", "Rooms", "Settings"];

test.describe("App navigation", () => {
  test("AC1, AC3, AC8: a tab bar at the bottom on a phone, usable with the keyboard", async ({
    page,
    signedInUser: _,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.setViewportSize({ width: 360, height: 740 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/rooms");

    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav).toHaveCount(1);
    await expect(nav.getByRole("link")).toHaveText(DESTINATIONS);
    await expect(nav.getByRole("link", { name: "Rooms" })).toHaveAttribute("aria-current", "page");
    const bar = await nav.boundingBox();
    expect(bar && bar.y + bar.height).toBeCloseTo(740, 0);
    for (const link of await nav.getByRole("link").all()) {
      expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }

    await nav.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // The last row isn't hidden behind the tab bar.
    const lastRow = page.getByRole("list", { name: "Settings" }).getByRole("link").last();
    await lastRow.scrollIntoViewIfNeeded();
    const row = await lastRow.boundingBox();
    const barNow = await nav.boundingBox();
    expect(row && barNow && row.y + row.height).toBeLessThanOrEqual(barNow?.y ?? 0);

    // The schedule page belongs to Settings.
    await page.getByRole("list", { name: "Settings" }).getByRole("link").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Schedule" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    const plan = nav.getByRole("link", { name: "Plan" });
    await plan.focus();
    await expect(plan).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Your week" })).toBeVisible();
    await expect(plan).toHaveAttribute("aria-current", "page");

    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(errors).toEqual([]);
  });

  test("AC2: the same destinations in the top bar on desktop, without a tab bar", async ({
    page,
    signedInUser: _,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/tasks/review");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav).toHaveCount(1);
    await expect(page.getByRole("banner").getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(nav.getByRole("link")).toHaveText(DESTINATIONS);
    await expect(nav.getByRole("link", { name: "Tasks" })).toHaveAttribute("aria-current", "page");
  });

  test("AC4, AC5, AC6: Settings summarizes and opens the schedule, calendar, and home profile", async ({
    page,
    signedInUser: _,
  }) => {
    test.slow();
    await page.goto("/settings");
    const rows = page.getByRole("list", { name: "Settings" });
    await expect(rows.getByRole("link", { name: /^Schedule/ })).toContainText("Not set");
    await expect(rows.getByRole("link", { name: /^Google Calendar/ })).toContainText(
      "Not connected",
    );
    await expect(rows.getByRole("link", { name: /^Home profile/ })).toContainText("No helpers");

    await rows.getByRole("link", { name: /^Home profile/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Home profile" })).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();

    await rows.getByRole("link", { name: /^Google Calendar/ }).click();
    await expect(page).toHaveURL(/\/schedule#calendar$/);
    await expect(page.getByRole("heading", { name: "Google Calendar" })).toBeInViewport();
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();

    await saveSchedule(page);
    await page.getByRole("main").getByRole("link", { name: "Settings", exact: true }).click();
    await expect(rows.getByRole("link", { name: /^Schedule/ })).toContainText(
      "Every day 06:30 · 45–60 min",
    );
  });

  test("AC7: Settings opens offline with its last summaries", async ({
    page,
    context,
    signedInUser: _,
  }) => {
    test.slow();
    await page.goto("/settings");
    await controlWithServiceWorker(page);
    await expectCachedPage(page, "/settings", "No helpers");

    await openOffline(page, context, "/settings");
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Settings" })).toContainText("Not set");
  });
});
