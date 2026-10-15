import { canonicalUrl } from "./clean";
import type { CardLink, PageLink } from "./types";

/**
 * `crawl_sources.url_pattern` is an optional extra filter: a path fragment
 * such as `/credit-cards/` (the admin form requires the leading slash) that
 * must appear somewhere in the card page's path. Case-insensitive.
 */
export function matchesUrlPattern(url: string, pattern: string | null | undefined): boolean {
  const p = pattern?.trim();
  if (!p) return true;
  return new URL(url).pathname.toLowerCase().includes(p.toLowerCase());
}

/**
 * Keeps only links Claude picked that were actually offered on the compare
 * page (never a URL the model made up), that pass the source's url_pattern,
 * de-duplicated by canonical URL.
 */
export function acceptDiscoveredLinks(
  picked: CardLink[],
  offered: PageLink[],
  urlPattern: string | null,
): { accepted: CardLink[]; rejected: Array<CardLink & { reason: string }> } {
  const offeredUrls = new Set(offered.map((l) => l.url));
  const seen = new Set<string>();
  const accepted: CardLink[] = [];
  const rejected: Array<CardLink & { reason: string }> = [];
  for (const card of picked) {
    const url = canonicalUrl(card.url);
    if (!url || !offeredUrls.has(url)) {
      rejected.push({ ...card, reason: "not a link on the compare page" });
      continue;
    }
    if (!matchesUrlPattern(url, urlPattern)) {
      rejected.push({ ...card, reason: "outside url_pattern" });
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    accepted.push({ card_name: card.card_name.trim() || url, url });
  }
  return { accepted, rejected };
}

const NETWORK_SEGMENT = /\/(visa|mastercard|master-card|american-express|amex)\//i;
const NON_PRODUCT =
  /(compare|calculator|manage|activate|apply|faq|help|benefits-guide|insurance-certificate|rewards-program|redeem|welcome-kit|supplementary|offers?\.html$|index\.html$)/i;

/**
 * Deterministic stand-in for Claude's link pick, used by `--no-llm` runs so
 * fetching and discovery can be tested without an API key. Card product pages
 * live under a network folder or end in `-card`; hub pages are excluded.
 */
export function heuristicCardLinks(offered: PageLink[], urlPattern: string | null): CardLink[] {
  const out: CardLink[] = [];
  for (const link of offered) {
    if (!matchesUrlPattern(link.url, urlPattern)) continue;
    const path = new URL(link.url).pathname;
    const last = path.split("/").filter(Boolean).pop() ?? "";
    const looksLikeProduct = NETWORK_SEGMENT.test(path) || /-card(\.html?)?$/i.test(last);
    if (!looksLikeProduct || NON_PRODUCT.test(last)) continue;
    out.push({ card_name: labelFromLinkText(link.text) || last, url: link.url });
  }
  return out;
}

const CTA_PREFIX =
  /^(see if it'?s right for you|learn more|find out more|apply now|view details|compare|details)\b[\s:,-]*((for|about|on|to)\s+)?(the\s+)?/i;

/** Best human label among a link's texts, without call-to-action boilerplate. */
export function labelFromLinkText(text: string): string {
  const labels = text
    .split(" / ")
    .map((t) => t.replace(CTA_PREFIX, "").trim())
    .filter(Boolean);
  return labels.sort((a, b) => a.length - b.length)[0] ?? "";
}
