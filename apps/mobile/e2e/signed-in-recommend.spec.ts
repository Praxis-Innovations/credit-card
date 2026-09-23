import { expect, test } from "@playwright/test";
import { installNorthtapApiMock } from "./helpers/api-mock";
import { installSupabaseMock } from "./helpers/supabase-mock";

async function skipOnboarding(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem("northtap.onboardingComplete", "1");
  });
}

test.describe("signed-in purchase → recommend flow (Expo web)", () => {
  test("loads synced wallet and ranks a dining purchase", async ({ page }) => {
    await skipOnboarding(page);
    await installNorthtapApiMock(page);
    await installSupabaseMock(page, {
      initialCardIds: ["amex-cobalt", "tangerine-moneyback"],
    });

    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /Sign in|Create account/i }),
    ).toBeVisible();

    await page.getByLabel("Email").fill("e2e@northtap.test");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/Signed in as/i)).toBeVisible();
    await expect(page.getByText(/synced to Supabase/i)).toBeVisible();
    await expect(page.getByText(/2\s*selected/i)).toBeVisible();

    await page.getByLabel("Search cards").fill("cobalt");
    await expect(
      page.getByRole("checkbox", { name: /American Express Cobalt/i }),
    ).toBeChecked();

    await page.getByLabel("Purchase amount in CAD").fill("45");
    await page.getByLabel("Merchant name").fill("Cactus Club");
    await page.getByRole("button", { name: "Dining" }).click();
    await page.getByRole("button", { name: "Recommend cards" }).click();

    const results = page.getByLabel("Ranked card recommendations");
    await expect(results).toBeVisible();
    await expect(results.getByRole("heading", { name: "Cobalt" })).toBeVisible();
    await expect(results.getByText(/best for this/i)).toBeVisible();
    await expect(results.getByText(/Cactus Club/i)).toBeVisible();
  });

  test("persists a newly added card to the mocked user_cards API", async ({
    page,
  }) => {
    await skipOnboarding(page);
    await installSupabaseMock(page, { initialCardIds: [] });
    await page.goto("/");

    await page.getByLabel("Email").fill("e2e@northtap.test");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/Signed in as/i)).toBeVisible();

    await page.getByLabel("Search cards").fill("cobalt");
    const insertWait = page.waitForRequest(
      (req) =>
        req.method() === "POST" &&
        req.url().includes("/rest/v1/user_cards"),
    );
    await page
      .getByRole("checkbox", { name: /American Express Cobalt/i })
      .click();
    await insertWait;

    await expect(page.getByText(/1\s*selected/i)).toBeVisible();
  });
});
