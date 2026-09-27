import { expect, test } from "@playwright/test";
import { installNorthtapApiMock, installOverpassMock } from "./helpers/api-mock";
import { browseShellAndSkip, COSTCO_MC, pickCards, SCOTIA_GOLD } from "./helpers/flow";
import { installSupabaseMock } from "./helpers/supabase-mock";

test.describe("first-run flow (guest)", () => {
  test("intro → cards → browse → Shell → skip amount → best card in dollars", async ({ page }) => {
    const api = await installNorthtapApiMock(page);
    await installSupabaseMock(page, { googleEnabled: true });

    await pickCards(page, [SCOTIA_GOLD, COSTCO_MC]);
    await page.getByRole("button", { name: "Choose a store instead" }).click();
    await browseShellAndSkip(page);

    const best = page.getByLabel("Best card");
    await expect(best.getByText("Gold American Express")).toBeVisible();
    await expect(best.getByText("$3.67")).toBeVisible();
    await expect(best.getByText("back on your $100")).toBeVisible();
    await expect(best.getByText("Instant 3¢/L off all fuel grades")).toBeVisible();
    await expect(best.getByText(/Estimate for about 67 L at \$1\.50\/L/)).toBeVisible();
    await expect(best.getByRole("alert")).toContainText(
      "Before you pay: Link your card to Shell Go+ before you pay.",
    );
    await expect(best.getByText(/Verified Sep 22, 2026/)).toBeVisible();
    await expect(best.getByRole("link", { name: "View source" })).toHaveAttribute(
      "href",
      /scotiabank\.com/,
    );

    await expect(page.getByText("Other cards in your wallet")).toBeVisible();
    await expect(page.getByLabel("Costco Mastercard, $3.00 back")).toBeVisible();
    await expect(page.getByText("Keep your wallet")).toBeVisible();

    expect(api.recommendationBodies.at(-1)).toMatchObject({
      amountCad: 100,
      category: "gas",
      merchantQuery: "Shell",
      ownedCardIds: ["scotia-gold-amex", "cibc-costco-mc"],
      fuelGrade: "regular",
    });
  });

  test("location allowed → nearby tiles from OSM; location never reaches the API", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 43.6629, longitude: -79.3957 });
    const api = await installNorthtapApiMock(page);
    const overpass = await installOverpassMock(page);
    await installSupabaseMock(page, { googleEnabled: true });

    await pickCards(page, [SCOTIA_GOLD]);
    await page.getByRole("button", { name: "Allow location" }).click();

    await expect(page.getByRole("tab", { name: "Nearby" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: /^Shell, .*has a card partnership$/ })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Shoppers Drug Mart, .*has a card partnership$/ }),
    ).toBeVisible();
    const local = page.getByRole("button", { name: /^Harbord Convenience, / });
    await expect(local).toBeVisible();
    await expect(local).not.toHaveAccessibleName(/partnership/);
    expect(overpass.bodies.length).toBeGreaterThan(0);

    await page.getByRole("button", { name: /^Shell, / }).click();
    await page.getByRole("button", { name: "$50" }).click();
    await page.getByRole("button", { name: "Show my best card" }).click();
    await expect(page.getByLabel("Best card").getByText("back on your $50")).toBeVisible();

    for (const req of api.requests) {
      const text = `${req.url()} ${req.postData() ?? ""}`;
      expect(text).not.toMatch(/43\.66|79\.39|latitude|longitude/);
    }
  });

  test("location denied → Browse tab with a notice", async ({ page, context }) => {
    await context.clearPermissions();
    await installNorthtapApiMock(page);
    await installSupabaseMock(page, { googleEnabled: true });

    await pickCards(page, [SCOTIA_GOLD]);
    await page.getByRole("button", { name: "Allow location" }).click();

    await expect(page.getByRole("tab", { name: "Browse" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Location is off, so pick your store here.")).toBeVisible();
    await browseShellAndSkip(page);
    await expect(page.getByLabel("Best card").getByText("$3.67")).toBeVisible();
  });

  test("offline → shows the last cached result, labelled as possibly out of date", async ({
    page,
  }) => {
    const api = await installNorthtapApiMock(page);
    await installSupabaseMock(page, { googleEnabled: true });

    await pickCards(page, [SCOTIA_GOLD, COSTCO_MC]);
    await page.getByRole("button", { name: "Choose a store instead" }).click();
    await browseShellAndSkip(page);
    await expect(page.getByLabel("Best card").getByText("$3.67")).toBeVisible();

    api.offline = true;
    await page.getByRole("button", { name: "New search" }).click();
    await page.getByRole("tab", { name: "Browse" }).click();
    await page.getByRole("button", { name: "Gas", exact: true }).click();
    await page.getByRole("button", { name: /^Esso,/ }).click();
    await page.getByRole("button", { name: "$25" }).click();
    await page.getByRole("button", { name: "Show my best card" }).click();

    await expect(page.getByRole("alert").first()).toHaveText(
      "You're offline. This is your last result and may be out of date.",
    );
    const best = page.getByLabel("Best card");
    await expect(best.getByText("$3.67")).toBeVisible();
    await expect(best.getByText("back on your $100")).toBeVisible();
    await expect(best.getByRole("alert")).toContainText("Link your card to Shell Go+");
    await expect(best.getByRole("link", { name: "View source" })).toBeVisible();
  });
});
