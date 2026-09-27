import { expect, type Page, test } from "@playwright/test";
import { installNorthtapApiMock } from "./helpers/api-mock";
import { browseShellAndSkip, COSTCO_MC, pickCards, SCOTIA_GOLD } from "./helpers/flow";
import { installSupabaseMock } from "./helpers/supabase-mock";

async function reachResult(page: Page) {
  await pickCards(page, [SCOTIA_GOLD, COSTCO_MC]);
  await page.getByRole("button", { name: "Choose a store instead" }).click();
  await browseShellAndSkip(page);
}

test.describe("Save your wallet", () => {
  test("sheet is Google-only; Maybe later keeps the guest wallet", async ({ page }) => {
    await installNorthtapApiMock(page);
    await installSupabaseMock(page, { googleEnabled: true });
    await reachResult(page);

    await page.getByRole("button", { name: "Save your wallet" }).click();
    const sheet = page.getByRole("dialog", { name: "Save your wallet" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Sign in to keep your 2 cards and use them on any device.")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(sheet.getByRole("textbox")).toHaveCount(0);
    await expect(sheet.getByText(/email|password/i)).toHaveCount(0);
    await expect(page.getByLabel(/password/i)).toHaveCount(0);

    await sheet.getByRole("button", { name: "Maybe later" }).click();
    await expect(sheet).toBeHidden();
    await page.reload();
    await page.goto("/");
    await expect(page.getByRole("tablist", { name: "Find a store" })).toBeVisible();
  });

  test("shows a clear error when Google isn't enabled in Supabase", async ({ page }) => {
    await installNorthtapApiMock(page);
    const supabase = await installSupabaseMock(page, { googleEnabled: false });
    await reachResult(page);

    await page.getByRole("button", { name: "Save your wallet" }).click();
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(
      page.getByRole("dialog", { name: "Save your wallet" }).getByRole("alert"),
    ).toContainText(/Google sign-in isn't set up/);
    expect(supabase.authorizeUrls).toHaveLength(0);
  });

  test("Google sign-in redirects back and merges the guest wallet into user_cards", async ({
    page,
  }) => {
    await installNorthtapApiMock(page);
    const supabase = await installSupabaseMock(page, {
      googleEnabled: true,
      completeOAuth: true,
      remoteCardIds: ["cibc-costco-mc"],
    });
    await reachResult(page);

    await page.getByRole("button", { name: "Save your wallet" }).click();
    await page.getByRole("button", { name: "Continue with Google" }).click();

    await expect(page.getByText("Wallet saved")).toBeVisible();
    await expect(page.getByText(/e2e@northtap\.test/)).toBeVisible();
    await expect(page.getByLabel("Best card").getByText("$3.67")).toBeVisible();

    const authorize = new URL(supabase.authorizeUrls[0]!);
    expect(authorize.searchParams.get("provider")).toBe("google");
    expect(authorize.searchParams.get("redirect_to")).toMatch(/\/result$/);
    expect(supabase.inserted.map((row) => row.card_id)).toEqual(["scotia-gold-amex"]);
  });

  test("wide web shows the Save dialog with a close button", async ({ page }) => {
    await installNorthtapApiMock(page);
    await installSupabaseMock(page, { googleEnabled: true });
    await reachResult(page);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: "Save your wallet" }).click();
    const dialog = page.getByRole("dialog", { name: "Save your wallet" });
    await expect(dialog.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
  });
});
