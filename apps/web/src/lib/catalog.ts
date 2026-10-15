/**
 * Static catalog snapshot (src/data/catalog-snapshot.json) and the ranking
 * math the category pages use. The site never calls the API: the snapshot is
 * exported from apps/api/src/domain with `pnpm snapshot:catalog`.
 *
 * The ranking mirrors recommendCards in apps/api/src/domain/recommend.ts
 * (cents back per dollar = earn rate × point value; ties go to the lower
 * annual fee, then the name). catalog-snapshot.test.ts checks both agree.
 */
import snapshot from "@/data/catalog-snapshot.json";

export type CategoryId = "gas" | "groceries" | "dining";

export type SnapshotRewardCategory = {
  category: string;
  earnRate: number;
  capMonthly?: number;
  capAnnual?: number;
};

export type SnapshotCard = {
  id: string;
  issuer: string;
  name: string;
  annualFee: number;
  pointCurrency: string;
  network?: string;
  lastVerified: string;
  rewardCategories: SnapshotRewardCategory[];
};

export type CatalogSnapshot = {
  sources: string[];
  categories: string[];
  valuations: Record<string, number>;
  cards: SnapshotCard[];
};

export const CATALOG: CatalogSnapshot = snapshot;

export type RankedCatalogCard = {
  card: SnapshotCard;
  /** Points (or cash back %) per dollar on the category. */
  earnRate: number;
  /** Cents CAD per point; 1 for cash back. */
  pointValue: number;
  centsPerDollar: number;
  /** The category rate, or undefined when the card falls back to "other". */
  reward: SnapshotRewardCategory | undefined;
};

function findReward(
  card: SnapshotCard,
  category: CategoryId,
): SnapshotRewardCategory | undefined {
  return (
    card.rewardCategories.find((r) => r.category === category) ??
    card.rewardCategories.find((r) => r.category === "other")
  );
}

/** Cards ranked by cents back per dollar for a category, best first. */
export function rankCatalogCards(
  category: CategoryId,
  cards: readonly SnapshotCard[] = CATALOG.cards,
  valuations: Record<string, number> = CATALOG.valuations,
): RankedCatalogCard[] {
  return cards
    .map((card) => {
      const reward = findReward(card, category);
      const earnRate = reward?.earnRate ?? 0;
      const pointValue = valuations[card.pointCurrency] ?? 0;
      return {
        card,
        earnRate,
        pointValue,
        centsPerDollar: earnRate * pointValue,
        reward: reward?.category === category ? reward : undefined,
      };
    })
    .sort((a, b) => {
      if (b.centsPerDollar !== a.centsPerDollar) {
        return b.centsPerDollar - a.centsPerDollar;
      }
      if (a.card.annualFee !== b.card.annualFee) {
        return a.card.annualFee - b.card.annualFee;
      }
      return a.card.name.localeCompare(b.card.name);
    });
}

/** Dollars back on a purchase, rounded to the cent. */
export function dollarsBack(amount: number, centsPerDollar: number): number {
  return Math.round(amount * centsPerDollar) / 100;
}

export function formatDollars(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatAnnualFee(fee: number): string {
  if (fee === 0) return "$0";
  return Number.isInteger(fee) ? `$${fee}` : `$${fee.toFixed(2)}`;
}

/** "Scotiabank Gold American Express", "American Express Cobalt". */
export function cardDisplayName(card: Pick<SnapshotCard, "issuer" | "name">): string {
  return card.name.startsWith(card.issuer)
    ? card.name
    : `${card.issuer} ${card.name}`;
}

export function isCashback(card: Pick<SnapshotCard, "pointCurrency">): boolean {
  return card.pointCurrency === "cashback";
}

/** "5× Amex MR" or "2% cash back". */
export function earnLabel(card: SnapshotCard, earnRate: number): string {
  return isCashback(card)
    ? `${earnRate}% cash back`
    : `${earnRate}× ${card.pointCurrency}`;
}

/** "2.4¢ per point" or "cash" for cash back. */
export function pointValueLabel(card: SnapshotCard, pointValue: number): string {
  return isCashback(card) ? "Cash" : `${pointValue}¢/pt`;
}

/** Oldest lastVerified (ISO date) across cards: every rate was checked on or after it. */
export function oldestLastVerified(cards: readonly SnapshotCard[]): string {
  return cards.reduce(
    (oldest, card) => (card.lastVerified < oldest ? card.lastVerified : oldest),
    cards[0]?.lastVerified ?? "",
  );
}

/** "September 20, 2026" from "2026-09-20", independent of the server's time zone. */
export function formatIsoDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
