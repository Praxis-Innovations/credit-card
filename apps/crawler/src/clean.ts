import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { PageLink } from "./types";

const ALWAYS_STRIP = [
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "canvas",
  "iframe",
  "object",
  "embed",
  "img",
  "picture",
  "video",
  "audio",
  "source",
  "link",
  "meta",
  "nav",
  "[role=navigation]",
  "[role=search]",
  "[aria-label*=breadcrumb i]",
  "#onetrust-consent-sdk",
  "#onetrust-banner-sdk",
].join(",");

/**
 * Banner-ish class/id matches. Applied only to elements that do not wrap the
 * main content: feature-detection libraries put classes like `cookies` on <html>.
 */
const BANNERS = [
  "[id*=cookie i]",
  "[class*=cookie i]",
  "[id*=consent i]",
  "[class*=consent i]",
  "[aria-label*=cookie i]",
  "[class*=breadcrumb i]",
  "[class*=skip-link i]",
  "[class*=skip-to i]",
].join(",");

/** Superscript footnote and trademark markers ("points<sup>2</sup>", "Scene+<sup>TM</sup>"). */
const FOOTNOTE_MARK = /^[\s\d,*®™©℠‡†§♢Δ^°+\u00a0]{0,8}$|^\s*(TM|MD|MC|SM)\s*$/;

/** Page chrome; removed only when it sits outside the main content (cards often use <header> for the hero). */
const CHROME = "header, footer, [role=banner], [role=contentinfo]";
const CONTENT_ROOTS = "main, [role=main], article";

const BLOCK_TAGS = new Set([
  "address", "article", "aside", "blockquote", "dd", "details", "dialog", "div", "dl", "dt",
  "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6",
  "header", "hr", "main", "ol", "p", "pre", "section", "summary", "table", "tbody", "thead",
  "tfoot", "ul", "caption", "button", "label",
]);

const SKIP_EXTENSIONS = /\.(pdf|jpe?g|png|gif|webp|svg|ico|mp4|mp3|zip|docx?|xlsx?|pptx?)$/i;

export interface CleanPage {
  title: string;
  text: string;
  /** Same-site links found in the main content (falls back to the whole body if main has none). */
  links: PageLink[];
}

export function cleanPage(html: string, pageUrl: string): CleanPage {
  const $ = cheerio.load(html);
  const title = normaliseInline($("title").first().text());

  $(ALWAYS_STRIP).remove();
  $("sup").each((_, el) => {
    if (FOOTNOTE_MARK.test($(el).text())) $(el).remove();
  });
  $(BANNERS).each((_, el) => {
    const tag = el.type === "tag" ? el.name.toLowerCase() : "";
    if (tag === "html" || tag === "body" || tag === "main") return;
    if ($(el).find(CONTENT_ROOTS).length > 0) return;
    $(el).remove();
  });
  $(CHROME).each((_, el) => {
    if ($(el).closest(CONTENT_ROOTS).length === 0) $(el).remove();
  });

  const main = $("main").length ? $("main").first() : $("[role=main]").first();
  const root = main.length ? main : $("body");

  let links = collectLinks($, root, pageUrl);
  if (links.length === 0 && main.length) links = collectLinks($, $("body"), pageUrl);

  return { title, text: toText(root.toArray()), links };
}

export function cleanText(html: string, pageUrl = "https://example.invalid/"): string {
  return cleanPage(html, pageUrl).text;
}

function toText(nodes: AnyNode[]): string {
  const out: string[] = [];
  const walk = (node: AnyNode) => {
    if (node.type === "text") {
      out.push(node.data);
      return;
    }
    if (node.type !== "tag") return;
    const tag = node.name.toLowerCase();
    if (tag === "br") {
      out.push("\n");
      return;
    }
    const block = BLOCK_TAGS.has(tag);
    if (block) out.push("\n");
    if (tag === "li") out.push("\n- ");
    if (tag === "tr") out.push("\n");
    for (const child of node.children) walk(child);
    if (tag === "td" || tag === "th") out.push(" | ");
    if (block) out.push("\n");
  };
  for (const n of nodes) walk(n);
  return normaliseBlock(out.join(""));
}

function normaliseInline(s: string): string {
  return s.replace(/[\u00a0\u2007\u202f]/g, " ").replace(/[\u200b-\u200d\ufeff]/g, "").replace(/\s+/g, " ").trim();
}

function normaliseBlock(s: string): string {
  const lines = s.split("\n").map((l) => normaliseInline(l).replace(/^\|\s*/, "").replace(/\s*\|$/, ""));
  const kept: string[] = [];
  for (const line of lines) {
    if (line === "" || line === "-") {
      if (kept.length && kept[kept.length - 1] !== "") kept.push("");
      continue;
    }
    // Responsive layouts often render the same block twice; drop adjacent repeats.
    const prev = kept[kept.length - 1] === "" ? kept[kept.length - 2] : kept[kept.length - 1];
    if (line === prev) continue;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

export function sameSite(a: URL, b: URL): boolean {
  const strip = (h: string) => h.toLowerCase().replace(/^www\./, "");
  return strip(a.hostname) === strip(b.hostname);
}

/** Canonical form used for dedupe and DB keys: https, no hash, no tracking params. */
export function canonicalUrl(raw: string, base?: string): string | null {
  let u: URL;
  try {
    u = new URL(raw, base);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  u.hash = "";
  for (const key of [...u.searchParams.keys()]) {
    if (/^(utm_|gclid|fbclid|mc_|icid|cid$)/i.test(key)) u.searchParams.delete(key);
  }
  return u.toString();
}

function collectLinks(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<AnyNode>,
  pageUrl: string,
): PageLink[] {
  const page = new URL(pageUrl);
  const byUrl = new Map<string, Set<string>>();
  root.find("a[href]").each((_, el) => {
    const a = $(el);
    const url = canonicalUrl(a.attr("href") ?? "", pageUrl);
    if (!url) return;
    const u = new URL(url);
    if (!sameSite(u, page) || SKIP_EXTENSIONS.test(u.pathname)) return;
    if (u.pathname === page.pathname && u.search === page.search) return;
    const text = normaliseInline(a.text()) || normaliseInline(a.attr("aria-label") ?? a.attr("title") ?? "");
    const texts = byUrl.get(url) ?? new Set<string>();
    if (text) texts.add(text.slice(0, 120));
    byUrl.set(url, texts);
  });
  return [...byUrl].map(([url, texts]) => ({ url, text: [...texts].slice(0, 4).join(" / ") }));
}
