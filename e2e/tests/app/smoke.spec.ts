import { expect, test } from "../../src/fixtures";

test.describe("app smoke", () => {
  test("welcome screen loads on Expo web export", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "The right card for every purchase." }),
    ).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();
  });
});
