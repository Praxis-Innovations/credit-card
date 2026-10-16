import { expect, test } from "../../src/fixtures";
import { assertAdminHasGoogleIdentity } from "../../src/helpers/supabase";

test.describe("admin smoke", () => {
  test("login page renders Google sign-in", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Sign in to the admin console" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  });

  test("seeded admin has a Google identity", { tag: "@smoke" }, async () => {
    await assertAdminHasGoogleIdentity();
  });
});
