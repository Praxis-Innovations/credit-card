import { expect, test } from "../../src/fixtures";

test.describe("theme toggle", () => {
  test("flips data-theme and persists the choice", async ({ page }) => {
    await page.goto("/");
    // Seed light via storage + reload so the first paint is deterministic
    // without an init script that would overwrite on later reloads.
    await page.evaluate(`window.localStorage.setItem("northtap-theme", "light")`);
    await page.reload();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const toggle = page.getByRole("button", { name: "Switch to dark theme" });
    await expect(toggle).toBeVisible();

    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(
      page.getByRole("button", { name: "Switch to light theme" }),
    ).toBeVisible();
    expect(
      await page.evaluate(`window.localStorage.getItem("northtap-theme")`),
    ).toBe("dark");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});
