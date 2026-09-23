import type { MerchantPartnership } from "../../schema";
import type { CrawlSource, StagingFact } from "../types";
import { htmlToText, makeFact, snippetAround } from "./html";

/** Brands / programs we watch for on Big Six partnership pages. */
const WATCH_TERMS: Array<{ brand: string; pattern: RegExp }> = [
  { brand: "Shell", pattern: /\bShell\b/gi },
  { brand: "Shell Go+", pattern: /\bShell\s*Go\+/gi },
  { brand: "Scene+", pattern: /\bScene\+/gi },
  { brand: "JOURNIE", pattern: /\bJOURNIE\b/gi },
  { brand: "Costco", pattern: /\bCostco\b/gi },
  { brand: "Moi", pattern: /\bMoi\b/gi },
  { brand: "Aeroplan", pattern: /\bAeroplan\b/gi },
  { brand: "AIR MILES", pattern: /\bAIR\s*MILES\b/gi },
  { brand: "WestJet", pattern: /\bWestJet\b/gi },
  { brand: "Metro", pattern: /\bMetro\b/gi },
  { brand: "Sobeys", pattern: /\bSobeys\b/gi },
  { brand: "Pioneer", pattern: /\bPioneer\b/gi },
  { brand: "Ultramar", pattern: /\bUltramar\b/gi },
];

const CENTS_PER_LITRE =
  /(\d+(?:\.\d+)?)\s*(?:¢|cents?)\s*(?:per\s*)?(?:\/?\s*L|per\s*litre|a\s*litre)/gi;

const POINTS_PER_LITRE =
  /(\d+(?:\.\d+)?)\s*(?:Scene\+|points?|pts)\s*(?:per\s*)?(?:\/?\s*L|per\s*litre|a\s*litre)/gi;

/**
 * Extract partnership / loyalty signals from a page.
 * Emits mentions + numeric benefit snippets for later diff against
 * MERCHANT_PARTNERSHIPS (conflicts flagged, never auto-promoted).
 */
export function extractPartnershipFacts(input: {
  source: CrawlSource;
  html: string;
  capturedAt: string;
  partnerships: MerchantPartnership[];
}): StagingFact[] {
  const text = htmlToText(input.html);
  const facts: StagingFact[] = [];
  const seen = new Set<string>();
  const push = (f: StagingFact) => {
    if (seen.has(f.id)) return;
    seen.add(f.id);
    facts.push(f);
  };

  const pageBrand = input.source.brand;

  for (const term of WATCH_TERMS) {
    term.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    let hits = 0;
    while ((match = term.pattern.exec(text)) !== null && hits < 5) {
      hits++;
      push(
        makeFact({
          kind: "partnership_mention",
          issuer: input.source.issuer,
          brand: term.brand,
          subject: pageBrand
            ? `${pageBrand} ↔ ${term.brand}`
            : term.brand,
          rawValue: match[0],
          sourceUrl: input.source.url,
          capturedAt: input.capturedAt,
          context: snippetAround(text, match.index),
        }),
      );
    }
  }

  const benefitPatterns: Array<{ re: RegExp; label: string }> = [
    { re: CENTS_PER_LITRE, label: "cents_per_litre" },
    { re: POINTS_PER_LITRE, label: "points_per_litre" },
  ];

  for (const { re, label } of benefitPatterns) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    let hits = 0;
    while ((match = re.exec(text)) !== null && hits < 20) {
      hits++;
      push(
        makeFact({
          kind: "benefit_amount",
          issuer: input.source.issuer,
          brand: pageBrand,
          subject: `${pageBrand ?? input.source.issuer}:${label}`,
          rawValue: match[0],
          parsedNumber: Number(match[1]),
          sourceUrl: input.source.url,
          capturedAt: input.capturedAt,
          context: snippetAround(text, match.index),
        }),
      );
    }
  }

  // Cross-check: if page cites a sourceUrl already on a partnership, note it
  for (const p of input.partnerships) {
    if (p.sourceUrls.includes(input.source.url)) {
      push(
        makeFact({
          kind: "partnership_mention",
          issuer: input.source.issuer,
          brand: pageBrand,
          subject: p.id,
          rawValue: `known_source_for:${p.id}`,
          sourceUrl: input.source.url,
          capturedAt: input.capturedAt,
          context: `Page is a cited sourceUrl for production partnership ${p.id}`,
        }),
      );
    }
  }

  return facts;
}
