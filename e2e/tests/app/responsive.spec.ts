import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../../src/fixtures";
import { expectNoForbiddenText, SCOTIA_GOLD, TRIANGLE } from "../../src/helpers/app/flow";

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
  // String evaluate: e2e tsconfig has no DOM lib.
  return page.evaluate(`(() => {
    const vw = document.documentElement.clientWidth;
    const offenders = [];
    if (document.documentElement.scrollWidth > vw) {
      offenders.push("document scrollWidth " + document.documentElement.scrollWidth + " > " + vw);
    }
    const inHorizontalScroller = (el) => {
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
        offenders.push(
          el.tagName + ' "' + label + '" ' + Math.round(rect.left) + "–" + Math.round(rect.right),
        );
      }
    }
    return offenders.slice(0, 10);
  })()`) as Promise<string[]>;
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

const CONTENT_WIDTH = { tablet: 704, desktop: 1040 } as const;

/** Widths of every visible page column (hidden stack screens have no box). */
async function contentWidths(page: Page): Promise<number[]> {
  return page
    .locator('[data-testid="screen-content"]')
    .evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().width).filter((w) => w > 0).map(Math.round),
    );
}

/** Phone: no column. Tablet/desktop: the same fixed column, centred, on every screen. */
async function expectColumn(page: Page, vp: { size: Size; width: number }) {
  if (vp.size === "phone") {
    await expect.poll(() => contentWidths(page)).toEqual([vp.width]);
    return;
  }
  const width = CONTENT_WIDTH[vp.size];
  await expect.poll(() => contentWidths(page)).toEqual([width]);
}

/** The current screen's bottom bar (earlier stack screens stay mounted, hidden). */
function actionBar(page: Page) {
  return page.locator('[data-testid="action-bar"]:visible');
}

/** Tablet/desktop action bar: Back at the column's left edge, the primary at its right. */
async function expectActionBar(
  page: Page,
  vp: { size: Size; width: number },
  primary: string | null,
) {
  const bar = actionBar(page);
  if (vp.size === "phone") {
    await expect(bar).toHaveCount(0);
    return;
  }
  const width = CONTENT_WIDTH[vp.size];
  const left = (vp.width - width) / 2;
  const back = await box(bar.getByRole("button", { name: "Back" }));
  expect(back.x).toBeCloseTo(left, 0);
  if (primary) {
    const b = await box(bar.getByRole("button", { name: primary }));
    expect(b.x + b.width).toBeCloseTo(left + width, 0);
  }
}

