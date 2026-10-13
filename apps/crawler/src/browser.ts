import { chromium, type Page } from "playwright";
import { NAV_TIMEOUT_MS, USER_AGENT } from "./config";
import type { PageLoader } from "./fetcher";

const BLOCKED_RESOURCES = new Set(["image", "media", "font"]);

/**
 * Opens collapsed sections ("Rates and fees" accordions, tab panels) inside
 * the main content so lazily rendered text is in the DOM. Never follows a
 * link or submits a form.
 */
async function expandCollapsed(page: Page): Promise<number> {
  return page.evaluate(() => {
    const scope = document.querySelector("main, [role=main]") ?? document.body;
    let opened = 0;
    scope.querySelectorAll("details:not([open])").forEach((d) => {
      (d as HTMLDetailsElement).open = true;
      opened++;
    });
    const targets = scope.querySelectorAll<HTMLElement>(
      '[aria-expanded="false"], [role="tab"][aria-selected="false"]',
    );
    for (const el of Array.from(targets)) {
      if (opened >= 80) break;
      if (el.closest("nav, header, footer, [role=navigation], [role=dialog], form")) continue;
      if (el instanceof HTMLAnchorElement) {
        const href = el.getAttribute("href") ?? "";
        if (href && !href.startsWith("#")) continue;
      }
      if (el instanceof HTMLButtonElement && el.type === "submit") continue;
      try {
        el.click();
        opened++;
      } catch {
        // A widget that throws on click just stays collapsed.
      }
    }
    return opened;
  });
}

const withoutHash = (u: string) => u.split("#")[0];

export async function createPlaywrightLoader(log: (msg: string) => void = () => {}): Promise<PageLoader> {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    throw new Error(
      `Could not start Chromium (${err instanceof Error ? err.message.split("\n")[0] : err}). ` +
        "Install it with: pnpm --filter crawler exec playwright install chromium",
    );
  }
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    locale: "en-CA",
    viewport: { width: 1280, height: 1600 },
    serviceWorkers: "block",
  });
  await context.route("**/*", (route) =>
    BLOCKED_RESOURCES.has(route.request().resourceType()) ? route.abort() : route.continue(),
  );

  return {
    async load(url) {
      const page = await context.newPage();
      try {
        const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
        const status = res?.status() ?? 0;
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        const landed = page.url();
        if (status < 400) {
          const opened = await expandCollapsed(page).catch(() => 0);
          if (opened > 0) {
            await page.waitForTimeout(750);
            await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
            log(`  expanded ${opened} collapsed section(s)`);
          }
          if (withoutHash(page.url()) !== withoutHash(landed)) {
            log(`  expanding navigated away from ${landed}; reloading without expansion`);
            await page.goto(landed, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
          }
        }
        return { status, finalUrl: landed, html: await page.content() };
      } finally {
        await page.close();
      }
    },
    async close() {
      await context.close();
      await browser.close();
    },
  };
}
