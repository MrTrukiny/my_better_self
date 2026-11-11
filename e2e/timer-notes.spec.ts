import { expect, test } from "./fixtures";
import { REPLAN_TIMEOUT } from "./support/tasks";
import { cleaningToday, setUpToday, tookField, waitForSync } from "./support/today";

const DAY_NAME = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), /;

test("spec 016 AC1–AC8: time a task, correct it, add a note, and see it on earlier days", async ({
  page,
  context,
  signedInUser,
  testAuth,
}) => {
  test.slow();
  const errors: string[] = [];
  page.on("console", (message) => {
    // Requests made while offline fail by design.
    if (message.type() === "error" && !message.text().includes("ERR_INTERNET_DISCONNECTED")) {
      errors.push(message.text());
    }
  });
  await setUpToday(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  const start = cleaningToday(page)
    .getByRole("button", { name: /^Start timer for / })
    .first();
  await expect(start).toBeVisible({ timeout: REPLAN_TIMEOUT });
  const taskName = ((await start.getAttribute("aria-label")) ?? "").replace("Start timer for ", "");
  const row = cleaningToday(page)
    .getByRole("listitem")
    .filter({ has: page.getByRole("checkbox", { name: taskName }) });

  // Started and paused with the keyboard; the banner links to the row.
  await start.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(`Timer started for ${taskName}.`)).toBeAttached();
  await expect(page.getByRole("link", { name: taskName })).toBeVisible();
  const pause = row.getByRole("button", { name: `Pause timer for ${taskName}` });
  await pause.focus();
  await page.keyboard.press("Enter");
  await expect(row.getByRole("button", { name: `Resume timer for ${taskName}` })).toBeVisible();

  // The timer lives on the device: 12.5 minutes on it survive a reload.
  await page.evaluate((key) => {
    const timers = JSON.parse(localStorage.getItem(key) ?? "{}");
    for (const id of Object.keys(timers)) {
      timers[id] = { ...timers[id], elapsedMs: 750_000, startedAt: null };
    }
    localStorage.setItem(key, JSON.stringify(timers));
  }, `mbs:timer:${signedInUser.id}`);
  await page.reload();
  await expect(row).toContainText("12:30");
  await expect(page.getByText(/^Paused:/)).toContainText(`${taskName}, 12:30`);

  // Stopping checks the task off with the rounded time, which stays editable.
  await row.getByRole("button", { name: `Stop timer for ${taskName}` }).click();
  await expect(row.getByRole("checkbox")).toBeChecked();
  await expect(tookField(page)).toHaveValue("13");
  await tookField(page).fill("11");
  await tookField(page).press("Enter");

  await row.getByRole("button", { name: `Add note for ${taskName}` }).click();
  await page.keyboard.type("Full deep clean");
  await page.keyboard.press("Enter");
  await expect(row.getByText("Full deep clean")).toBeVisible();
  await waitForSync(page);
  await page.reload();
  await expect(tookField(page)).toHaveValue("11");
  await expect(row.getByText("Full deep clean")).toBeVisible();

  // Offline, a note edit waits on the device and syncs when back.
  await context.setOffline(true);
  await row.getByRole("button", { name: `Edit note for ${taskName}` }).click();
  await page.keyboard.type(", moved the table");
  await page.keyboard.press("Enter");
  await expect(row.getByText("Saved on this device", { exact: true })).toBeVisible();
  await context.setOffline(false);
  await waitForSync(page);
  await page.reload();
  await expect(row.getByText("Full deep clean, moved the table")).toBeVisible({
    timeout: REPLAN_TIMEOUT,
  });
  await expect(tookField(page)).toHaveValue("11");

  // The note shows on earlier days too.
  await testAuth.moveFirstDayBack(signedInUser.id, 1);
  await page.goto("/earlier-days");
  const day = page.getByRole("region", { name: DAY_NAME }).first();
  const note = day.getByText("Full deep clean, moved the table");
  if (!(await note.isVisible())) {
    await day.getByRole("heading", { level: 2 }).click();
  }
  await expect(note).toBeVisible();
  await expect(
    day.getByRole("button", { name: new RegExp(`^Edit note for ${taskName}, `) }),
  ).toBeVisible();

  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(errors).toEqual([]);
});
