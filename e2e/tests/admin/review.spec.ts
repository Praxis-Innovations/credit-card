import { expect, test } from "../../src/fixtures";
import { signInAdminBrowser } from "../../src/helpers/admin-auth";
import { cleanupReviewFixtures, ensureReviewFixtures } from "../../src/helpers/admin-data";

test.describe("admin review", () => {
  let approveName: string;
  let rejectName: string;

  test.beforeEach(async ({ context }) => {
    ({ approveName, rejectName } = await ensureReviewFixtures());
    await signInAdminBrowser(context);
  });

  test.afterAll(async () => {
    await cleanupReviewFixtures();
  });

  test("approve a pending finding", async ({ page }) => {
    await page.goto("/review");
    await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();

    const rowButton = page.getByRole("button", { name: approveName });
    await expect(rowButton).toBeVisible();
    await rowButton.click();

    await page.getByRole("button", { name: "Approve and next →" }).click();
    // Approve navigates to the next pending card; confirm via the queue.
    await page.goto("/review");
    await expect(page.getByRole("button", { name: approveName })).toHaveCount(0);
  });

  test("reject a pending finding with a reason", async ({ page }) => {
    await page.goto("/review");
    await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();

    const rowButton = page.getByRole("button", { name: rejectName });
    await expect(rowButton).toBeVisible();
    await rowButton.click();

    await page.getByLabel("Reject reason").fill(
      "Fee quote does not match the current product page.",
    );
    await page.getByRole("button", { name: "Reject card" }).click();
    await page.goto("/review");
    await expect(page.getByRole("button", { name: rejectName })).toHaveCount(0);
  });
});
