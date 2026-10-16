import { expect, test } from "../../src/fixtures";
import { E2E_APP_USER_ID, SCOTIA_GOLD } from "../../src/helpers/app/flow";
import { clearAppUserCards } from "../../src/helpers/app/wallet";

test.describe("no saved cards", () => {
  test("guest must pick at least one card before continuing", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /right card for every purchase/i }),
    ).toBeVisible({ timeout: 45_000 });
    await page.getByRole("button", { name: "Get started" }).click();

    await expect(page.getByText("Common cards")).toBeVisible();
    const continueBtn = page.getByRole("button", { name: "Pick at least one card" });
    await expect(continueBtn).toBeDisabled();

    await page.getByRole("checkbox", { name: SCOTIA_GOLD }).click();
    await expect(page.getByRole("button", { name: "Continue with 1 card" })).toBeEnabled();
  });

  test("signed-in user with empty remote wallet lands on card picker", async ({
    page,
    signInAs,
    supabaseService,
  }) => {
    await clearAppUserCards(supabaseService, E2E_APP_USER_ID);
    const { session } = await signInAs("app");

    // Same hash shape as the Google redirect; empty guest + remote wallet → welcome.
    const hash = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: "3600",
      token_type: "bearer",
    });
    await page.goto(`/result#${hash.toString()}`);

    // Wait until supabase-js has consumed the hash and persisted the session.
    await expect.poll(() => new URL(page.url()).hash).toBe("");
    await expect
      .poll(() =>
        page.evaluate(`(() => {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && /auth-token|supabase/i.test(key) && localStorage.getItem(key)) {
              return true;
            }
          }
          return false;
        })()`),
      )
      .toBe(true);

    // Guest + empty wallet on /result redirects to /cards; signed-in redirects to /store.
    await expect(page.getByRole("tablist", { name: "Find a store" })).toBeVisible({
      timeout: 30_000,
    });

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /right card for every purchase/i }),
    ).toBeVisible({ timeout: 45_000 });
    await page.getByRole("button", { name: "Get started" }).click();
    await expect(page.getByText("Common cards")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pick at least one card" })).toBeDisabled();
    // Remote wallet was empty — nothing pre-selected after merge.
    await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(0);
  });
});
