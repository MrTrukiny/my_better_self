import { e2eEmail, expect, test } from "./fixtures";
import { planDays, saveSchedule } from "./support/plan";
import { REPLAN_TIMEOUT } from "./support/tasks";
import { setUpToday } from "./support/today";

test("spec 015 AC1–AC8: invite a person, share the home and the plan, then remove them", async ({
  page,
  browser,
  createOwner,
  testAuth,
}) => {
  test.slow();
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const { owner, cookies } = await createOwner("Ana Owner");
  await page.context().addCookies(cookies);
  await setUpToday(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ colorScheme: "dark" });

  // AC1: the owner invites someone from Settings, using the keyboard.
  await page.goto("/settings");
  const row = page.getByRole("link", { name: /Household/ });
  await expect(row).toContainText("Just you");
  await row.click();
  await expect(page.getByRole("heading", { level: 1, name: "Household" })).toBeVisible();
  const email = e2eEmail();
  const field = page.getByLabel("Invite by email");
  await field.focus();
  await page.keyboard.type(owner.email);
  await page.keyboard.press("Enter");
  await expect(field).toHaveAccessibleDescription(/That's your own email\./);
  await field.fill(email);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: `Invited ${email}.` })).toBeVisible();
  const people = page.getByRole("list", { name: "People" });
  await expect(people.getByRole("listitem")).toHaveCount(2);
  await expect(people.getByRole("listitem").nth(1)).toContainText("Invited");
  const other = e2eEmail();
  await field.fill(other);
  await page.keyboard.press("Enter");
  await expect(people.getByRole("listitem")).toHaveCount(3);

  // AC2: the invited person signs in and joins the household.
  const { owner: member, cookies: memberCookies } = await createOwner("Sam Member", { email });
  await testAuth.joinHousehold(email, member.id);

  // AC1: withdrawing an invitation. The sign-in hook refreshes the household's cached people;
  // joining from the test doesn't, so this change of the owner's does.
  await people.getByRole("button", { name: `Withdraw the invitation for ${other}` }).click();
  const withdraw = page.getByRole("alertdialog", { name: `Withdraw the invitation for ${other}?` });
  await withdraw.getByRole("button", { name: "Withdraw" }).click();
  await expect(withdraw).toBeHidden();
  await expect(people.getByRole("listitem")).toHaveCount(2);
  const memberContext = await browser.newContext();
  await memberContext.addCookies(memberCookies);
  const memberPage = await memberContext.newPage();
  memberPage.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await memberPage.goto("/tasks");
  await expect(memberPage.getByText("Kitchen").first()).toBeVisible();

  // AC3: a member sees the household but can't change who is in it.
  await memberPage.goto("/household");
  await expect(memberPage.getByLabel("Invite by email")).toHaveCount(0);
  await expect(memberPage.getByRole("button", { name: /Remove/ })).toHaveCount(0);
  await expect(memberPage.getByRole("button", { name: "Leave household" })).toBeVisible();

  // AC4 and AC5: with their own schedule, the member gets a share of the tasks.
  await saveSchedule(memberPage);
  await memberPage.goto("/plan");
  await expect(planDays(memberPage)).toHaveCount(7);
  await expect(memberPage.getByText(/together you have about/)).toBeVisible();

  // AC6: the household view labels each task with its person.
  await memberPage.getByRole("link", { name: "Household" }).click();
  await expect(memberPage.getByRole("link", { name: "Household" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const week = memberPage.getByRole("list", { name: "Next 7 days" });
  await expect(week.getByText(/ · Ana$/).first()).toBeVisible({ timeout: REPLAN_TIMEOUT });
  await expect(week.getByText(/ · Sam$/).first()).toBeVisible();

  // AC7 and AC8: the owner removes the member after confirming; the member is signed out.
  await page.reload();
  const memberRow = people.getByRole("listitem").filter({ hasText: "Sam Member" });
  await expect(memberRow).toContainText("Member");
  await memberRow.getByRole("button", { name: "Remove Sam Member" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Remove Sam Member?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Remove" }).click();
  await expect(confirm).toBeHidden({ timeout: REPLAN_TIMEOUT });
  await expect(people.getByRole("listitem")).toHaveCount(1);

  await memberPage.goto("/plan");
  await expect(memberPage).toHaveURL(/\/sign-in/);
  await page.goto("/plan");
  await expect(page.getByRole("navigation", { name: "Whose plan" })).toHaveCount(0);
  await expect(planDays(page)).toHaveCount(7);

  await memberContext.close();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(errors).toEqual([]);
});
