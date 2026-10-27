import { expect, test } from "./fixtures";
import { weekdayFromToday } from "./support/plan";
import { REPLAN_TIMEOUT } from "./support/tasks";
import { cleaningToday, setUpToday, tookField, waitForSync } from "./support/today";

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

  test("spec 009 AC1–AC5, AC7, AC8: an ordered session with slots, and the minutes a task took", async ({
    page,
    signedInUser: _,
  }) => {
    test.slow();
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await setUpToday(page, ["Floor", "Shelf"]);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");

    const session = cleaningToday(page);
    const rows = session.getByRole("listitem");
    await expect(rows.first()).toBeVisible({ timeout: REPLAN_TIMEOUT });
    const texts = await rows.allInnerTexts();

    // Numbered, with slots back to back from the start time.
    let slotStart = "23:59";
    texts.forEach((text, i) => {
      const match = new RegExp(`^${i + 1} · (\\d\\d:\\d\\d)–(\\d\\d:\\d\\d)`).exec(text);
      expect(match?.[1], `row ${i + 1}: ${text}`).toBe(slotStart);
      slotStart = match?.[2] ?? "";
    });
    // Shelves come before floors, and the room's own tasks after its items.
    const at = (name: string) => texts.findIndex((text) => text.includes(name));
    const itemTasks = [at("Clean Shelf"), at("Clean Floor")].filter((i) => i >= 0);
    const roomTasks = [at("Kitchen surface clean"), at("Kitchen deep clean")].filter((i) => i >= 0);
    expect(itemTasks).toEqual([...itemTasks].sort((a, b) => a - b));
    for (const room of roomTasks) {
      expect(itemTasks.every((item) => item < room)).toBe(true);
    }

    // Routines have no slot or time field.
    const routines = page.getByRole("list", { name: "Routines today" });
    await expect(routines).toContainText("Take out the trash");
    await expect(routines.getByRole("textbox")).toHaveCount(0);

    // Checking doesn't ask for a time; the field appears for done tasks.
    const first = session.getByRole("checkbox").first();
    await expect(tookField(page)).toHaveCount(0);
    await first.focus();
    await page.keyboard.press("Space");
    await expect(first).toBeChecked();
    const took = tookField(page);
    await expect(took).toHaveValue("");

    await took.focus();
    await page.keyboard.type("300");
    await page.keyboard.press("Tab");
    await expect(session.getByRole("alert")).toHaveText("Enter whole minutes from 1 to 240.");

    await took.focus();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("12");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Took 12 min so far")).toBeVisible();
    await expect(session.getByRole("alert")).toHaveCount(0);
    await waitForSync(page);
    await page.reload();
    await expect(tookField(page)).toHaveValue("12");
    await expect(page.getByText("Took 12 min so far")).toBeVisible();

    // Changed, cleared, and removed with an uncheck.
    await tookField(page).fill("15");
    await tookField(page).press("Enter");
    await expect(page.getByText("Took 15 min so far")).toBeVisible();
    await tookField(page).fill("");
    await tookField(page).press("Enter");
    await expect(page.getByText(/min so far/)).toBeHidden();
    await tookField(page).fill("9");
    await tookField(page).press("Enter");
    await expect(page.getByText("Took 9 min so far")).toBeVisible();
    await first.uncheck();
    await expect(tookField(page)).toHaveCount(0);
    await waitForSync(page);
    await page.reload();
    await first.check();
    await expect(tookField(page)).toHaveValue("");
    await expect(page.getByText(/min so far/)).toBeHidden();

    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(errors).toEqual([]);
  });
});
