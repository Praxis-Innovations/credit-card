import { expect, test } from "../../src/fixtures";
import { signInAdminBrowser } from "../../src/helpers/admin-auth";
import { ensureReviewFixtures } from "../../src/helpers/admin-data";

test.describe("admin review", () => {
  let approveName: string;
  let rejectName: string;

  test.beforeEach(async ({ context }) => {
    ({ approveName, rejectName } = await ensureReviewFixtures());
    await signInAdminBrowser(context);
  });

  test("approve a pending finding", async ({ page }) => {
    await page.goto("/review");
    await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();

    const rowButton = page.getByRole("button", { name: approveName });
    await expect(rowButton).toBeVisible();
    await rowButton.click();

    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(`Approved ${approveName}`);
    await expect(page.getByRole("button", { name: approveName })).toHaveCount(0);
  });

  test("reject a pending finding with a reason", async ({ page }) => {
    await page.goto("/review");
    await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();

    const rowButton = page.getByRole("button", { name: rejectName });
    await expect(rowButton).toBeVisible();
    await rowButton.click();

    await page.getByRole("button", { name: "Reject…" }).click();
    await page
      .getByLabel("Reason for rejecting (required)")
      .fill("Fee quote does not match the current product page.");
    await page.getByRole("button", { name: "Confirm reject" }).click();

    await expect(page.getByRole("status")).toContainText(`Rejected ${rejectName}`);
    await expect(page.getByRole("button", { name: rejectName })).toHaveCount(0);
  });
});
