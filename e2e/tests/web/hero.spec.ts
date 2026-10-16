import { expect, test } from "../../src/fixtures";

test.describe("full-height hero", () => {
  test("hero fills the viewport below the site header", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    const header = page.locator("header");
    const hero = page.locator("#top");
    await expect(hero).toBeVisible();

    const headerBox = await header.boundingBox();
    const heroBox = await hero.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(heroBox).not.toBeNull();

    const viewport = page.viewportSize()!;
    // min-h-hero = 100svh - header; allow a few px for subpixel / scrollbar.
    expect(heroBox!.height).toBeGreaterThanOrEqual(viewport.height - headerBox!.height - 4);
  });
});
