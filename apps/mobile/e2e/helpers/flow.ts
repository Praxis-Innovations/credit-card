import { expect, type Page } from "@playwright/test";

/** Intro → pick cards → location step. */
export async function pickCards(page: Page, cardLabels: RegExp[]) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /right card for every purchase/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Get started" }).click();

  await expect(page.getByText("Common cards")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pick at least one card" })).toBeDisabled();
  for (const label of cardLabels) {
    await page.getByRole("checkbox", { name: label }).click();
  }
  await page
    .getByRole("button", { name: `Continue with ${cardLabels.length} card${cardLabels.length === 1 ? "" : "s"}` })
    .click();
  await expect(page.getByRole("heading", { name: /Find the store/ })).toBeVisible();
}

/** Browse → Shell → amount Skip → result. */
export async function browseShellAndSkip(page: Page) {
  await expect(page.getByRole("tab", { name: "Browse" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Gas", exact: true }).click();
  await expect(page.getByText(/Partner stores for gas/i)).toBeVisible();
  await page.getByRole("button", { name: /^Shell,/ }).click();

  await expect(page.getByLabel("Amount in dollars")).toBeVisible();
  await expect(page.getByText("Optional. We'll use $100 if you skip.")).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByText("Tap this card")).toBeVisible();
}

export const SCOTIA_GOLD = /^Scotiabank Gold American Express, Scene\+$/;
export const COSTCO_MC = /^CIBC Costco Mastercard, Cash back$/;
