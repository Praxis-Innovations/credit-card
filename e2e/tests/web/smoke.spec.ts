import { expect, test } from "../../src/fixtures";

test.describe("web smoke", () => {
  test("marketing home shows the hero and Try it widget", { tag: "@smoke" }, async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "The right card for every purchase." }),
    ).toBeVisible();
    await expect(page.getByText(/NorthTap tells you which one/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Try it" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Switch .* theme/i })).toBeVisible();
  });
});
