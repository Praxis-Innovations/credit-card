import { expect, test } from "../../src/fixtures";
import { signInAdminBrowser } from "../../src/helpers/admin-auth";
import { deleteIssuerByName } from "../../src/helpers/admin-data";

const ISSUER = "Tangerine";
const VALID_COMPARE =
  "https://www.tangerine.ca/en/products/spending/credit-cards/compare-credit-cards.html";
const BAD_COMPARE = "https://www.ratehub.ca/credit-cards";

test.describe("admin sources", () => {
  test.beforeEach(async ({ context }) => {
    await deleteIssuerByName(ISSUER);
    await signInAdminBrowser(context);
  });

  test.afterEach(async () => {
    await deleteIssuerByName(ISSUER);
  });

  test("rejects a compare URL that is not on the issuer domain", async ({ page }) => {
    await page.goto("/sources");
    await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();

    await page.getByRole("button", { name: "Add issuer" }).click();
    await expect(page.getByRole("heading", { name: "Add an issuer to the scrape list" })).toBeVisible();

    await page.getByLabel("Issuer name").fill(ISSUER);
    await page.getByLabel("Compare page URL (official site only)").fill(BAD_COMPARE);
    await page.getByRole("button", { name: "Save issuer" }).click();

    await expect(page.getByText(/Use Tangerine's own site/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
    // Still on the form — issuer was not added.
    await expect(page.getByRole("heading", { name: "Add an issuer to the scrape list" })).toBeVisible();
  });

  test("add, edit, pause, and resume an issuer", async ({ page }) => {
    await page.goto("/sources");
    await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();

    // Add
    await page.getByRole("button", { name: "Add issuer" }).click();
    await page.getByLabel("Issuer name").fill(ISSUER);
    await page.getByLabel("Compare page URL (official site only)").fill(VALID_COMPARE);
    await page.getByRole("button", { name: "Save issuer" }).click();

    await expect(page.getByRole("status")).toContainText(`Added ${ISSUER}`);
    await expect(page.getByRole("rowheader", { name: ISSUER })).toBeVisible();

    // Edit
    await page.getByRole("button", { name: `Edit ${ISSUER}` }).click();
    await expect(page.getByRole("heading", { name: `Edit ${ISSUER}` })).toBeVisible();
    await page.getByLabel("Compare page URL (official site only)").fill(VALID_COMPARE);
    await page.getByRole("button", { name: "Save issuer" }).click();
    await expect(page.getByRole("status")).toContainText(`Saved ${ISSUER}`);

    // Pause
    await page.getByRole("button", { name: `Pause ${ISSUER}` }).click();
    await expect(page.getByRole("status")).toContainText(`Paused ${ISSUER}`);
    await expect(page.getByRole("button", { name: `Resume ${ISSUER}` })).toBeVisible();

    // Resume
    await page.getByRole("button", { name: `Resume ${ISSUER}` }).click();
    await expect(page.getByRole("status")).toContainText(`Resumed ${ISSUER}`);
    await expect(page.getByRole("button", { name: `Pause ${ISSUER}` })).toBeVisible();
  });
});
