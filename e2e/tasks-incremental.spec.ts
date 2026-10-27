import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { addItem, addRoom, openRoom } from "./support/inventory";
import {
  discardProposal,
  NOTHING_NEW,
  proposalGroup,
  proposeTasks,
  REPLAN_TIMEOUT,
  saveHomeProfile,
} from "./support/tasks";

/** Adds a room with the given item types, starting from the rooms page. */
async function addRoomWithItems(page: Page, name: string, types: string[]) {
  await page.goto("/rooms");
  await addRoom(page, name);
  await openRoom(page, name);
  for (const type of types) {
    await addItem(page, { type });
  }
}

async function addItemToRoom(page: Page, room: string, type: string) {
  await page.goto("/rooms");
  await openRoom(page, room);
  await addItem(page, { type });
}

/** Opens the review page scoped to one room, through the link on the room page. */
async function reviewRoom(page: Page, room: string) {
  await page.goto("/rooms");
  await openRoom(page, room);
  await page
    .getByRole("region", { name: room })
    .getByRole("link", { name: "Propose tasks" })
    .click();
  await expect(page.getByRole("combobox", { name: "Propose for" })).toContainText(room);
}

test.describe("Incremental task proposals", () => {
  test("AC1, AC2, and AC3: proposes only for new rooms and items and keeps the rest", async ({
    page,
    signedInUser: _,
  }) => {
    test.slow();
    await addRoomWithItems(page, "Kitchen", ["Floor"]);
    await page.goto("/tasks/review");
    await proposeTasks(page, "4 tasks proposed for the whole home.");

    const kitchen = proposalGroup(page, "Kitchen");
    await kitchen.getByRole("button", { name: "Accept Clean Floor" }).click();
    await expect(kitchen.getByText("Clean Floor")).toBeHidden({ timeout: REPLAN_TIMEOUT });
    await kitchen.getByRole("button", { name: "Edit Kitchen deep clean" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit proposal" });
    await dialog.getByLabel("Name").fill("Kitchen deep clean, part 1");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();

    await addItemToRoom(page, "Kitchen", "Window");
    await addRoomWithItems(page, "Bathroom", ["Mirror"]);
    await page.goto("/tasks/review");
    await expect(page.getByText("Proposes tasks for 2 new items and 1 new room.")).toBeVisible();
    await proposeTasks(page, "4 tasks proposed for the whole home.");

    await expect(kitchen.getByRole("listitem")).toHaveCount(3);
    await expect(kitchen).toContainText("Kitchen deep clean, part 1");
    await expect(kitchen).toContainText("Kitchen surface clean");
    await expect(kitchen).toContainText("Clean Window");
    const bathroom = proposalGroup(page, "Bathroom");
    await expect(bathroom.getByRole("listitem")).toHaveCount(3);
    await expect(bathroom).toContainText("Clean Mirror");
    await expect(bathroom).toContainText("Bathroom surface clean");
    await expect(bathroom).toContainText("Bathroom deep clean");
    await expect(proposalGroup(page, "Whole home").getByRole("listitem")).toHaveText([
      /Take out the trash/,
    ]);
    await expect(page.getByRole("button", { name: "Accept all (7)" })).toBeVisible();
    await expect(page.getByText(NOTHING_NEW)).toBeVisible();

    await page.goto("/tasks");
    await expect(
      page
        .getByRole("region", { name: "Cleaning tasks" })
        .getByRole("list", { name: "Kitchen" })
        .getByRole("listitem"),
    ).toHaveText([/Clean Floor/]);
  });

  test("AC4: proposing for one room covers only its new items", async ({
    page,
    signedInUser: _,
  }) => {
    test.slow();
    await addRoomWithItems(page, "Office", ["Desk"]);
    await reviewRoom(page, "Office");
    await proposeTasks(page, "3 tasks proposed for Office.");

    await addItemToRoom(page, "Office", "Shelf");
    await addRoomWithItems(page, "Studio", []);
    await reviewRoom(page, "Office");
    await expect(page.getByText("Proposes tasks for 1 new item.")).toBeVisible();
    await proposeTasks(page, "1 task proposed for Office.");

    const office = proposalGroup(page, "Office");
    await expect(office.getByRole("listitem")).toHaveCount(4);
    await expect(office).toContainText("Clean Shelf");
    await expect(proposalGroup(page, "Studio")).toHaveCount(0);
    await expect(proposalGroup(page, "Whole home")).toHaveCount(0);
  });

  test("AC5: says nothing is new and makes no request when everything has tasks", async ({
    page,
    signedInUser: _,
  }) => {
    test.slow();
    await addRoomWithItems(page, "Hall", []);
    await page.goto("/tasks/review");
    await proposeTasks(page, "3 tasks proposed for the whole home.");

    await saveHomeProfile(page, { note: "[fail]" });
    await page.goto("/tasks/review");
    const propose = page.getByRole("button", { name: "Propose tasks" });
    await expect(propose).toBeDisabled();
    await expect(propose).toHaveAccessibleDescription(NOTHING_NEW);
    await expect(page.getByText(/Proposes tasks for/)).toHaveCount(0);
    await expect(page.getByRole("alert").filter({ hasText: "Couldn't propose" })).toHaveCount(0);
  });

  test("AC6: discarding an item's proposals lets it get new ones", async ({
    page,
    signedInUser: _,
  }) => {
    test.slow();
    await addRoomWithItems(page, "Kitchen", ["Floor"]);
    await page.goto("/tasks/review");
    await proposeTasks(page, "4 tasks proposed for the whole home.");
    await expect(page.getByText(NOTHING_NEW)).toBeVisible();

    await discardProposal(page, "Clean Floor");
    await expect(page.getByText("Proposes tasks for 1 new item.")).toBeVisible();
    await proposeTasks(page, "1 task proposed for the whole home.");
    await expect(proposalGroup(page, "Kitchen")).toContainText("Clean Floor");
    await expect(page.getByRole("button", { name: "Accept all (4)" })).toBeVisible();
  });

  test("AC7: a failed request shows Try again and keeps the pending proposals", async ({
    page,
    signedInUser: _,
  }) => {
    test.slow();
    await addRoomWithItems(page, "Kitchen", ["Floor"]);
    await page.goto("/tasks/review");
    await proposeTasks(page, "4 tasks proposed for the whole home.");

    await saveHomeProfile(page, { note: "[fail]" });
    await addItemToRoom(page, "Kitchen", "Window");
    await page.goto("/tasks/review");
    await page.getByRole("button", { name: "Propose tasks" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "Couldn't propose tasks." });
    await expect(alert).toBeVisible();
    await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept all (4)" })).toBeVisible();
  });
});
