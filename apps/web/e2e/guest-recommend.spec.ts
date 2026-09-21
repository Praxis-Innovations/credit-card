import { expect, test } from "@playwright/test";

test.describe("guest purchase → recommend flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("northtap.ownedCardIds");
    });
  });

  test("ranks wallet cards for a grocery purchase with reasoning", async ({
    page,
  }) => {
    await page.goto("/app");

    await expect(
      page.getByRole("heading", { name: "Which card for this purchase?" }),
    ).toBeVisible();

    // Stay signed out — wallet persists in localStorage for guests.
    await expect(page.getByRole("heading", { name: /Sign in|Create account/i })).toBeVisible();
    await expect(page.getByText(/saved in this browser/i)).toBeVisible();

    await page.getByLabel("Search cards").fill("cobalt");
    await page.getByRole("checkbox", { name: /American Express Cobalt/i }).check();

    await page.getByLabel("Search cards").fill("tangerine");
    await page
      .getByRole("checkbox", { name: /Tangerine Money-Back Mastercard/i })
      .check();

    await expect(page.getByText(/2\s*selected/i)).toBeVisible();
    await expect(page.getByText(/saved in this browser/i)).toBeVisible();

    await page.getByLabel("Purchase amount in CAD").fill("100");
    await page.getByLabel("Merchant name").fill("Loblaws");
    await page.getByRole("button", { name: "Groceries" }).click();
    await page.getByRole("button", { name: "Recommend cards" }).click();

    const results = page.getByRole("list", {
      name: "Ranked card recommendations",
    });
    await expect(results).toBeVisible();
    await expect(page.getByText(/2 ranked/i)).toBeVisible();
    await expect(results.getByRole("heading", { name: "Cobalt" })).toBeVisible();
    await expect(results.getByText(/best for this/i)).toBeVisible();
    await expect(results.getByText(/Loblaws/i)).toBeVisible();
  });

  test("blocks recommend when wallet is empty", async ({ page }) => {
    await page.goto("/app");
    await page.getByLabel("Purchase amount in CAD").fill("40");
    await expect(
      page.getByRole("button", { name: "Recommend cards" }),
    ).toBeDisabled();
  });
});
