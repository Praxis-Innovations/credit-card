import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import type { BigSixIssuer, FactKind, StagingFact } from "../types";

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
  // Token overlap: require most significant tokens
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
    sourceUrl: input.sourceUrl,
    capturedAt: input.capturedAt,
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
