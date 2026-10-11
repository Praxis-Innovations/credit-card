/**
 * Data and ranking for the hero "Try it" widget: two real Canadian cards on a
 * $100 purchase, points valued at 1¢, so N× earns $N.00.
 */

export type Category = "gas" | "groceries" | "dining";

export type ExampleCardId = "gold" | "tri";

export const CATEGORIES: readonly { id: Category; label: string }[] = [
  { id: "gas", label: "Gas" },
  { id: "groceries", label: "Groceries" },
  { id: "dining", label: "Dining" },
];

export const DEFAULT_CATEGORY: Category = "gas";

export const EXAMPLE_CARDS: Record<
  ExampleCardId,
  { name: string; fullName: string; unit: string }
> = {
  gold: {
    name: "Scotiabank Gold Amex",
    fullName: "Scotiabank Gold American Express",
    unit: "Scene+",
  },
  tri: {
    name: "Triangle World Elite",
    fullName: "Triangle World Elite Mastercard",
    unit: "Triangle Rewards",
  },
};

const RATES: Record<Category, Record<ExampleCardId, number>> = {
  gas: { gold: 1, tri: 4 },
  groceries: { gold: 5, tri: 2 },
  dining: { gold: 3, tri: 1 },
};

export type RankedCard = {
  id: ExampleCardId;
  name: string;
  fullName: string;
  rate: number;
  /** Dollars back on $100, e.g. "$4.00". */
  amount: string;
  /** e.g. "4× Triangle Rewards on gas". */
  why: string;
  /** Shorter why line for phones, e.g. "4× points on gas". */
  whyCompact: string;
  best: boolean;
};

/** Both example cards for a category, highest earner first. */
export function rankCards(category: Category): RankedCard[] {
  const rates = RATES[category];
  return (Object.keys(EXAMPLE_CARDS) as ExampleCardId[])
    .map((id) => ({ id, ...EXAMPLE_CARDS[id], rate: rates[id] }))
    .sort((a, b) => b.rate - a.rate)
    .map((card, index) => ({
      id: card.id,
      name: card.name,
      fullName: card.fullName,
      rate: card.rate,
      amount: `$${card.rate.toFixed(2)}`,
      why: `${card.rate}× ${card.unit} on ${category}`,
      whyCompact: `${card.rate}× points on ${category}`,
      best: index === 0,
    }));
}

/**
 * Radio-group keyboard navigation: the index to select for a key press, or
 * null if the key isn't a navigation key. Arrows wrap around.
 */
export function radioIndexForKey(
  key: string,
  current: number,
  count: number,
): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (current + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
