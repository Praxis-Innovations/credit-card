import { BIG_SIX_SOURCES } from "./sources";
import type { CrawlScope, CrawlSource, SourceKind } from "./types";

const PARTNERSHIP_KINDS: SourceKind[] = ["partnership", "loyalty_program"];
const CARD_KINDS: SourceKind[] = ["card_listing"];

/**
 * Risk-based source selection.
 * - partnerships: bi-weekly (promos / merchant deals drift faster)
 * - cards: monthly (base rates/fees rarely change)
 * - full: both
 */
export function sourcesForScope(scope: CrawlScope): CrawlSource[] {
  return BIG_SIX_SOURCES.filter((s) => {
    const kind = s.kind;
    if (scope === "full") return true;
    if (scope === "partnerships") return PARTNERSHIP_KINDS.includes(kind);
    if (scope === "cards") return CARD_KINDS.includes(kind);
    return true;
  }).map((s) => ({
    ...s,
    cadence: PARTNERSHIP_KINDS.includes(s.kind) ? "biweekly" : "monthly",
  }));
}

/**
 * Default scope from calendar (UTC):
 * - 1st of month → full (cards + partnerships)
 * - 15th → partnerships only (bi-weekly promo pass)
 * - otherwise → partnerships (manual / dispatch fallback)
 */
export function defaultScopeForDate(date: Date = new Date()): CrawlScope {
  const day = date.getUTCDate();
  if (day === 1) return "full";
  if (day === 15) return "partnerships";
  return "partnerships";
}

export function parseScope(raw: string | undefined): CrawlScope {
  if (raw === "cards" || raw === "partnerships" || raw === "full") return raw;
  return defaultScopeForDate();
}
