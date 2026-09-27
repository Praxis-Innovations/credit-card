import type { CreditCard } from "./api-types";

/**
 * Card ids shown under "Common cards" on the pick-your-cards screen before
 * the user searches. Hand-picked, widely held Canadian cards that also cover
 * the gas / grocery partnerships the API knows about. This is editorial, not
 * usage data — hence "Common cards" rather than "Popular in Canada".
 *
 * Ids must exist in GET /v1/cards; unknown ids are silently skipped.
 */
export const COMMON_CARD_IDS = [
  "scotia-gold-amex",
  "triangle-we",
  "cibc-costco-mc",
  "scotia-scene-visa",
  "tangerine-moneyback",
  "pc-financial-we",
  "amex-cobalt",
  "td-cash-back-vi",
] as const;

export const COMMON_CARDS_LABEL = "Common cards";

export function pickCommonCards(catalog: CreditCard[]): CreditCard[] {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  return COMMON_CARD_IDS.flatMap((id) => {
    const card = byId.get(id);
    return card ? [card] : [];
  });
}

/** Case-insensitive match on issuer, card name, network and rewards program. */
export function searchCards(
  catalog: CreditCard[],
  query: string,
  programName: (card: CreditCard) => string,
): CreditCard[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return catalog.filter((card) => {
    const haystack = [
      card.issuer,
      card.name,
      card.network ?? "",
      card.pointCurrency,
      programName(card),
    ]
      .join(" ")
      .toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}