for (const vp of VIEWPORTS) {
  test.describe(`responsive web at ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("happy path: intro → cards → location → browse Gas → Shell → Skip → Triangle $4.00", async ({
      page,
    }) => {
      test.setTimeout(120_000);

      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: /right card for every purchase/i }),
      ).toBeVisible({ timeout: 45_000 });

      const banner = page.getByRole("banner");
      if (vp.size === "phone") {
        await expect(banner).toHaveCount(0);
      } else {
        await expect(banner.getByLabel("NorthTap")).toBeVisible();
        await expect(banner.getByRole("progressbar")).toHaveCount(0);
      }
      await expectColumn(page, vp);

      const getStarted = page.getByRole("button", { name: "Get started" });
      await expect(getStarted).toBeVisible();
      const start = await box(getStarted);
      if (vp.size === "phone") {
        expect(start.width).toBeCloseTo(vp.width - 48, 0);
      } else if (vp.size === "tablet") {
        // In the bottom action bar, at the column's right edge.
        expect(start.x + start.width).toBeCloseTo((vp.width + 704) / 2, 0);
        await expect(actionBar(page)).toContainText("Takes about a minute · no account needed");
      } else {
        // Inline under the copy, at the column's left edge.
        expect(start.x).toBeCloseTo((vp.width - 1040) / 2, 0);
        await expect(actionBar(page)).toHaveCount(0);
      }
      expect(await horizontalOverflow(page)).toEqual([]);

      await getStarted.click();
      await expect(page.getByText("Common cards")).toBeVisible();
      await expectColumn(page, vp);
      if (vp.size !== "phone") {
        const steps = banner.getByRole("progressbar", { name: "Step 1 of 3" });
        await expect(steps).toBeVisible();
        const stepsBox = await box(steps);
        expect(stepsBox.x + stepsBox.width / 2).toBeCloseTo(vp.width / 2, 0);
        // Labelled on desktop, numbered only on tablet.
        await expect(steps.getByText("Cards", { exact: true })).toHaveCount(
          vp.size === "desktop" ? 1 : 0,
        );
      }
      await page.getByRole("checkbox", { name: TRIANGLE }).click();
      await page.getByRole("checkbox", { name: SCOTIA_GOLD }).click();
      await expectActionBar(page, vp, "Continue with 2 cards");
      if (vp.size !== "phone") {
        const rows = page.getByRole("checkbox");
        const [first, second] = [await box(rows.nth(0)), await box(rows.nth(1))];
        expect(second.y).toBeCloseTo(first.y, 0);
        expect(second.x).toBeGreaterThan(first.x + first.width);
      }
      expect(await horizontalOverflow(page)).toEqual([]);
      await page.getByRole("button", { name: "Continue with 2 cards" }).click();

      await expect(page.getByRole("heading", { name: /Find the store/ })).toBeVisible();
      await expect(
        page.getByText(/so it knows the kind of purchase: gas, groceries, dining and more/),
      ).toBeVisible();
      await expectColumn(page, vp);
      await expectActionBar(page, vp, "Allow location");
      if (vp.size !== "phone") {
        // The tertiary action sits just left of the primary.
        const bar = actionBar(page);
        const choose = await box(bar.getByRole("button", { name: "Choose a store instead" }));
        const allow = await box(bar.getByRole("button", { name: "Allow location" }));
        expect(choose.x + choose.width).toBeLessThanOrEqual(allow.x);
        expect(allow.x - (choose.x + choose.width)).toBeLessThan(24);
      }
      await expectNoForbiddenText(page);
      await page.getByRole("button", { name: "Choose a store instead" }).click();

      await expect(page.getByRole("tab", { name: "Browse" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await page.getByRole("button", { name: "Gas", exact: true }).click();
      await expect(page.getByText("Top stores for Gas")).toBeVisible();
      await expectColumn(page, vp);
      await expectActionBar(page, vp, null);
      if (vp.size !== "phone") {
        await expect(actionBar(page)).toContainText("Choose a store to continue");
      }

      const tabs = await box(page.getByRole("tablist", { name: "Find a store" }));
      if (vp.size === "phone") {
        expect(tabs.x).toBeLessThan(30);
      } else if (vp.size === "tablet") {
        expect(tabs.width).toBeCloseTo(704, 0);
      } else {
        expect(tabs.width).toBeCloseTo(320, 0);
        expect(tabs.x + tabs.width).toBeCloseTo((vp.width + 1040) / 2, 0);
      }

      expect(await tilesInFirstRow(page)).toBe({ phone: 3, tablet: 4, desktop: 6 }[vp.size]);

      const chipGroup = page.getByRole("group", { name: "Categories" });
      if (vp.size === "phone") {
        const scrolls = await chipGroup.evaluate((el) => el.scrollWidth > el.clientWidth);
        expect(scrolls).toBe(true);
      } else {
        for (const chip of await chipGroup.getByRole("button").all()) {
          const b = await box(chip);
          expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
        }
      }
      await expectNoForbiddenText(page);
      expect(await horizontalOverflow(page)).toEqual([]);

      await page.getByRole("button", { name: /^Shell,/ }).click();
      await expect(page.getByLabel("Amount in dollars")).toBeVisible();
      await expectColumn(page, vp);
      await expectActionBar(page, vp, "Show my best card");
      await expect(page.getByRole("button", { name: "Change store" })).toBeVisible();
      if (vp.size === "desktop") {
        await expect(
          page.getByRole("heading", { name: "How much are you spending at Shell?" }),
        ).toBeVisible();
        const aside = page.getByRole("region", { name: "Your purchase" });
        await expect(aside.getByText("Comparing 2 cards")).toBeVisible();
        await expect(aside.getByRole("button", { name: "Edit cards" })).toBeVisible();
        const asideBox = await box(aside);
        const panel = await box(page.getByRole("region", { name: "Amount" }));
        expect(asideBox.width).toBeCloseTo(360, 0);
        expect(panel.x).toBeGreaterThan(asideBox.x + asideBox.width);
      }
      expect(await horizontalOverflow(page)).toEqual([]);
      await page.getByRole("button", { name: "Skip" }).click();

      const best = page.getByRole("region", { name: "Best card" });
      await expect(best.getByText("$4.00").first()).toBeVisible();
      await expect(best.getByText("Triangle World Elite Mastercard")).toBeVisible();
      await expect(best.getByText("back on your $100")).toBeVisible();
      await expectColumn(page, vp);
      await expect(actionBar(page)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Change store" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Change amount" })).toBeVisible();
      await expect(page.getByRole("button", { name: "New search" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
      if (vp.size === "phone") {
        await expect(page.getByRole("button", { name: "Change store" })).toHaveText("Store");
      } else {
        await expect(banner.getByRole("button", { name: "New search" })).toBeVisible();
      }
      await expectCardAspect(page);

      if (vp.size === "desktop") {
        await expect(page.getByRole("heading", { name: "Your best card at Shell" })).toBeVisible();
        await expect(best.getByText("How you get $4.00")).toBeVisible();
        await expect(best.getByLabel("Total back: $4.00")).toBeVisible();
        const table = page.getByRole("table", { name: "Compare your cards for this purchase" });
        const rows = table.getByRole("row");
        await expect(rows).toHaveCount(3);
        await expect(rows.nth(1)).toContainText("Triangle World Elite Mastercard");
        await expect(rows.nth(1)).toContainText("Best");
        await expect(rows.nth(1)).toContainText("$4.00");
        await expect(rows.nth(2)).toContainText("Gold American Express");
        await expect(rows.nth(2)).toContainText("1× Scene+ on gas");
        await expect(rows.nth(2)).toContainText("$1.00");
        const tableBox = await box(table);
        const keep = await box(page.getByText("Keep your wallet"));
        expect(keep.x).toBeGreaterThan(tableBox.x + tableBox.width);
      } else {
        await expect(best.getByLabel("Earn rate on gas: 4 pts per $1")).toBeVisible();
        const others = page.getByText("Other cards in your wallet");
        await expect(page.getByLabel("Gold American Express, $1.00 back")).toBeVisible();
        const bestBox = await box(best);
        expect((await box(others)).y).toBeGreaterThan(bestBox.y + bestBox.height);
      }
      await expectNoForbiddenText(page);
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
        expect(sheet.width).toBeCloseTo(vp.size === "tablet" ? 704 : vp.width, 0);
      }
      await dialog.getByRole("button", { name: "Maybe later" }).click();
      await expect(dialog).toBeHidden();
    });
  });
}

test.describe("no horizontal scrolling from 320px to 1920px", () => {
  test("every screen fits at every width", async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto("/");
    await expect(page.getByRole("button", { name: "Get started" })).toBeVisible({
      timeout: 45_000,
    });
    await expectNoOverflowAt(page, OVERFLOW_WIDTHS);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Get started" }).click();
    await expect(page.getByText("Common cards")).toBeVisible();
    await expectNoOverflowAt(page, OVERFLOW_WIDTHS);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("checkbox", { name: TRIANGLE }).click();
    await page.getByRole("checkbox", { name: SCOTIA_GOLD }).click();
    await page.getByRole("button", { name: "Continue with 2 cards" }).click();
    await expect(page.getByRole("button", { name: "Allow location" })).toBeVisible();
    await expectNoOverflowAt(page, OVERFLOW_WIDTHS);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Choose a store instead" }).click();
    await page.getByRole("button", { name: "Gas", exact: true }).click();
    await expect(page.getByText("Top stores for Gas")).toBeVisible();
    await expectNoOverflowAt(page, OVERFLOW_WIDTHS);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: /^Shell,/ }).click();
    await expect(page.getByLabel("Amount in dollars")).toBeVisible();
    await expectNoOverflowAt(page, OVERFLOW_WIDTHS);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByLabel("Best card").getByText("$4.00")).toBeVisible();
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
    const focused = await target
      .evaluate((el) => el === el.ownerDocument.activeElement)
      .catch(() => false);
    if (focused) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

test.describe("keyboard", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("Tab/Enter through the whole flow; the Save dialog traps focus and closes on Escape", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /right card for every purchase/i }),
    ).toBeVisible({ timeout: 45_000 });

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
    await expect(page.getByText("Top stores for Gas")).toBeVisible();
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
      const inside = await dialog.evaluate((el) => el.contains(el.ownerDocument.activeElement));
      expect(inside, `focus left the dialog after ${i + 1} Tab presses`).toBe(true);
    }
    await page.keyboard.press("Shift+Tab");
    expect(await dialog.evaluate((el) => el.contains(el.ownerDocument.activeElement))).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(save).toBeFocused();
  });
});
