import type { CreditCard } from "./api-types";

/** Group catalog cards by issuer for wallet UI display. */
export function groupCardsByIssuer(
  cards: CreditCard[],
): Record<string, CreditCard[]> {
  return cards.reduce<Record<string, CreditCard[]>>((acc, card) => {
    const list = acc[card.issuer] ?? [];
    list.push(card);
    acc[card.issuer] = list;
    return acc;
  }, {});
}
