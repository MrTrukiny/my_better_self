import { expect, type Page } from "@playwright/test";
import { REPLAN_TIMEOUT } from "./tasks";

/** The daily job's secret for the e2e server; playwright.config.ts passes it as CRON_SECRET. */
export const E2E_CRON_SECRET = "e2e-only-cron-secret-not-used-anywhere-else";

export const OVERLAP_TEXT = "Overlaps another event in your calendar";

export function calendarSection(page: Page) {
  return page.getByRole("region", { name: "Google Calendar" });
}

/** The connection line; the section has other status regions, such as the last-synced line. */
export function connectedStatus(page: Page) {
  return calendarSection(page).getByRole("status").filter({ hasText: "Connected: " });
}

/** Connects the fake calendar from the schedule page and waits for the first sync. */
export async function connectCalendar(page: Page) {
  await page.goto("/schedule");
  await calendarSection(page).getByRole("button", { name: "Connect Google Calendar" }).click();
  await expect(page).toHaveURL(/\/schedule\?calendar=connected$/, { timeout: REPLAN_TIMEOUT });
  await expect(connectedStatus(page)).toHaveText("Connected: Cleaning");
}

/**
 * Reloads the plan until `check` passes: calendar syncs run after the response that triggered
 * them, so the plan can show the previous sync for a moment.
 */
export async function expectPlanEventually(page: Page, check: () => Promise<void>) {
  await expect(async () => {
    await page.goto("/plan");
    await check();
  }).toPass({ timeout: REPLAN_TIMEOUT });
}
