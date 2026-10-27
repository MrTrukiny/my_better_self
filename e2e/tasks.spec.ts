import { expect, test } from "./fixtures";
import { addItem, addRoom, openRoom } from "./support/inventory";
import {
  acceptAllProposals,
  GENERATION_TIMEOUT,
  NOTHING_NEW,
  proposalGroup,
  proposeTasks,
  REPLAN_TIMEOUT,
  saveHomeProfile,
} from "./support/tasks";

test.describe("AI task proposals", () => {
  test("AC1: saves helpers and a note, and shows them after a reload", async ({
    page,
    signedInUser: _,
  }) => {
    await saveHomeProfile(page, { helpers: ["Robot vacuum", "Washing machine"], note: "Two cats" });
    await page.reload();

    await expect(page.getByRole("checkbox", { name: "Robot vacuum" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Washing machine" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Dishwasher" })).not.toBeChecked();
    await expect(page.getByLabel(/Note/)).toHaveValue("Two cats");
  });

  test("AC2 and AC3: needs an inventory first, then proposes tasks grouped by room", async ({
    page,
    signedInUser: _,
  }) => {
    await page.goto("/tasks/review");
    await expect(page.getByRole("heading", { name: "Your inventory comes first" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Propose tasks" })).toHaveCount(0);

    await page.getByRole("link", { name: "Go to rooms" }).click();
    await addRoom(page, "Kitchen");
    await openRoom(page, "Kitchen");
    await addItem(page, { type: "Floor" });
    await page
      .getByRole("region", { name: "Kitchen" })
      .getByRole("link", { name: "Propose tasks" })
      .click();

    await expect(page.getByRole("combobox", { name: "Propose for" })).toContainText("Kitchen");
    await proposeTasks(page, "3 tasks proposed for Kitchen.");

    const kitchen = proposalGroup(page, "Kitchen");
    await expect(kitchen.getByRole("listitem")).toHaveText([
      /Clean Floor\s*Floor · 3 min · Every 2 weeks/,
      /Kitchen deep clean\s*Whole room · 30 min · Every month/,
      /Kitchen surface clean\s*Whole room · 10 min · Every 3 days/,
    ]);
  });

  test("AC4: proposals reflect the helpers in the home profile", async ({
    page,
    signedInUser: _,
  }) => {
    await saveHomeProfile(page, { helpers: ["Robot vacuum"] });
    await page.goto("/rooms");
    await addRoom(page, "Hall");
    await openRoom(page, "Hall");
    await addItem(page, { type: "Floor" });

    await page.goto("/tasks/review");
    await expect(page.getByText("Helpers: Robot vacuum.")).toBeVisible();
    await proposeTasks(page, /tasks proposed for the whole home/);
    await expect(proposalGroup(page, "Hall")).toContainText(
      "Vacuum the corners and edges of Floor",
    );
  });

  test("AC5, AC6, and AC7: review proposals into tasks, then manage the task list", async ({
    page,
    signedInUser: _,
  }) => {
    test.slow();
    await page.goto("/rooms");
    await addRoom(page, "Bedroom");
    await openRoom(page, "Bedroom");
    await addItem(page, { type: "Bed" });
    await page.goto("/tasks/review");
    await proposeTasks(page, "5 tasks proposed for the whole home.");

    const home = proposalGroup(page, "Whole home");
    const bedroom = proposalGroup(page, "Bedroom");
    await expect(home).toContainText("Make the bed");

    await bedroom.getByRole("button", { name: "Accept Clean Bed" }).click();
    await expect(bedroom.getByText("Clean Bed")).toBeHidden({ timeout: REPLAN_TIMEOUT });

    await bedroom.getByRole("button", { name: "Edit Bedroom deep clean" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit proposal" });
    await dialog.getByLabel("Name").fill("Bedroom deep clean, part 1");
    await dialog.getByRole("spinbutton", { name: "Minutes" }).fill("25");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(bedroom).toContainText(/Bedroom deep clean, part 1\s*Whole room · 25 min/);

    await bedroom.getByRole("button", { name: "Discard Bedroom surface clean" }).click();
    await expect(bedroom.getByText("Bedroom surface clean")).toBeHidden();

    await page.reload();
    await expect(page.getByRole("region", { name: "Pending proposals" })).toContainText(
      "Bedroom deep clean, part 1",
    );
    await expect(page.getByRole("button", { name: "Accept all (3)" })).toBeVisible();
    await acceptAllProposals(page);

    // Spec 008: the bed, the bedroom, and the home all have tasks now, so nothing is new.
    await expect(page.getByText(NOTHING_NEW)).toBeVisible();
    await expect(page.getByRole("button", { name: "Propose tasks" })).toBeDisabled();

    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Tasks" })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "Tasks" })).toBeVisible();
    const cleaning = page.getByRole("region", { name: "Cleaning tasks" });
    const routines = page.getByRole("region", { name: "Routines" });
    await expect(cleaning.getByRole("list", { name: "Bedroom" }).getByRole("listitem")).toHaveText([
      /Clean Bed/,
      /Bedroom deep clean, part 1/,
    ]);
    await expect(routines.getByRole("list", { name: "Whole home" })).toContainText("Make the bed");
    await expect(routines.getByRole("list", { name: "Whole home" })).toContainText(
      "Take out the trash",
    );

    await cleaning.getByRole("button", { name: "Edit Clean Bed" }).click();
    const edit = page.getByRole("dialog", { name: "Edit task" });
    await edit.getByRole("spinbutton", { name: "Every how many days" }).fill("7");
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(edit).toBeHidden({ timeout: REPLAN_TIMEOUT });
    await expect(cleaning).toContainText(/Clean Bed\s*Bed · 3 min · Every week/);

    await routines.getByRole("button", { name: "Delete Take out the trash" }).click();
    const confirm = page.getByRole("alertdialog", { name: 'Delete "Take out the trash"?' });
    await confirm.getByRole("button", { name: "Delete" }).click();
    await expect(confirm).toBeHidden({ timeout: REPLAN_TIMEOUT });
    await expect(routines).not.toContainText("Take out the trash");
  });

  test("AC8: a failed generation shows Try again and saves nothing", async ({
    page,
    signedInUser: _,
  }) => {
    await saveHomeProfile(page, { note: "[fail]" });
    await page.goto("/rooms");
    await addRoom(page, "Kitchen");

    await page.goto("/tasks/review");
    await page.getByRole("button", { name: "Propose tasks" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "Couldn't propose tasks." });
    await expect(alert).toBeVisible();
    await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Pending proposals" })).toBeHidden();
  });

  test("AC9: reviews proposals with the keyboard only, in dark mode", async ({
    page,
    signedInUser: _,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/rooms");
    await addRoom(page, "Office");
    await openRoom(page, "Office");
    await addItem(page, { type: "Desk" });
    await page.goto("/tasks/review");

    const propose = page.getByRole("button", { name: "Propose tasks" });
    await propose.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "4 tasks proposed" })).toBeVisible({
      timeout: GENERATION_TIMEOUT,
    });

    const accept = page.getByRole("button", { name: "Accept Clean Desk" });
    await accept.focus();
    await expect(accept).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Clean Desk")).toBeHidden({ timeout: REPLAN_TIMEOUT });

    const edit = page.getByRole("button", { name: "Edit Office deep clean" });
    await edit.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Edit proposal" });
    await expect(dialog.locator(":focus")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});
