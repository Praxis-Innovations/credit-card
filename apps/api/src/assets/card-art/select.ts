import * as cheerio from "cheerio";
import type { CreditCard } from "@/domain";

export type CandidateOrigin =
  | "img"
  | "og:image"
  | "twitter:image"
  | "preload"
  | "json-ld"
  | "style"
  | "inline";

export interface RawCandidate {
  url: string;
  origin: CandidateOrigin;
  alt?: string;
}

export interface ScoredCandidate extends RawCandidate {
  score: number;
  reasons: string[];
  /**
   * strong = the path names it as card art (card-art folder, "card" in the file
   * name, or the reviewed hint). weak = only name tokens / og:image, so the
   * downloaded image must also look like product art (see `cardEdges`).
   */
  evidence: "strong" | "weak";
}

export interface RejectedCandidate extends RawCandidate {
  rejected: string;
}

export interface SelectContext {
  card: Pick<CreditCard, "id" | "issuer" | "name">;
  /** Names of the issuer's other catalog cards, to penalise their art. */
  siblingNames: string[];
  /** Hosts the image may come from (issuer domains, suffix match). */
  allowedHosts: string[];
  /** Reviewed substring that identifies this card's art on the page. */
  hint?: string;
}

/** Below this, a candidate has no real evidence of being this card's art. */
export const MIN_SCORE = 20;

/** ID-1 cards are 85.60 × 53.98 mm. */
export const CARD_ASPECT = 85.6 / 53.98;
const ASPECT_TOLERANCE = 0.05;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 120;

const HARD_REJECT =
  /(badge|award|winner|best-|logo|icon|favicon|sprite|seal|rating|stars?[-_.]|top[a-z]*(cc|creditcard)[-_]?20\d\d|milesopedia|moneysense|ratehub|nerdwallet|finlywealth|greedyrates|creditcardgenius|apple-?pay|google-?pay|samsung-?pay|app-?store|play-?store|qr-?code|avatar|flag|facebook|twitter|linkedin|instagram|youtube|tiktok|arrow|chevron|spinner|loader|pixel|spacer|1x1)/;
const SOFT_REJECT =
  /(banner|hero|lifestyle|background|[-_/]bg[-_./]|promo|campaign|masthead|family|couple|woman|people|phone|device|header|share|social|og-default|thumbnail|locations?\/|[/_-]ban[-_/])/;
/** Comparison-table and thumbnail renditions of the art. */
const THUMBNAIL = /(comp\d*[-_.]|compare|thumb|[-_]sm[-_.]|small|mini[-_.])/;
/** Explicit card-art naming — strong evidence. */
const CARD_ART_PATH = /(card-?art|card_art|cardart|card-?image|card_image|cardimage|card-?face)/;
/** A generic "cards" folder — weak evidence (many sites file everything under it). */
const CARDS_FOLDER = /\/cards?\//;

/**
 * Product-variant words. When one is in the image path but not in this card's
 * name, the image is probably a sibling product (e.g. "Privilege" art on the
 * plain Visa Infinite page).
 */
const VARIANT_TOKENS = [
  "privilege", "platinum", "gold", "reserve", "business", "student", "students",
  "preferred", "infinite", "world", "elite", "premium", "signature",
];

const GENERIC_TOKENS = new Set([
  "card", "cards", "credit", "visa", "mastercard", "amex", "american",
  "express", "world", "elite", "infinite", "the", "from", "and", "de", "plus",
  "rbc", "td", "cibc", "bmo", "scotia", "scotiabank", "mbna", "pc",
  "neo", "hsbc", "nbc", "desjardins", "rogers", "tangerine", "simplii",
  "financial", "bank", "mc", "vi", "we", "en", "ca", "png", "jpg",
  "jpeg", "webp", "image", "images", "img", "content", "dam", "assets",
  "personal", "banking", "products",
]);

const ALIASES: Record<string, string[]> = {
  vi: ["visa", "infinite"],
  vip: ["visa", "infinite", "privilege"],
  we: ["world", "elite"],
  mc: ["mastercard"],
  iono: ["ion"],
  simplycash: ["simply", "cash"],
  cashback: ["cash", "back"],
  moneyback: ["money", "back"],
  sceneplus: ["scene", "plus"],
};

export function tokenize(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[®™©]/g, "")
    .replace(/\+/g, " plus ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function expand(tokens: string[]): Set<string> {
  const out = new Set<string>();
  for (const t of tokens) {
    out.add(t);
    for (const a of ALIASES[t] ?? []) out.add(a);
  }
  return out;
}

function distinctive(tokens: Iterable<string>): Set<string> {
  return new Set([...tokens].filter((t) => !GENERIC_TOKENS.has(t) && t.length > 1));
}

