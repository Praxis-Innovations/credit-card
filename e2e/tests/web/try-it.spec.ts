import { expect, test } from "../../src/fixtures";

test.describe("hero Try it widget", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("defaults to Gas with Triangle World Elite on top", async ({ page }) => {
    const widget = page.getByRole("region", { name: "Try it" });
    await expect(widget.getByRole("heading", { name: "Try it" })).toBeVisible();
    await expect(widget.getByText("$100 purchase")).toBeVisible();

    const gas = widget.getByRole("radio", { name: "Gas" });
    await expect(gas).toHaveAttribute("aria-checked", "true");

    const cards = widget.getByRole("list", { name: "Cards, best first" });
    const first = cards.getByRole("listitem").first();
    await expect(first).toHaveAttribute("data-card", "tri");
    await expect(first.getByText("Tap this")).toBeVisible();
    await expect(first.getByText("Triangle World Elite")).toBeVisible();
    await expect(first.getByText("$4.00")).toBeVisible();
  });

  test("switching category re-ranks the example cards", async ({ page }) => {
    const widget = page.getByRole("region", { name: "Try it" });
    const cards = widget.getByRole("list", { name: "Cards, best first" });

    await widget.getByRole("radio", { name: "Groceries" }).click();
    await expect(widget.getByRole("radio", { name: "Groceries" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(cards.getByRole("listitem").first()).toHaveAttribute("data-card", "gold");
    await expect(cards.getByRole("listitem").first().getByText("$5.00")).toBeVisible();
    await expect(cards.getByRole("listitem").first().getByText("Tap this")).toBeVisible();

    await widget.getByRole("radio", { name: "Dining" }).click();
    await expect(cards.getByRole("listitem").first()).toHaveAttribute("data-card", "gold");
    await expect(cards.getByRole("listitem").first().getByText("$3.00")).toBeVisible();
  });

  test("arrow keys move the category radio selection", async ({ page }) => {
    const widget = page.getByRole("region", { name: "Try it" });
    const gas = widget.getByRole("radio", { name: "Gas" });
    await gas.focus();
    await page.keyboard.press("ArrowRight");
    await expect(widget.getByRole("radio", { name: "Groceries" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(widget.getByRole("radio", { name: "Groceries" })).toBeFocused();
  });
});
