import { expect, test } from "./fixtures";

test("the privacy policy and terms open signed out, from the sign-in page", async ({ page }) => {
  await page.goto("/sign-in");
  const legal = page.getByRole("navigation", { name: "Legal" });

  await legal.getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL("/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy policy");
  await expect(page.getByText("Google API Services User Data Policy")).toBeVisible();

  await page.goto("/sign-in");
  await legal.getByRole("link", { name: "Terms" }).click();
  await expect(page).toHaveURL("/terms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Terms of service");
});
