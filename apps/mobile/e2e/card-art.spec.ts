import { expect, type Locator, test } from "@playwright/test";
import { installNorthtapApiMock } from "./helpers/api-mock";
import { browseShellAndSkip, COSTCO_MC, pickCards, SCOTIA_GOLD } from "./helpers/flow";
import { installSupabaseMock } from "./helpers/supabase-mock";

async function expectCardShape(art: Locator, width: number) {
  const box = await art.boundingBox();
  expect(box?.width).toBeCloseTo(width, 0);
  expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(1.586, 1);
}

/** Real art: the API image is shown and no placeholder tint is painted. */
async function expectRealArt(art: Locator, file: string) {
  await expect(art.locator(`img[src$="${file}"]`)).toHaveCount(1);
  await expect(art).not.toHaveAttribute("aria-busy", "true");
  await expect(art).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
}

async function expectFallback(art: Locator) {
  await expect(art.locator("img")).toHaveCount(0);
  await expect(art).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
}

test("renders API card art at 1.586:1 and falls back when an image fails", async ({ page }) => {
  const api = await installNorthtapApiMock(page);
  await installSupabaseMock(page, { googleEnabled: true });

  await page.goto("/");
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.getByText("Common cards")).toBeVisible();

  const pickerScotia = page.getByTestId("card-art-scotia-gold-amex").first();
  await expectRealArt(pickerScotia, "/assets/cards/scotia-gold-amex.png");
  await expectCardShape(pickerScotia, 64);
  await expect(pickerScotia).toHaveAccessibleName("Scotiabank Gold American Express card");
  await expectFallback(page.getByTestId("card-art-cibc-costco-mc").first());
  await expectFallback(page.getByTestId("card-art-triangle-we").first());
  expect(api.imageRequests).toContain("/assets/cards/cibc-costco-mc-missing.png");

  await pickCards(page, [SCOTIA_GOLD, COSTCO_MC]);
  await page.getByRole("button", { name: "Choose a store instead" }).click();
  await browseShellAndSkip(page);

  const best = page.getByLabel("Best card").getByTestId("card-art-scotia-gold-amex");
  await expectRealArt(best, "/assets/cards/scotia-gold-amex.png");
  await expectCardShape(best, 112);

  const other = page.getByTestId("card-art-cibc-costco-mc").last();
  await expectFallback(other);
  await expectCardShape(other, 56);
});
