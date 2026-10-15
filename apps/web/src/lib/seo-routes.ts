import type { MetadataRoute } from "next";
import { CATALOG } from "@/lib/catalog";
import { CATEGORY_PAGES } from "@/lib/category-pages";
import { CATEGORY_PAGES_INDEXABLE, SITE_URL, absoluteUrl } from "@/lib/site";

/** Indexable pages only: noindex category pages stay out while the flag is off. */
export function buildSitemap({
  siteUrl = SITE_URL,
  categoryPagesIndexable = CATEGORY_PAGES_INDEXABLE,
}: { siteUrl?: string; categoryPagesIndexable?: boolean } = {}): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/", siteUrl),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
  if (categoryPagesIndexable) {
    const lastModified = CATALOG.cards.reduce(
      (newest, card) => (card.lastVerified > newest ? card.lastVerified : newest),
      "",
    );
    for (const page of CATEGORY_PAGES) {
      entries.push({
        url: absoluteUrl(page.path, siteUrl),
        lastModified,
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }
  }
  return entries;
}

/**
 * Category pages are not disallowed here: crawlers must be able to fetch them
 * to see their noindex,follow and follow their links.
 */
export function buildRobots({ siteUrl = SITE_URL }: { siteUrl?: string } = {}): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
