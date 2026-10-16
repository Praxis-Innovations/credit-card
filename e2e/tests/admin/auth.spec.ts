import { expect, test } from "../../src/fixtures";
import { signInAppUserBrowser } from "../../src/helpers/admin-auth";

test.describe("admin auth", () => {
  test("signed-out users are redirected to login", async ({ page }) => {
    await page.goto("/sources");
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Sign in to the admin console" }),
    ).toBeVisible();
  });

  test("non-admin is blocked, signed out, and sent to not-authorized", async ({
    page,
    context,
  }) => {
    await signInAppUserBrowser(context);
    await page.goto("/sources");
    await expect(page).toHaveURL(/\/not-authorized$/);
    await expect(
      page.getByRole("heading", { name: "This account can't use the console" }),
    ).toBeVisible();
    await expect(page.getByText("You've been signed out.")).toBeVisible();

    // Session was cleared — a follow-up protected navigation should hit login.
    await page.goto("/review");
    await expect(page).toHaveURL(/\/login$/);
  });
});
