import { expect, type Page } from "@playwright/test";

/** Saves the home profile with the given helper labels and note. */
export async function saveHomeProfile(
  page: Page,
  { helpers = [], note = "" }: { helpers?: string[]; note?: string },
) {
  await page.goto("/home-profile");
  for (const helper of helpers) {
    await page.getByRole("checkbox", { name: helper }).check();
  }
  await page.getByLabel(/Note/).fill(note);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
}

/** Generation runs several queries and a transaction, which is slow under parallel workers. */
export const GENERATION_TIMEOUT = 20_000;

/** Runs "Propose tasks" on the review page and waits for the result announcement. */
export async function proposeTasks(page: Page, expected: string | RegExp) {
  await page.getByRole("button", { name: "Propose tasks" }).click();
  await expect(page.getByRole("status").filter({ hasText: expected })).toBeVisible({
    timeout: GENERATION_TIMEOUT,
  });
}

export const NOTHING_NEW =
  "Everything already has tasks. Add a room or an item, or discard proposals to get new ones.";

/** Writes that run a transaction and then replan are slow under parallel workers too. */
export const REPLAN_TIMEOUT = 20_000;

/** Accepts every pending proposal and waits until none are left. */
export async function acceptAllProposals(page: Page) {
  await page.getByRole("button", { name: /Accept all/ }).click();
  await expect(page.getByRole("region", { name: "Pending proposals" })).toBeHidden({
    timeout: REPLAN_TIMEOUT,
  });
}

/** Discards one pending proposal by name and waits until it's gone. */
export async function discardProposal(page: Page, name: string) {
  const pending = page.getByRole("region", { name: "Pending proposals" });
  await pending.getByRole("button", { name: `Discard ${name}` }).click();
  await expect(pending.getByText(name, { exact: true })).toBeHidden();
}

export function proposalGroup(page: Page, title: string) {
  return page.getByRole("region", { name: "Pending proposals" }).getByRole("list", { name: title });
}
