import { expect, test } from "../../src/fixtures";

const APP_URL = "https://northtap-app.vercel.app";

test.describe("key marketing links", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("header and hero open-app CTAs point at the live app", async ({ page }) => {
    const headerCta = page.getByRole("link", { name: "Open the app" });
    await expect(headerCta).toHaveAttribute("href", APP_URL);

    const heroCta = page.getByRole("link", { name: "Try it with your cards" });
    await expect(heroCta).toHaveAttribute("href", APP_URL);
  });

  test("brand mark links home and How it works is on the page", async ({ page }) => {
    const home = page.locator("header a[href='/']");
    await expect(home).toBeVisible();
    await expect(home.getByText("North")).toBeVisible();
    await expect(home.getByText("Tap")).toBeVisible();

    await expect(page.locator("#how")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "How it works" }),
    ).toBeVisible();
  });
});
