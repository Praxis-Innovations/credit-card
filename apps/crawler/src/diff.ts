import type { CheckResult } from "./checks";
import type { CardExtraction } from "./extract/schema";
import type { CatalogCard } from "./types";

export type DiffKind = "new" | "changed" | "unchanged" | "possibly_discontinued";

export interface FieldChange {
  field: string;
  catalog: string | number | null;
  extracted: string | number | null;
  /** The extracted side failed a deterministic check — review before trusting this change. */
  flagged: boolean;
}

export interface DiffResult {
  /** Null when no catalog was available (e.g. dry run without a database). */
  kind: DiffKind | null;
  linked_card_id: string | null;
  match: "linked" | "name" | null;
  changes: FieldChange[];
  note?: string;
}

const FILLER = new Set(["the", "card", "credit", "cards", "®", "™"]);

export function normaliseCardName(name: string, issuer: string): string {
  const issuerWords = new Set(
    [issuer, ...(issuer.toLowerCase() === "scotiabank" ? ["scotia"] : [])]
      .flatMap((w) => w.toLowerCase().split(/\s+/)),
  );
  return name
    .replace(/[®™©℠*†‡]/g, "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\+tm\b/g, "+")
    .replace(/\btm\b/g, "")
    .replace(/american express/g, "amex")
    .replace(/[^a-z0-9+]+/g, " ")
    .split(" ")
    .filter((w) => w && w !== "+" && !FILLER.has(w) && !issuerWords.has(w))
    .join(" ");
}

const NETWORK_TO_CATALOG: Record<string, string> = {
  Visa: "Visa",
  Mastercard: "Mastercard",
  "American Express": "Amex",
};

function isFlagged(checks: CheckResult | null, prefix: string): boolean {
  return !!checks?.fields.some((f) => !f.ok && f.field === prefix);
}

function earnFlagged(checks: CheckResult | null, category: string): boolean {
  return !!checks?.fields.some((f) => !f.ok && f.field.startsWith("earn_rates[") && f.field.endsWith(` ${category}`));
}

function firstNumber(s: string | undefined): number | null {
  const m = s?.match(/(\d{1,3}(?:,\d{3})+|\d+)/);
  return m ? Number(m[1]!.replace(/,/g, "")) : null;
}

export function findCatalogMatch(
  extraction: CardExtraction,
  catalog: CatalogCard[],
  issuer: string,
  linkedCardId: string | null,
): { card: CatalogCard; match: "linked" | "name" } | null {
  if (linkedCardId) {
    const card = catalog.find((c) => c.id === linkedCardId);
    if (card) return { card, match: "linked" };
  }
  const name = extraction.card_name?.value;
  if (!name) return null;
  const key = normaliseCardName(name, issuer);
  const card = catalog.find((c) => normaliseCardName(c.name, issuer) === key);
  return card ? { card, match: "name" } : null;
}

export function compareToCatalog(
  extraction: CardExtraction,
  card: CatalogCard,
  checks: CheckResult | null,
): FieldChange[] {
  const changes: FieldChange[] = [];

  const fee = extraction.annual_fee?.value;
  if (fee !== undefined && Number(card.annual_fee) !== fee) {
    changes.push({ field: "annual_fee", catalog: Number(card.annual_fee), extracted: fee, flagged: isFlagged(checks, "annual_fee") });
  }

  const network = extraction.network ? NETWORK_TO_CATALOG[extraction.network.value] : undefined;
  if (network && card.network !== network) {
    changes.push({ field: "network", catalog: card.network, extracted: network, flagged: isFlagged(checks, "network") });
  }

  // Highest stated rate per category; categories the page does not list earn its base ("other") rate.
  const extracted = new Map<string, number>();
  for (const e of extraction.earn_rates) {
    extracted.set(e.category, Math.max(extracted.get(e.category) ?? 0, e.rate));
  }
  const catalogRates = new Map(card.reward_categories.map((r) => [r.category, Number(r.earnRate)]));
  if (extracted.size > 0) {
    const categories = new Set([...catalogRates.keys(), ...extracted.keys()]);
    for (const category of categories) {
      const page = extracted.get(category) ?? extracted.get("other");
      const cat = catalogRates.get(category) ?? catalogRates.get("other");
      if (page === undefined || cat === undefined || page === cat) continue;
      changes.push({
        field: `earn_rate.${category}`,
        catalog: cat,
        extracted: page,
        flagged: earnFlagged(checks, extracted.has(category) ? category : "other"),
      });
    }
  }

  const bonus = extraction.welcome_bonus?.value.points ?? null;
  const catalogBonus = firstNumber(card.welcome_offer?.summary);
  if (bonus !== null && bonus !== catalogBonus) {
    changes.push({ field: "welcome_bonus.points", catalog: catalogBonus, extracted: bonus, flagged: isFlagged(checks, "welcome_bonus") });
  }

  return changes;
}

export function diffCard(
  extraction: CardExtraction,
  checks: CheckResult | null,
  catalog: CatalogCard[] | null,
  issuer: string,
  linkedCardId: string | null,
): DiffResult {
  if (!catalog) return { kind: null, linked_card_id: linkedCardId, match: null, changes: [], note: "catalog unavailable" };
  const hit = findCatalogMatch(extraction, catalog, issuer, linkedCardId);
  if (!hit) return { kind: "new", linked_card_id: null, match: null, changes: [] };
  const changes = compareToCatalog(extraction, hit.card, checks);
  if (hit.match === "linked" && extraction.card_name && normaliseCardName(extraction.card_name.value, issuer) !== normaliseCardName(hit.card.name, issuer)) {
    changes.unshift({ field: "name", catalog: hit.card.name, extracted: extraction.card_name.value, flagged: isFlagged(checks, "card_name") });
  }
  return {
    kind: changes.length ? "changed" : "unchanged",
    linked_card_id: hit.card.id,
    match: hit.match,
    changes,
  };
}

export type FindingReviewStatus = "pending" | "checked";

/**
 * Review status a finding is stored with. Only new, changed and possibly
 * discontinued cards go to the admin review queue; a card with no changes is
 * recorded as checked. Without a catalog (kind null) a human has to look.
 */
export function reviewStatusFor(kind: DiffKind | null): FindingReviewStatus {
  return kind === "unchanged" ? "checked" : "pending";
}

/** Catalog cards for this issuer that no extracted page matched. */
export function findPossiblyDiscontinued(catalog: CatalogCard[], matchedIds: Set<string>): CatalogCard[] {
  return catalog.filter((c) => !matchedIds.has(c.id));
}
