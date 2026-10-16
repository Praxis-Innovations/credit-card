import { expect, test } from "../../src/fixtures";

test.describe("web smoke", () => {
  test("marketing home shows the hero", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "The right card for every purchase." }),
    ).toBeVisible();
    await expect(page.getByText(/NorthTap tells you which one/i)).toBeVisible();
  });
});