/**
 * Lower-cased path used for scoring. For an image-optimiser proxy on the
 * issuer's site (Next.js `/_next/image?url=…`) it's the proxied image's path;
 * the request itself still goes to the issuer's host. For an Adobe Experience
 * Manager page rendition (`/content/<page>/_jcr_content/<component>/
 * image.coreimg…/<asset>.png`) it's just the asset's file name: the rest is
 * the page's path, which every image on the page shares. For a DAM rendition
 * it's the asset's path.
 */
export function scoringPath(url: string): string {
  const u = new URL(url);
  if (u.pathname === "/_next/image") {
    const inner = u.searchParams.get("url");
    if (inner) {
      try {
        return decodeURIComponent(new URL(inner, u).pathname).toLowerCase();
      } catch {
        // fall through to the proxy path
      }
    }
  }
  const path = decodeURIComponent(u.pathname).toLowerCase();
  const jcr = path.indexOf("/_jcr_content/");
  if (jcr < 0) return path;
  // DAM rendition: /content/dam/…/<asset>.png/_jcr_content/renditions/cq5dam.web.1280.1280.png
  if (/\.(png|jpe?g|webp)$/.test(path.slice(0, jcr))) return path.slice(0, jcr);
  return path.slice(path.lastIndexOf("/"));
}

/** Tokens of an image URL's path (not host or query), with aliases expanded. */
export function urlTokens(url: string): Set<string> {
  let path: string;
  try {
    path = scoringPath(url);
  } catch {
    path = url;
  }
  const raw = tokenize(path);
  const joined = raw.join("");
  return expand([...raw, ...COMPOUNDS.filter((c) => joined.includes(c))]);
}

/** Product words written both joined and split ("cashback" / "cash-back"). */
const COMPOUNDS = ["simplycash", "cashback", "moneyback", "sceneplus"];

export function hostAllowed(url: string, allowedHosts: string[]): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return allowedHosts.some((d) => host === d || host.endsWith(`.${d}`));
}

