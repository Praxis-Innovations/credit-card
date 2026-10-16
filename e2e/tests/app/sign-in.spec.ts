import { expect, test } from "../../src/fixtures";
import {
  browseShellAndSkip,
  COSTCO_MC,
  E2E_APP_USER_ID,
  pickCards,
  SCOTIA_GOLD,
} from "../../src/helpers/app/flow";
import { installGoogleOAuthBypass } from "../../src/helpers/app/google-oauth";
import { clearAppUserCards, listAppUserCards, seedAppUserCards } from "../../src/helpers/app/wallet";

async function reachResult(page: import("@playwright/test").Page) {
  await pickCards(page, [SCOTIA_GOLD, COSTCO_MC]);
  await page.getByRole("button", { name: "Choose a store instead" }).click();
  await browseShellAndSkip(page);
}

test.describe("sign-in (Save your wallet)", () => {
  test.beforeEach(async ({ supabaseService }) => {
    await clearAppUserCards(supabaseService, E2E_APP_USER_ID);
  });

  test("sheet is Google-only; Maybe later keeps the guest wallet", async ({ page }) => {
    await reachResult(page);

    await page.getByRole("button", { name: "Save your wallet" }).click();
    const sheet = page.getByRole("dialog", { name: "Save your wallet" });
    await expect(sheet).toBeVisible();
    await expect(
      sheet.getByText("Sign in to keep your 2 cards and use them on any device."),
    ).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(sheet.getByRole("textbox")).toHaveCount(0);
    await expect(sheet.getByText(/email|password/i)).toHaveCount(0);

    await sheet.getByRole("button", { name: "Maybe later" }).click();
    await expect(sheet).toBeHidden();
    await page.goto("/");
    await expect(page.getByRole("tablist", { name: "Find a store" })).toBeVisible();
  });

  test("shows a clear error when Google isn't enabled", async ({ page, signInAs }) => {
    const { session } = await signInAs("app");
    await installGoogleOAuthBypass(page, session, { googleEnabled: false });
    await reachResult(page);

    await page.getByRole("button", { name: "Save your wallet" }).click();
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(
      page.getByRole("dialog", { name: "Save your wallet" }).getByRole("alert"),
    ).toContainText(/Google sign-in isn't set up/);
  });

  test("Google sign-in redirects back and merges the guest wallet into user_cards", async ({
    page,
    signInAs,
    supabaseService,
  }) => {
    await seedAppUserCards(supabaseService, ["cibc-costco-mc"], E2E_APP_USER_ID);
    const { session } = await signInAs("app");
    const oauth = await installGoogleOAuthBypass(page, session);

    await reachResult(page);

    await page.getByRole("button", { name: "Save your wallet" }).click();
    await page.getByRole("button", { name: "Continue with Google" }).click();

    await expect(page.getByText("Wallet saved")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/user@northtap\.test/)).toBeVisible();
    await expect(page.getByText("Shell · $100.00")).toBeVisible();
    await expect(page.getByLabel("Best card").getByText("$3.00")).toBeVisible();

    expect(oauth.authorizeUrls.length).toBeGreaterThan(0);
    const authorize = new URL(oauth.authorizeUrls[0]!);
    expect(authorize.searchParams.get("provider")).toBe("google");
    expect(authorize.searchParams.get("redirect_to")).toMatch(/\/result$/);

    const remote = await listAppUserCards(supabaseService, E2E_APP_USER_ID);
    expect(remote.sort()).toEqual(["cibc-costco-mc", "scotia-gold-amex"]);
  });

  test("wide web shows the Save dialog with a close button", async ({ page }) => {
    await reachResult(page);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: "Save your wallet" }).click();
    const dialog = page.getByRole("dialog", { name: "Save your wallet" });
    await expect(dialog.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
  });
});
