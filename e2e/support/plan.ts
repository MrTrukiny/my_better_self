import { expect, type Page } from "@playwright/test";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** The weekday name `offset` days from today, in the browser's (and the server's) time zone. */
export function weekdayFromToday(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return WEEKDAYS[(date.getDay() + 6) % 7] as string;
}

/** Saves the schedule page, turning off the given weekdays and leaving the rest as they are. */
export async function saveSchedule(page: Page, { daysOff = [] }: { daysOff?: string[] } = {}) {
  await page.goto("/schedule");
  for (const day of daysOff) {
    await page.getByRole("checkbox", { name: day, exact: true }).uncheck();
  }
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
}

export function planDays(page: Page) {
  return page.getByRole("list", { name: "Next 7 days" }).getByRole("article");
}