function resolve(src: string | undefined, base: string): string | null {
  if (!src) return null;
  const trimmed = src.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return null;
  }
  try {
    const u = new URL(trimmed, base);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/** Largest entry of a srcset (by w / x descriptor). */
export function largestFromSrcset(srcset: string): string | undefined {
  let best: { url: string; size: number } | undefined;
  for (const part of srcset.split(/,\s+(?=\S)/)) {
    const [url, descriptor] = part.trim().split(/\s+/);
    if (!url) continue;
    const size = descriptor ? Number.parseFloat(descriptor) || 1 : 1;
    if (!best || size > best.size) best = { url, size };
  }
  return best?.url;
}

/** Image URLs in scripts / JSON, starting right after a quote, paren, `=`, `,` or space. */
const INLINE_IMAGE_URL =
  /(?<=["'(=,\s])(?:https?:)?(?:\/\/|\/)[^\s"'()<>\\]+?\.(?:png|jpe?g|webp)(?:\?[^\s"'()<>\\]*)?(?=["')\s,&]|$)/gi;

/** `src`-like attributes (including data-cardImg style custom ones). */
const IMAGE_ATTR = /^(src|data-src|data-lazy-src|data-original|data-[\w-]*(img|image|art))$/;
const SRCSET_ATTR = /srcset$/;
/** Custom attributes that label the element, used as alt text. */
const LABEL_ATTR = /^data-[\w-]*(name|title|alt)$/;
const IMAGE_EXT = /\.(png|jpe?g|webp|avif)(\?|$)|\/_next\/image\?|\/dynamicmedia\/deliver\//i;

/**
 * Label text as a reader sees it. Some CMSs double-escape markup into alt
 * text ("Aeroplan&lt;sup&gt;®&lt;/sup&gt; Reserve"), which would otherwise
 * leave "sup" words between the parts of a card name.
 */
function cleanLabel(text: string | undefined): string | undefined {
  const clean = text
    ?.replace(/<[^>]*>/g, " ")
    .replace(/&(nbsp|#160|amp);/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean || undefined;
}

/** Every image reference on the page, resolved to absolute URLs. */
export function extractImageCandidates(html: string, pageUrl: string): RawCandidate[] {
  const $ = cheerio.load(html);
  const base = resolve($("base[href]").attr("href"), pageUrl) ?? pageUrl;
  const out: RawCandidate[] = [];
  const push = (src: string | undefined, origin: CandidateOrigin, alt?: string) => {
    const url = resolve(src, base);
    if (url) out.push({ url, origin, ...(alt ? { alt } : {}) });
  };

  for (const prop of ["og:image", "og:image:secure_url"]) {
    push($(`meta[property="${prop}"]`).attr("content"), "og:image");
  }
  push($('meta[name="twitter:image"]').attr("content"), "twitter:image");

  $("body *").each((_, el) => {
    if (el.type !== "tag") return;
    const tag = el.tagName.toLowerCase();
    if (tag === "script" || tag === "iframe" || tag === "link") return;
    const attribs = el.attribs;
    const isImage = tag === "img" || tag === "source";
    let alt = cleanLabel(attribs.alt) || cleanLabel(attribs.title);
    if (!alt) {
      const label = Object.entries(attribs).find(([name]) => LABEL_ATTR.test(name));
      alt = cleanLabel(label?.[1]);
    }
    if (!alt && tag === "source") alt = cleanLabel($(el).closest("picture").find("img").attr("alt"));
    for (const [name, value] of Object.entries(attribs)) {
      if (SRCSET_ATTR.test(name)) {
        const best = largestFromSrcset(value);
        if (best && (isImage || IMAGE_EXT.test(best))) push(best, "img", alt);
      } else if (IMAGE_ATTR.test(name) && (isImage || IMAGE_EXT.test(value))) {
        push(value, "img", alt);
      }
    }
  });
  $('link[rel="preload"][as="image"]').each((_, el) => {
    push($(el).attr("href"), "preload");
  });
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).text();
    for (const m of text.matchAll(/"image"\s*:\s*"([^"]+)"/g)) push(m[1], "json-ld");
  });
  $("[style*='url(']").each((_, el) => {
    for (const m of ($(el).attr("style") ?? "").matchAll(/url\((['"]?)([^'")]+)\1\)/g)) {
      push(m[2], "style");
    }
  });

  const unescaped = html.replace(/\\u002F/gi, "/").replace(/\\\//g, "/");
  for (const m of unescaped.matchAll(INLINE_IMAGE_URL)) push(m[0], "inline");

  return out;
}

function namesCard(alt: string[], name: string[], isForeign: (t: string | undefined) => boolean): boolean {
  if (name.length === 0) return false;
  for (let i = 0; i + name.length <= alt.length; i++) {
    if (name.every((t, j) => alt[i + j] === t) && !isForeign(alt[i - 1]) && !isForeign(alt[i + name.length])) {
      return true;
    }
  }
  return false;
}

export function scoreCandidate(
  c: RawCandidate,
  ctx: SelectContext,
): ScoredCandidate | RejectedCandidate {
  if (!hostAllowed(c.url, ctx.allowedHosts)) {
    return { ...c, rejected: "host is not an issuer domain" };
  }
  let pathname: string;
  try {
    pathname = scoringPath(c.url);
  } catch {
    return { ...c, rejected: "unparseable URL" };
  }
  if (/[{}]|%7b|%7d/i.test(c.url)) {
    return { ...c, rejected: "URL template, not an image" };
  }
  if (/\.(svg|gif|ico)$/.test(pathname)) {
    return { ...c, rejected: "vector / animated format" };
  }
  const hard = HARD_REJECT.exec(pathname);
  if (hard) return { ...c, rejected: `looks like a ${hard[1]}` };

  const reasons: string[] = [];
  let score = 0;
  const add = (points: number, why: string) => {
    score += points;
    reasons.push(`${points > 0 ? "+" : ""}${points} ${why}`);
  };

  let evidence: ScoredCandidate["evidence"] = "weak";
  if (ctx.hint && pathname.includes(ctx.hint.toLowerCase())) {
    add(100, "matches reviewed hint");
    evidence = "strong";
  }
  if (CARD_ART_PATH.test(pathname)) {
    add(40, "card-art path");
    evidence = "strong";
  } else if (/card/.test(pathname.split("/").pop() ?? "")) {
    add(15, "'card' in file name");
    evidence = "strong";
  } else if (CARDS_FOLDER.test(pathname)) add(10, "cards folder");

  const own = expand([...tokenize(ctx.card.name), ...tokenize(ctx.card.id)]);
  const ownDistinct = distinctive(own);
  const tokens = urlTokens(c.url);
  const altTokens = c.alt ? expand(tokenize(c.alt)) : new Set<string>();

  const matched = [...ownDistinct].filter((t) => tokens.has(t));
  if (matched.length) add(20 * matched.length, `name tokens in path: ${matched.join(", ")}`);
  const variants = VARIANT_TOKENS.filter((t) => own.has(t) && tokens.has(t));
  if (variants.length) add(10 * variants.length, `variant tokens in path: ${variants.join(", ")}`);
  const sibling = new Set([
    ...distinctive(ctx.siblingNames.flatMap((n) => [...expand(tokenize(n))])),
    ...VARIANT_TOKENS,
  ]);
  const isForeign = (t: string | undefined) => !!t && sibling.has(t) && !own.has(t);
  const altForeign = [...altTokens].filter(isForeign);

  // Alt text that spells out the card's name (e.g. data-cardName="TD Rewards
  // Visa* Card" next to data-cardImg) is as good as a card-art path — unless
  // another card's word extends the name: "Business Gold Rewards Card" does
  // not name "Gold Rewards Card", "Aeroplan Visa Infinite" not "Aeroplan Visa".
  const altNamesCard = !!c.alt && namesCard(tokenize(c.alt), tokenize(ctx.card.name), isForeign);
  if (altNamesCard) {
    add(40, "alt names this card");
    evidence = "strong";
  } else {
    const altMatched = [...ownDistinct].filter((t) => altTokens.has(t) && !tokens.has(t));
    if (altMatched.length) add(10 * altMatched.length, `name tokens in alt: ${altMatched.join(", ")}`);
    if (altTokens.has("card")) add(5, "alt mentions card");
  }

  // When the alt names this card, trust it over the file name (TD files the
  // Rewards Visa art as "RewardsTravel_…").
  const foreign = altNamesCard
    ? []
    : [...new Set([...altForeign, ...[...sibling].filter((t) => !own.has(t) && tokens.has(t))])];
  if (foreign.length) add(-40 * foreign.length, `other cards' tokens: ${foreign.join(", ")}`);

  // Tie-breaker between renditions of similar art: "dividend-visa-card-en"
  // over "dividend-visa-card-for-students-en" or "aventura-gold-fr".
  const fileWords = tokenize(pathname.split("/").pop()!.replace(/\.[a-z0-9]+$/, "")).filter(
    (t) => !own.has(t) && !GENERIC_TOKENS.has(t) && !foreign.includes(t) && !/^\d+(x\d+)?$/.test(t),
  );
  if (fileWords.length) {
    add(-3 * Math.min(fileWords.length, 5), `extra words in file name: ${fileWords.join(", ")}`);
  }

  if (c.origin === "og:image" || c.origin === "twitter:image") add(10, c.origin);

  const thumb = THUMBNAIL.exec(pathname.split("/").pop() ?? "");
  if (thumb) add(-10, "looks like a thumbnail rendition");

  const soft = SOFT_REJECT.exec(pathname);
  if (soft) add(-60, `looks like a ${soft[1]}`);

  return { ...c, score, reasons, evidence };
}

/**
 * One key per underlying image: AEM serves the same asset from several
 * components and at several widths (`image.coreimg.80.456.png/<ts>/x.png`).
 */
function imageKey(url: string): string {
  const u = new URL(url);
  const m = /\/_jcr_content\/.*\.coreimg[^/]*\/(\d+\/[^/]+)$/.exec(u.pathname);
  return m ? `${u.host}/aem/${m[1]}` : url;
}

/** Prefer the original AEM rendition over fixed-width ones. */
function isOriginalRendition(url: string): boolean {
  return !/\.coreimg\.\d/.test(url);
}

/** Candidates worth downloading, best first, one per underlying image. */
export function rankCandidates(
  html: string,
  pageUrl: string,
  ctx: SelectContext,
): { ranked: ScoredCandidate[]; rejected: RejectedCandidate[] } {
  const byKey = new Map<string, ScoredCandidate>();
  const rejected: RejectedCandidate[] = [];
  for (const raw of extractImageCandidates(html, pageUrl)) {
    const scored = scoreCandidate(raw, ctx);
    if ("rejected" in scored) {
      rejected.push(scored);
      continue;
    }
    const key = imageKey(scored.url);
    const prev = byKey.get(key);
    if (
      !prev ||
      scored.score > prev.score ||
      (scored.score === prev.score && isOriginalRendition(scored.url) && !isOriginalRendition(prev.url))
    ) {
      byKey.set(key, scored);
    }
  }
  const ranked = [...byKey.values()]
    .filter((c) => c.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);
  return { ranked, rejected };
}

/** Card art must be landscape, close to the ID-1 ratio, and not a thumbnail. */
export function checkCardShape(dim: {
  width: number;
  height: number;
}): { ok: true } | { ok: false; reason: string } {
  const { width, height } = dim;
  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    return { ok: false, reason: `too small (${width}×${height})` };
  }
  const ratio = width / height;
  if (Math.abs(ratio - CARD_ASPECT) / CARD_ASPECT > ASPECT_TOLERANCE) {
    return {
      ok: false,
      reason: `aspect ${ratio.toFixed(2)}:1 is not card-shaped (${width}×${height})`,
    };
  }
  return { ok: true };
}
