import { expect, test } from "../../src/fixtures";
import {
  browseShellAndSkip,
  expectNoForbiddenText,
  pickCards,
  SCOTIA_GOLD,
  TRIANGLE,
} from "../../src/helpers/app/flow";
import { watchRecommendationBodies } from "../../src/helpers/app/google-oauth";
import { installOverpassMock } from "../../src/helpers/app/overpass";

test.describe("first-run flow (guest)", () => {
  test("intro → cards → browse → Shell → skip amount → best card → save", async ({
    page,
  }) => {
    const rec = watchRecommendationBodies(page);

    await pickCards(page, [TRIANGLE, SCOTIA_GOLD]);
    await page.getByRole("button", { name: "Choose a store instead" }).click();
    await browseShellAndSkip(page);

    const summary = page.getByRole("region", { name: "Your purchase" });
    await expect(summary.getByText("Shell · $100.00")).toBeVisible();
    await expect(summary.getByRole("button", { name: "Change store" })).toBeVisible();
    await expect(summary.getByRole("button", { name: "Change amount" })).toBeVisible();

    const best = page.getByRole("region", { name: "Best card" });
    await expect(best.getByText("Triangle World Elite Mastercard")).toBeVisible();
    await expect(best.getByText("$4.00")).toBeVisible();
    await expect(best.getByText("back on your $100")).toBeVisible();
    await expect(best.getByLabel("Earn rate on gas: 4 pts per $1")).toBeVisible();
    await expect(best.getByLabel("Points earned: 400 Triangle Rewards")).toBeVisible();
    await expect(best.getByLabel("Point value: 1¢ each")).toBeVisible();
    await expect(
      best.getByText("Estimate from the card's gas category rate. Rates verified Sep 20, 2026."),
    ).toBeVisible();

    await expect(page.getByText("Other cards in your wallet")).toBeVisible();
    const other = page.getByLabel("Gold American Express, $1.00 back");
    await expect(other).toBeVisible();
    await expect(other.getByText("1× Scene+ on gas")).toBeVisible();
    await expect(page.getByText("Keep your wallet")).toBeVisible();
    await expect(page.getByRole("button", { name: "New search" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
    await expectNoForbiddenText(page);

    await page.getByRole("button", { name: "Save your wallet" }).click();
    const sheet = page.getByRole("dialog", { name: "Save your wallet" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await sheet.getByRole("button", { name: "Maybe later" }).click();
    await expect(sheet).toBeHidden();

    // v1 ranks by category only: no merchant / location on the wire.
    const body = rec.bodies.at(-1)!;
    expect(Object.keys(body).sort()).toEqual(["amountCad", "category", "limit", "ownedCardIds"]);
    expect(body).toMatchObject({ amountCad: 100, category: "gas" });
    expect([...(body.ownedCardIds as string[])].sort()).toEqual([
      "scotia-gold-amex",
      "triangle-we",
    ]);
    rec.dispose();
  });

  test("browse instead of nearby (Choose a store instead)", async ({ page }) => {
    const rec = watchRecommendationBodies(page);

    await pickCards(page, [TRIANGLE, SCOTIA_GOLD]);
    await page.getByRole("button", { name: "Choose a store instead" }).click();
    await expect(page.getByRole("tab", { name: "Browse" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "Groceries", exact: true }).click();
    await expect(page.getByText("Top stores for Groceries")).toBeVisible();
    await page.getByRole("button", { name: "Not listed? Use Groceries rates" }).click();
    await page.getByRole("button", { name: "Skip" }).click();

    const best = page.getByRole("region", { name: "Best card" });
    await expect(best.getByText("Gold American Express")).toBeVisible();
    await expect(best.getByText("$5.00")).toBeVisible();
    expect(rec.bodies.at(-1)).toMatchObject({ category: "groceries" });
    rec.dispose();
  });

  test("location allowed → nearby tiles from OSM; location never reaches the API", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 43.6629, longitude: -79.3957 });
    const rec = watchRecommendationBodies(page);
    const overpass = await installOverpassMock(page);

    await pickCards(page, [SCOTIA_GOLD]);
    await page.getByRole("button", { name: "Allow location" }).click();

    await expect(page.getByRole("tab", { name: "Nearby" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Stores around you")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Shell, \d/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Shoppers Drug Mart, \d/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Harbord Convenience, \d/ })).toBeVisible();
    await expectNoForbiddenText(page);
    expect(overpass.bodies.length).toBeGreaterThan(0);

    await page.getByRole("button", { name: /^Shell, / }).click();
    await page.getByRole("button", { name: "$50" }).click();
    await page.getByRole("button", { name: "Show my best card" }).click();
    await expect(page.getByLabel("Best card").getByText("back on your $50")).toBeVisible();
    expect(rec.bodies.at(-1)).toMatchObject({ amountCad: 50, category: "gas" });

    for (const body of rec.bodies) {
      const text = JSON.stringify(body);
      expect(text).not.toMatch(/43\.66|79\.39|latitude|longitude/);
    }
    rec.dispose();
  });

  test("location denied → Browse tab with a notice", async ({ page, context }) => {
    await context.clearPermissions();

    await pickCards(page, [SCOTIA_GOLD]);
    await page.getByRole("button", { name: "Allow location" }).click();

    await expect(page.getByRole("tab", { name: "Browse" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Location is off, so pick your store here.")).toBeVisible();
    await browseShellAndSkip(page);
    await expect(page.getByLabel("Best card").getByText("$1.00")).toBeVisible();
  });

  test("offline → shows the last cached result, labelled as possibly out of date", async ({
    page,
  }) => {
    await pickCards(page, [TRIANGLE, SCOTIA_GOLD]);
    await page.getByRole("button", { name: "Choose a store instead" }).click();
    await browseShellAndSkip(page);
    await expect(page.getByLabel("Best card").getByText("$4.00")).toBeVisible();

    // Drop recommendations only — catalog/store still load from the local API.
    await page.route("**/v1/recommendations", (route) => route.abort("internetdisconnected"));

    await page.getByRole("button", { name: "New search" }).click();
    await page.getByRole("tab", { name: "Browse" }).click();
    await page.getByRole("button", { name: "Gas", exact: true }).click();
    await page.getByRole("button", { name: /^Esso,/ }).click();
    await page.getByRole("button", { name: "$25" }).click();
    await page.getByRole("button", { name: "Show my best card" }).click();

    await expect(page.getByRole("alert").first()).toHaveText(
      "You're offline. This is your last result and may be out of date.",
    );
    // The cached result keeps the store it was for.
    await expect(page.getByText("Shell · $100.00")).toBeVisible();
    const best = page.getByLabel("Best card");
    await expect(best.getByText("$4.00")).toBeVisible();
    await expect(best.getByText("back on your $100")).toBeVisible();
  });
});
