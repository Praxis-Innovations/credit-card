import type { Page, Request } from "@playwright/test";
import { expect } from "../../fixtures";

/** Capture recommendation POSTs to the local API (real stack, not a mock). */
export function watchRecommendationBodies(page: Page) {
  const bodies: Array<Record<string, unknown>> = [];
  const handler = (req: Request) => {
    if (req.method() !== "POST") return;
    if (!req.url().includes("/v1/recommendations")) return;
    try {
      bodies.push(req.postDataJSON() as Record<string, unknown>);
    } catch {
      /* ignore non-JSON */
    }
  };
  page.on("request", handler);
  return {
    bodies,
    dispose: () => page.off("request", handler),
  };
}

/** Intro → pick cards → location step. */
export async function pickCards(page: Page, cardLabels: RegExp[]) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /right card for every purchase/i }),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "Get started" }).click();

  await expect(page.getByText("Common cards")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pick at least one card" })).toBeDisabled();
  for (const label of cardLabels) {
    await page.getByRole("checkbox", { name: label }).click();
  }
  await page
    .getByRole("button", {
      name: `Continue with ${cardLabels.length} card${cardLabels.length === 1 ? "" : "s"}`,
    })
    .click();
  await expect(page.getByRole("heading", { name: /Find the store/ })).toBeVisible();
}

/** Browse → Gas → Shell → amount Skip → result. */
export async function browseShellAndSkip(page: Page) {
  await expect(page.getByRole("tab", { name: "Browse" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Gas", exact: true }).click();
  await expect(page.getByText("Top stores for Gas")).toBeVisible();
  await page.getByRole("button", { name: /^Shell,/ }).click();

  await expect(page.getByLabel("Amount in dollars")).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByText("Tap this card")).toBeVisible();
}

/** Copy removed with the v1 scope cut: none of it may appear anywhere. */
const FORBIDDEN_TEXT = /partnership|Shell Go\+|V-Power/i;

export async function expectNoForbiddenText(page: Page) {
  expect(await page.locator("body").innerText()).not.toMatch(FORBIDDEN_TEXT);
}

export const SCOTIA_GOLD = /^Scotiabank Gold American Express, Scene\+$/;
export const TRIANGLE = /^Canadian Tire Triangle World Elite Mastercard, Triangle Rewards$/;
export const COSTCO_MC = /^CIBC Costco Mastercard, Cash back$/;

/** Seeded local app user id from supabase/seed.sql. */
export const E2E_APP_USER_ID = "11111111-1111-4111-8111-111111111111";
