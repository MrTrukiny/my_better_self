import { expect, test } from "./fixtures";
import { addItem, addRoom, chooseType, openRoom } from "./support/inventory";

test.describe("home inventory", () => {
  test("AC1: shows empty states for a new home and an empty room", async ({
    page,
    signedInUser: _,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Rooms", exact: true }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Rooms" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No rooms yet" })).toBeVisible();

    await addRoom(page, "Kitchen");
    await openRoom(page, "Kitchen");
    await expect(page.getByRole("heading", { name: "No items yet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add item" })).toBeVisible();
  });

  test("AC2: adds and renames a room and shows its item count", async ({
    page,
    signedInUser: _,
  }) => {
    await page.goto("/rooms");
    await addRoom(page, "Kitchen");
    await addRoom(page, "Bathroom");

    const rooms = page.getByRole("list", { name: "Rooms" });
    await expect(rooms.getByRole("listitem")).toHaveText([
      /Kitchen\s*No tasks yet\s*No items/,
      /Bathroom/,
    ]);

    await openRoom(page, "Kitchen");
    await addItem(page, { type: "Window", count: 2 });
    await page.getByRole("button", { name: "Rename" }).click();
    const dialog = page.getByRole("dialog", { name: "Rename room" });
    await expect(dialog.getByLabel("Name")).toHaveValue("Kitchen");
    await dialog.getByLabel("Name").fill("Main kitchen");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Main kitchen" })).toBeVisible();

    await page.goto("/rooms");
    await expect(rooms.getByRole("listitem").first()).toHaveText(
      /Main kitchen\s*No tasks yet\s*1 item/,
    );
  });

  test("AC3 and AC4: adds an item with defaults, then edits every field", async ({
    page,
    signedInUser: _,
  }) => {
    await page.goto("/rooms");
    await addRoom(page, "Living room");
    await openRoom(page, "Living room");

    await page.getByRole("button", { name: "Add item" }).click();
    const dialog = page.getByRole("dialog", { name: "Add item" });
    await expect(dialog.getByRole("combobox", { name: "Type" })).toBeFocused();
    await chooseType(page, "Window");
    await expect(dialog.getByLabel("Name")).toHaveValue("Window");
    await expect(dialog.getByRole("spinbutton", { name: "Count" })).toHaveValue("1");
    await dialog.getByRole("button", { name: "Add item" }).click();
    await expect(dialog.getByRole("status")).toHaveText("Added Window.");

    await dialog.getByRole("button", { name: "Add another" }).click();
    await expect(dialog.getByRole("combobox", { name: "Type" })).toBeFocused();
    await chooseType(page, "Shelf");
    await dialog.getByRole("button", { name: "Increase count" }).click();
    await dialog.getByRole("button", { name: "Increase count" }).click();
    await dialog.getByRole("button", { name: "Add item" }).click();
    await expect(dialog.getByRole("status")).toHaveText("Added Shelf x3.");
    await dialog.getByRole("button", { name: "Done" }).click();

    const items = page.getByRole("list", { name: "Items in Living room" });
    await expect(items.getByRole("listitem")).toHaveText([/Window/, /Shelf x3/]);

    await page.getByRole("button", { name: "Edit Window" }).click();
    const edit = page.getByRole("dialog", { name: "Edit item" });
    await chooseType(page, "Mirror");
    await edit.getByLabel("Name").fill("Big mirror");
    await edit.getByRole("spinbutton", { name: "Count" }).fill("2");
    await edit.getByLabel(/Note/).fill("Above the sofa");
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(edit).toBeHidden();

    await expect(items.getByRole("listitem").first()).toHaveText(/Big mirror x2\s*Above the sofa/);
    await expect(
      page.getByRole("region", { name: "Living room" }).getByText("2 items"),
    ).toBeVisible();
  });

  test("AC5: deletes a room with its items after confirming; cancel keeps it", async ({
    page,
    signedInUser: _,
  }) => {
    test.slow();
    await page.goto("/rooms");
    await addRoom(page, "Garage");
    await openRoom(page, "Garage");
    await addItem(page, { type: "Floor" });
    await addItem(page, { type: "Shelf", count: 4 });

    await page.getByRole("button", { name: "Delete Shelf" }).click();
    const itemConfirm = page.getByRole("alertdialog", { name: "Delete Shelf x4?" });
    await itemConfirm.getByRole("button", { name: "Delete" }).click();
    await expect(itemConfirm).toBeHidden();
    await expect(
      page.getByRole("list", { name: "Items in Garage" }).getByRole("listitem"),
    ).toHaveCount(1);
    await addItem(page, { type: "Door" });

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const confirm = page.getByRole("alertdialog", { name: "Delete Garage?" });
    await expect(confirm).toContainText("This deletes Garage and its 2 items.");
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Garage" })).toBeVisible();

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await confirm.getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/rooms$/);
    await expect(page.getByRole("heading", { name: "No rooms yet" })).toBeVisible();
  });

  test("AC6: shows field messages for a duplicate room name and an invalid count", async ({
    page,
    signedInUser: _,
  }) => {
    await page.goto("/rooms");
    await addRoom(page, "Office");

    await page.getByRole("button", { name: "Add room" }).click();
    const roomDialog = page.getByRole("dialog", { name: "Add room" });
    await roomDialog.getByLabel("Name").fill("office");
    await roomDialog.getByRole("button", { name: "Add room" }).click();
    await expect(roomDialog.getByLabel("Name")).toHaveAccessibleDescription(
      "A room with this name already exists.",
    );
    await roomDialog.getByLabel("Name").fill("");
    await roomDialog.getByRole("button", { name: "Add room" }).click();
    await expect(roomDialog.getByLabel("Name")).toHaveAccessibleDescription("Enter a name.");
    await page.keyboard.press("Escape");

    await openRoom(page, "Office");
    await page.getByRole("button", { name: "Add item" }).click();
    const itemDialog = page.getByRole("dialog", { name: "Add item" });
    await chooseType(page, "Desk");
    await itemDialog.getByRole("spinbutton", { name: "Count" }).fill("100");
    await itemDialog.getByRole("button", { name: "Add item" }).click();
    const count = itemDialog.getByRole("spinbutton", { name: "Count" });
    await expect(count).toHaveAccessibleDescription("Enter a whole number from 1 to 99.");
    await expect(count).toBeFocused();
    await expect(itemDialog.getByLabel("Name")).toHaveValue("Desk");
  });

  test("AC8: adds a room and an item with the keyboard only, in dark mode", async ({
    page,
    signedInUser: _,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/rooms");
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.getByRole("button", { name: "Add room" }).focus();
    await page.keyboard.press("Enter");
    const roomDialog = page.getByRole("dialog", { name: "Add room" });
    await expect(roomDialog.getByLabel("Name")).toBeFocused();
    await page.keyboard.type("Bedroom");
    await page.keyboard.press("Enter");
    await expect(roomDialog).toBeHidden();

    const roomLink = page
      .getByRole("list", { name: "Rooms" })
      .getByRole("link", { name: /Bedroom/ });
    await roomLink.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Bedroom" })).toBeVisible();

    await page.getByRole("button", { name: "Add item" }).focus();
    await page.keyboard.press("Enter");
    const itemDialog = page.getByRole("dialog", { name: "Add item" });
    await expect(itemDialog.getByRole("combobox", { name: "Type" })).toBeFocused();
    await page.keyboard.press("Enter");
    await page.getByRole("option", { name: "Bed", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(itemDialog.getByLabel("Name")).toHaveValue("Bed");
    await itemDialog.getByRole("button", { name: "Add item" }).focus();
    await page.keyboard.press("Enter");
    await expect(itemDialog.getByRole("button", { name: "Add another" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(itemDialog).toBeHidden();

    await expect(page.getByRole("list", { name: "Items in Bedroom" })).toContainText("Bed");
  });

  test("keeps each owner's rooms private", async ({
    page,
    signedInUser: _,
    createOwner,
    browser,
  }) => {
    await page.goto("/rooms");
    await addRoom(page, "Private study");
    await openRoom(page, "Private study");
    const roomURL = page.url();

    const { cookies } = await createOwner("Other Owner");
    const otherContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    try {
      await otherContext.addCookies(cookies);
      const otherPage = await otherContext.newPage();
      await otherPage.goto(roomURL);
      await expect(otherPage.getByText("This page could not be found.")).toBeVisible();
      await expect(otherPage.getByText("Private study")).toHaveCount(0);
    } finally {
      await otherContext.close();
    }
  });
});
