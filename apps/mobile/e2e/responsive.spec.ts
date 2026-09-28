import { expect, type Locator, type Page, test } from "@playwright/test";
import { installNorthtapApiMock } from "./helpers/api-mock";
import { browseShellAndSkip, COSTCO_MC, pickCards, SCOTIA_GOLD } from "./helpers/flow";
import { installSupabaseMock } from "./helpers/supabase-mock";

type Size = "phone" | "tablet" | "desktop";

const VIEWPORTS: Array<{ size: Size; width: number; height: number }> = [
  { size: "phone", width: 390, height: 844 },
  { size: "tablet", width: 820, height: 1180 },
  { size: "desktop", width: 1440, height: 900 },
];

const OVERFLOW_WIDTHS = [320, 390, 599, 600, 820, 1023, 1024, 1440, 1920];

/**
 * Elements that stick out past the right edge of the viewport, ignoring
 * content inside intentional horizontal scrollers (the phone category chips).
 */
async function horizontalOverflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders: string[] = [];
    if (document.documentElement.scrollWidth > vw) {
      offenders.push(`document scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
    }
    const inHorizontalScroller = (el: Element) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const { overflowX } = getComputedStyle(p);
        if ((overflowX === "auto" || overflowX === "scroll") && p.scrollWidth > p.clientWidth) {
          return true;
        }
      }
      return false;
    };
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right > vw + 1 || rect.left < -1) {
        if (inHorizontalScroller(el)) continue;
        const label =
          el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 40) ?? el.tagName;
        offenders.push(`${el.tagName} "${label}" ${Math.round(rect.left)}–${Math.round(rect.right)}`);
      }
    }
    return offenders.slice(0, 10);
  });
}

async function expectNoOverflowAt(page: Page, widths: number[], height = 900) {
  for (const width of widths) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => horizontalOverflow(page), { message: `at ${width}px` }).toEqual([]);
  }
}

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("element has no box");
  return b;
}

/** Every visible card image keeps the 1.586:1 card shape. */
async function expectCardAspect(page: Page) {
  await expect
    .poll(() =>
      page.locator('[data-testid^="card-art-"]').evaluateAll((els) => {
        const ratios = els
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && r.height > 0)
          .map((r) => r.width / r.height);
        return ratios.length > 0 && ratios.every((ratio) => Math.abs(ratio - 1.586) < 0.03);
      }),
    )
    .toBe(true);
}

async function tilesInFirstRow(page: Page): Promise<number> {
  const tiles = page.getByTestId("store-tile-grid").last().getByRole("button");
  const tops = await tiles.evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().top)),
  );
  return tops.filter((top) => top === tops[0]).length;
}

for (const vp of VIEWPORTS) {
  test.describe(`responsive web at ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("happy path: intro → cards → browse → Shell → result → Save", async ({ page }) => {
      await installNorthtapApiMock(page);
      await installSupabaseMock(page, { googleEnabled: true });

      await page.goto("/");
      const banner = page.getByRole("banner");
      if (vp.size === "desktop") {
        await expect(banner.getByLabel("NorthTap")).toBeVisible();
      } else {
        await expect(banner).toHaveCount(0);
      }

      const getStarted = page.getByRole("button", { name: "Get started" });
      await expect(getStarted).toBeVisible();
      const start = await box(getStarted);
      if (vp.size === "phone") {
        expect(start.width).toBeCloseTo(vp.width - 48, 0);
      } else {
        expect(start.width).toBeLessThanOrEqual(400);
        expect(start.x + start.width / 2).toBeCloseTo(vp.width / 2, 0);
      }
      expect(await horizontalOverflow(page)).toEqual([]);

      await pickCards(page, [SCOTIA_GOLD, COSTCO_MC]);
      await page.getByRole("button", { name: "Choose a store instead" }).click();
      await expect(page.getByRole("tab", { name: "Browse" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await page.getByRole("button", { name: "Gas", exact: true }).click();
      await expect(page.getByText(/Partner stores for gas/i)).toBeVisible();

      const column = await box(page.getByRole("tablist", { name: "Find a store" }));
      if (vp.size === "phone") {
        expect(column.x).toBeLessThan(30);
      } else {
        const maxColumn = vp.size === "tablet" ? 560 : 640;
        expect(column.width).toBeLessThanOrEqual(maxColumn);
        expect(column.x + column.width / 2).toBeCloseTo(vp.width / 2, 0);
      }

      expect(await tilesInFirstRow(page)).toBe({ phone: 3, tablet: 4, desktop: 5 }[vp.size]);

      const chipGroup = page.getByRole("group", { name: "Categories" });
      const chips = chipGroup.getByRole("button");
      if (vp.size === "phone") {
        const scrolls = await chipGroup.evaluate((el) => el.scrollWidth > el.clientWidth);
        expect(scrolls).toBe(true);
      } else {
        for (const chip of await chips.all()) {
          const b = await box(chip);
          expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
        }
      }
      expect(await horizontalOverflow(page)).toEqual([]);

      await page.getByRole("button", { name: /^Shell,/ }).click();
      await expect(page.getByLabel("Amount in dollars")).toBeVisible();
      expect(await horizontalOverflow(page)).toEqual([]);
      await page.getByRole("button", { name: "Skip" }).click();

      const best = page.getByRole("region", { name: "Best card" });
      await expect(best.getByText("$3.67")).toBeVisible();
      await expect(best.getByText("back on your $100")).toBeVisible();
      const othersLabel = page.getByText("Other cards in your wallet");
      await expect(othersLabel).toBeVisible();
      await expect(page.getByLabel("Costco Mastercard, $3.00 back")).toBeVisible();
      await expectCardAspect(page);

      const bestBox = await box(best);
      const othersBox = await box(othersLabel);
      if (vp.size === "desktop") {
        expect(othersBox.x).toBeGreaterThan(bestBox.x + bestBox.width);
      } else {
        expect(othersBox.y).toBeGreaterThan(bestBox.y + bestBox.height);
      }
      expect(await horizontalOverflow(page)).toEqual([]);

      await page.getByRole("button", { name: "Save your wallet" }).click();
      const dialog = page.getByRole("dialog", { name: "Save your wallet" });
      await expect(dialog.getByRole("button", { name: "Continue with Google" })).toBeVisible();
      await expect(dialog.getByRole("textbox")).toHaveCount(0);
      // Let the open animation settle before measuring.
      await expect
        .poll(async () => {
          const b = await box(dialog);
          return b.y + b.height;
        })
        .toBeLessThanOrEqual(vp.height + 1);
      const sheet = await box(dialog);
      if (vp.size === "desktop") {
        await expect(dialog.getByRole("button", { name: "Close" })).toBeVisible();
        expect(sheet.width).toBeCloseTo(440, 0);
        expect(sheet.x + sheet.width / 2).toBeCloseTo(vp.width / 2, 0);
        expect(sheet.y + sheet.height).toBeLessThan(vp.height - 24);
      } else {
        expect(sheet.y + sheet.height).toBeCloseTo(vp.height, 0);
        expect(sheet.width).toBeCloseTo(vp.size === "tablet" ? 560 : vp.width, 0);
      }
      await dialog.getByRole("button", { name: "Maybe later" }).click();
      await expect(dialog).toBeHidden();
    });
  });
}

test.describe("no horizontal scrolling from 320px to 1920px", () => {
  test("every screen fits at every width", async ({ page }) => {
    await installNorthtapApiMock(page);
    await installSupabaseMock(page, { googleEnabled: true });

    await page.goto("/");
    await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();
    await expectNoOverflowAt(page, OVERFLOW_WIDTHS);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Get started" }).click();
    await expect(page.getByText("Common cards")).toBeVisible();
    await expectNoOverflowAt(page, OVERFLOW_WIDTHS);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("checkbox", { name: SCOTIA_GOLD }).click();
    await page.getByRole("checkbox", { name: COSTCO_MC }).click();
    await page.getByRole("button", { name: "Continue with 2 cards" }).click();
    await expect(page.getByRole("button", { name: "Allow location" })).toBeVisible();
    await expectNoOverflowAt(page, OVERFLOW_WIDTHS);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Choose a store instead" }).click();
    await page.getByRole("button", { name: "Gas", exact: true }).click();
    await expect(page.getByText(/Partner stores for gas/i)).toBeVisible();
    await expectNoOverflowAt(page, OVERFLOW_WIDTHS);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: /^Shell,/ }).click();
    await expect(page.getByLabel("Amount in dollars")).toBeVisible();
    await expectNoOverflowAt(page, OVERFLOW_WIDTHS);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByLabel("Best card").getByText("$3.67")).toBeVisible();
    await expectNoOverflowAt(page, OVERFLOW_WIDTHS);
    for (const width of OVERFLOW_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await expectCardAspect(page);
    }

    await page.getByRole("button", { name: "Save your wallet" }).click();
    await expect(page.getByRole("dialog", { name: "Save your wallet" })).toBeVisible();
    await expectNoOverflowAt(page, OVERFLOW_WIDTHS);
  });
});

