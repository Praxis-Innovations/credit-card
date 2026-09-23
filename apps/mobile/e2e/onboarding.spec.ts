import { expect, test } from "@playwright/test";
import { installNorthtapApiMock } from "./helpers/api-mock";

const ONBOARDING_KEY = "northtap.onboardingComplete";

test.describe("first-run onboarding (Expo web)", () => {
  test("walks welcome → demo → guest home, then skips on return", async ({
    page,
  }) => {
    await installNorthtapApiMock(page);
    // Clear storage once per tab — addInitScript runs on every navigation.
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("northtap.e2eOnboardingSeeded")) {
        localStorage.clear();
        sessionStorage.setItem("northtap.e2eOnboardingSeeded", "1");
      }
    });

    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /Tap the right card/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: "See it in action" }).click();

    await expect(
      page.getByRole("heading", { name: /Here's what NorthTap tells you/i }),
    ).toBeVisible();
    await expect(page.getByText(/\$45\.00 dinner/i)).toBeVisible();
    await expect(page.getByText("Cobalt").first()).toBeVisible();
    await expect(page.getByText(/5× Amex MR/i).first()).toBeVisible();
    await page.getByRole("button", { name: "Got it — continue" }).click();

    await expect(
      page.getByRole("heading", { name: /Start as a guest/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/Sign-in lives on the home screen/i),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue as guest" }).click();

    await expect(
      page.getByRole("heading", { name: "Which card for this purchase?" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/saved on this device/i)).toBeVisible();

    const flag = await page.evaluate(
      (key) => localStorage.getItem(key),
      ONBOARDING_KEY,
    );
    expect(flag).toBe("1");

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Which card for this purchase?" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("heading", { name: /Tap the right card/i }),
    ).toHaveCount(0);
  });
});
