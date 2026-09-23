import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import type {
  BigSixIssuer,
  CatalogStatus,
  FactKind,
  StagingFact,
} from "../types";

export function factId(parts: {
  kind: FactKind;
  issuer: BigSixIssuer;
  subject: string;
  rawValue: string;
  sourceUrl: string;
}): string {
  const key = [
    parts.kind,
    parts.issuer,
    parts.subject,
    parts.rawValue,
    parts.sourceUrl,
  ].join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

/** Strip scripts/styles and collapse whitespace for pattern matching. */
export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe").remove();
  const text = $("body").text() || $.root().text();
  return text.replace(/\s+/g, " ").trim();
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[®™©]/g, "")
    .replace(/\s+/g, " ")
    .replace(/visa infinite privilege/g, "vip")
    .replace(/world elite/g, "we")
    .trim();
}

/** Loose containment match for catalog card names vs page text. */
export function namesLooselyMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const tokensA = new Set(na.split(" ").filter((t) => t.length > 2));
  const tokensB = new Set(nb.split(" ").filter((t) => t.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return false;
  let overlap = 0;
  for (const t of tokensA) if (tokensB.has(t)) overlap++;
  const minSize = Math.min(tokensA.size, tokensB.size);
  return overlap >= Math.max(2, Math.ceil(minSize * 0.7));
}

export function makeFact(input: {
  kind: FactKind;
  issuer: BigSixIssuer;
  subject: string;
  rawValue: string;
  sourceUrl: string;
  capturedAt: string;
  brand?: string;
  parsedNumber?: number;
  expiresAt?: string;
  status?: CatalogStatus;
  context?: string;
}): StagingFact {
  return {
    id: factId(input),
    kind: input.kind,
    issuer: input.issuer,
    brand: input.brand,
    subject: input.subject,
    rawValue: input.rawValue,
    parsedNumber: input.parsedNumber,
    expiresAt: input.expiresAt,
    sourceUrl: input.sourceUrl,
    capturedAt: input.capturedAt,
    status: input.status ?? "pending",
    context: input.context?.slice(0, 280),
  };
}

export function snippetAround(
  text: string,
  index: number,
  radius = 90,
): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end).trim();
}

/** Fuzzy claim presence: normalize and look for distinctive tokens. */
export function textContainsClaim(pageText: string, claim: string): boolean {
  const page = normalizeName(pageText);
  const needle = normalizeName(claim);
  if (!needle) return false;
  // Numeric / short claims (e.g. "3" for 3¢/L) — require word-ish presence
  if (needle.length <= 2) {
    return (
      page.includes(needle) ||
      new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(needle)}(?:[^a-z0-9]|$)`).test(
        page,
      )
    );
  }
  if (page.includes(needle)) return true;
  const tokens = needle.split(" ").filter((t) => t.length > 2);
  if (tokens.length === 0) return page.includes(needle);
  const hits = tokens.filter((t) => page.includes(t)).length;
  return hits >= Math.ceil(tokens.length * 0.6);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