/** Press Tab until `target` has focus, then return (fails after `max` presses). */
async function tabTo(page: Page, target: Locator, max = 80) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

test.describe("keyboard", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("Tab/Enter through the whole flow; the Save dialog traps focus and closes on Escape", async ({
    page,
  }) => {
    await installNorthtapApiMock(page);
    await installSupabaseMock(page, { googleEnabled: true });
    await page.goto("/");

    await tabTo(page, page.getByRole("button", { name: "Get started" }));
    await page.keyboard.press("Enter");

    const scotia = page.getByRole("checkbox", { name: SCOTIA_GOLD });
    await tabTo(page, scotia);
    await page.keyboard.press("Enter");
    await expect(scotia).toHaveAttribute("aria-checked", "true");
    await tabTo(page, page.getByRole("button", { name: "Continue with 1 card" }));
    await page.keyboard.press("Enter");

    await tabTo(page, page.getByRole("button", { name: "Choose a store instead" }));
    await page.keyboard.press("Enter");

    await tabTo(page, page.getByRole("button", { name: "Gas", exact: true }));
    await page.keyboard.press("Enter");
    await expect(page.getByText(/Partner stores for gas/i)).toBeVisible();
    await tabTo(page, page.getByRole("button", { name: /^Shell,/ }));
    await page.keyboard.press("Enter");

    await tabTo(page, page.getByRole("button", { name: "$50" }));
    await page.keyboard.press("Enter");
    await tabTo(page, page.getByRole("button", { name: "Show my best card" }));
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Best card").getByText("back on your $50")).toBeVisible();

    const save = page.getByRole("button", { name: "Save your wallet" });
    await tabTo(page, save);
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Save your wallet" });
    await expect(dialog).toBeVisible();

    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const inside = await dialog.evaluate((el) => el.contains(document.activeElement));
      expect(inside, `focus left the dialog after ${i + 1} Tab presses`).toBe(true);
    }
    await page.keyboard.press("Shift+Tab");
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(save).toBeFocused();
  });
});
