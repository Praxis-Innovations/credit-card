import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { CATEGORY_PAGES } from "./category-pages";
import { buildRobots, buildSitemap } from "./seo-routes";
import { CATEGORY_PAGES_INDEXABLE, SITE_URL } from "./site";

const SITE = "https://northtap.test";
const CATEGORY_URLS = CATEGORY_PAGES.map((page) => `${SITE}${page.path}`);

describe("sitemap", () => {
  it("lists only the home page while category pages are not indexable", () => {
    const urls = buildSitemap({ siteUrl: SITE, categoryPagesIndexable: false }).map(
      (entry) => entry.url,
    );
    expect(urls).toEqual([SITE]);
  });

  it("adds the three category pages once the flag is on", () => {
    const entries = buildSitemap({ siteUrl: SITE, categoryPagesIndexable: true });
    expect(entries.map((entry) => entry.url)).toEqual([SITE, ...CATEGORY_URLS]);
    for (const entry of entries.slice(1)) {
      expect(entry.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("app/sitemap.ts follows CATEGORY_PAGES_INDEXABLE", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls[0]).toBe(SITE_URL);
    const hasCategories = urls.some((url) => /\/(gas|groceries|dining)$/.test(url));
    expect(hasCategories).toBe(CATEGORY_PAGES_INDEXABLE);
  });

  it.runIf(!CATEGORY_PAGES_INDEXABLE)(
    "keeps category pages out while the flag is false (seed data is unverified)",
    () => {
      expect(sitemap().map((entry) => entry.url)).toEqual([SITE_URL]);
    },
  );
});

describe("robots", () => {
  it("allows everything and points at the sitemap", () => {
    expect(buildRobots({ siteUrl: SITE })).toEqual({
      rules: { userAgent: "*", allow: "/" },
      sitemap: `${SITE}/sitemap.xml`,
    });
  });

  it("does not disallow category pages, so crawlers can read their noindex", () => {
    const rules = robots().rules;
    const list = Array.isArray(rules) ? rules : [rules];
    for (const rule of list) {
      expect(rule.disallow).toBeUndefined();
    }
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});
