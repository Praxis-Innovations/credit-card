/** Production URL of the marketing site; override per environment with SITE_URL. */
export const DEFAULT_SITE_URL = "https://northtap.vercel.app";

export const SITE_NAME = "NorthTap";

/**
 * Category pages render unverified seed catalog data, so they stay
 * `noindex,follow` and out of the sitemap until this is flipped to true.
 */
export const CATEGORY_PAGES_INDEXABLE = false;

/** Normalized origin with no trailing slash, e.g. "https://northtap.vercel.app". */
export function resolveSiteUrl(value: string | undefined = process.env.SITE_URL): string {
  const raw = value?.trim() || DEFAULT_SITE_URL;
  try {
    return new URL(raw).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const SITE_URL = resolveSiteUrl();

/**
 * Absolute URL for a site path, e.g. absoluteUrl("/gas"). The home page is the
 * bare origin, matching how Next renders its canonical link.
 */
export function absoluteUrl(path: string, siteUrl: string = SITE_URL): string {
  return path === "/" ? siteUrl : `${siteUrl}${path}`;
}
