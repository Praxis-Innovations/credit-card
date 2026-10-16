import { expect, test } from "../../src/fixtures";

const TITLE = "NorthTap - The right card for every purchase.";
const DESCRIPTION =
  "NorthTap looks at where you're shopping and tells you which card in your wallet earns the most. Free for Canadian cardholders, no account needed.";

test.describe("basic SEO tags", () => {
  test("document title, description, Open Graph and lang", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(TITLE);
    await expect(page.locator("html")).toHaveAttribute("lang", "en-CA");

    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      DESCRIPTION,
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      TITLE,
    );
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
      "content",
      DESCRIPTION,
    );
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
      "content",
      "en_CA",
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
  });
});
