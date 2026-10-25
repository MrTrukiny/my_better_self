import { expect, type Page } from "@playwright/test";

export async function addRoom(page: Page, name: string) {
  await page.getByRole("button", { name: "Add room" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add room" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("button", { name: "Add room" }).click();
  await expect(dialog).toBeHidden();
}

export async function openRoom(page: Page, name: string) {
  await page.getByRole("list", { name: "Rooms" }).getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

/** Adds one item through the dialog and closes it with "Done". */
export async function addItem(page: Page, { type, count }: { type: string; count?: number }) {
  await page.getByRole("button", { name: "Add item" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add item" });
  await chooseType(page, type);
  if (count !== undefined) {
    await dialog.getByRole("spinbutton", { name: "Count" }).fill(String(count));
  }
  await dialog.getByRole("button", { name: "Add item" }).click();
  await expect(dialog.getByRole("status")).toContainText("Added");
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
}

export async function chooseType(page: Page, type: string) {
  await page.getByRole("dialog").getByRole("combobox", { name: "Type" }).click();
  await page.getByRole("option", { name: type, exact: true }).click();
}
