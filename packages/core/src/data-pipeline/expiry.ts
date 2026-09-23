import type { BigSixIssuer, StagingFact } from "./types";
import { makeFact, snippetAround } from "./extract/html";

const EXPIRY_PATTERNS: RegExp[] = [
  /(?:offer|promotion|promo)?\s*(?:valid|ends?|expires?|until|through)\s*(?:on\s*)?([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})/gi,
  /promotional\s+period\s+ends?\s*(?:on\s*)?([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})/gi,
  /until\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/gi,
];

/** Days before expiry to surface an expiry_review_due finding. */
export const EXPIRY_REVIEW_LEAD_DAYS = 14;

export function parseLooseDate(raw: string, now = new Date()): string | undefined {
  const trimmed = raw.trim().replace(/,/g, "");
  const iso = /^\d{4}-\d{2}-\d{2}$/.exec(trimmed);
  if (iso) return trimmed;

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }

  // "25 November 2026" style already handled by Date.parse in most engines;
  // try swapping day-month if needed.
  const dmy = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(trimmed);
  if (dmy) {
    const alt = Date.parse(`${dmy[2]} ${dmy[1]}, ${dmy[3]}`);
    if (!Number.isNaN(alt)) return new Date(alt).toISOString().slice(0, 10);
  }

  // Avoid inventing dates in the far past/future relative to now without parse.
  void now;
  return undefined;
}

/**
 * Extract promotional / offer expiry dates from page text as staging facts.
 */
export function extractExpiryFacts(input: {
  text: string;
  issuer: BigSixIssuer;
  sourceUrl: string;
  capturedAt: string;
  brand?: string;
  subject?: string;
}): StagingFact[] {
  const facts: StagingFact[] = [];
  const seen = new Set<string>();

  for (const re of EXPIRY_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(input.text)) !== null) {
      const dateRaw = m[1];
      if (!dateRaw) continue;
      const expiresAt = parseLooseDate(dateRaw);
      if (!expiresAt) continue;
      const key = `${expiresAt}|${m[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);

      facts.push(
        makeFact({
          kind: "offer_expiry",
          issuer: input.issuer,
          brand: input.brand,
          subject: input.subject ?? input.brand ?? input.issuer,
          rawValue: m[0].trim(),
          expiresAt,
          sourceUrl: input.sourceUrl,
          capturedAt: input.capturedAt,
          context: snippetAround(input.text, m.index),
        }),
      );
    }
  }

  return facts;
}

export function isExpiryReviewDue(
  expiresAt: string,
  now = new Date(),
  leadDays = EXPIRY_REVIEW_LEAD_DAYS,
): boolean {
  const end = Date.parse(expiresAt);
  if (Number.isNaN(end)) return false;
  const msLead = leadDays * 24 * 60 * 60 * 1000;
  const delta = end - now.getTime();
  return delta <= msLead && delta >= -msLead; // due soon or just expired
}
