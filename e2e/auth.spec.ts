import { expect, test } from "./fixtures";

const accountMenu = (name: string) => ({ name: `Account menu for ${name}` });
const googleButton = { name: "Continue with Google" };

test.describe("signed out", () => {
  test("AC1: a protected page sends me to sign-in and remembers where I was going", async ({
    page,
  }) => {
    await page.goto("/settings?tab=profile");

    await expect(page).toHaveURL("/sign-in?callbackURL=%2Fsettings%3Ftab%3Dprofile");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("My Better Self");
    await expect(page.getByRole("button", googleButton)).toBeFocused();
  });

  test("AC3: an account that is not on the allowlist sees a clear message", async ({ page }) => {
    await page.goto("/sign-in?error=email_not_allowed");

    const alert = page.getByRole("alert").filter({ hasText: "This account doesn't have access." });
    await expect(alert).toBeVisible();
    await expect(alert).toBeFocused();
    await expect(page.getByRole("button", googleButton)).toBeEnabled();
  });

  test("AC6: a cancelled Google sign-in can be retried", async ({ page }) => {
    await page.goto("/sign-in?error=access_denied");

    await expect(
      page.getByRole("alert").filter({ hasText: "Sign-in was cancelled. Try again." }),
    ).toBeVisible();
    await expect(page.getByRole("button", googleButton)).toBeEnabled();
  });

  test("AC7: offline, the sign-in button is disabled and says why", async ({ page, context }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("button", googleButton)).toBeEnabled();

    await context.setOffline(true);

    await expect(page.getByRole("button", googleButton)).toBeDisabled();
    await expect(
      page.getByText("You're offline. Connect to the internet to sign in."),
    ).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByRole("button", googleButton)).toBeEnabled();
  });

  test("AC8: the sign-in screen renders in dark mode", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/sign-in");

    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("button", googleButton)).toBeVisible();
  });
});

test.describe("signed in", () => {
  test("AC2: I land in the app and see my account in the header", async ({
    page,
    signedInUser,
  }) => {
    await page.goto("/");

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("button", accountMenu(signedInUser.name))).toHaveText("EO");
  });

  test("AC1: visiting sign-in with a session goes to the requested page", async ({
    page,
    signedInUser,
  }) => {
    await page.goto("/sign-in?callbackURL=%2F");

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("button", accountMenu(signedInUser.name))).toBeVisible();
  });

  test("AC4: the session survives closing and reopening the app", async ({
    page,
    context,
    signedInUser,
  }) => {
    await page.goto("/");
    await page.close();

    const reopened = await context.newPage();
    await reopened.goto("/");

    await expect(reopened).toHaveURL("/");
    await expect(reopened.getByRole("button", accountMenu(signedInUser.name))).toBeVisible();
  });

  test("AC5 and AC8: sign out with the keyboard, and Back shows no app content", async ({
    page,
    signedInUser,
  }) => {
    await page.goto("/");
    const menuButton = page.getByRole("button", accountMenu(signedInUser.name));
    await menuButton.focus();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("menu")).toContainText(signedInUser.email);
    await page.getByRole("menuitem", { name: "Sign out" }).focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/sign-in");
    await page.goBack();
    await expect(page.getByRole("button", { name: /Account menu/ })).toHaveCount(0);

    await page.goto("/");
    await expect(page).toHaveURL("/sign-in");
  });
});
