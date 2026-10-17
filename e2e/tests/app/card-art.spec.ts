import type { Locator } from "@playwright/test";
import { expect, test } from "../../src/fixtures";
import { CARD_ART, installCardArtFixtures } from "../../src/helpers/app/card-art";
import { browseShellAndSkip, COSTCO_MC, pickCards, SCOTIA_GOLD } from "../../src/helpers/app/flow";

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
  const art = await installCardArtFixtures(page);

  await page.goto("/");
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.getByText("Common cards")).toBeVisible();

  const pickerScotia = page.getByTestId("card-art-scotia-gold-amex").first();
  await expectRealArt(pickerScotia, CARD_ART.scotia.path);
  await expectCardShape(pickerScotia, 64);
  await expect(pickerScotia).toHaveAccessibleName(CARD_ART.scotia.alt);
  await expectFallback(page.getByTestId("card-art-cibc-costco-mc").first());
  await expectFallback(page.getByTestId("card-art-triangle-we").first());
  expect(art.imageRequests).toContain(CARD_ART.costco.path);

  await pickCards(page, [SCOTIA_GOLD, COSTCO_MC]);
  await page.getByRole("button", { name: "Choose a store instead" }).click();
  await browseShellAndSkip(page);

  // Gold Amex (~$3.67 with Shell stack) beats Costco 3%; Costco art 404s.
  const best = page.getByLabel("Best card").getByTestId("card-art-scotia-gold-amex");
  await expectRealArt(best, CARD_ART.scotia.path);
  await expectCardShape(best, 112);

  const other = page.getByTestId("card-art-cibc-costco-mc").last();
  await expectFallback(other);
  await expectCardShape(other, 56);
});
