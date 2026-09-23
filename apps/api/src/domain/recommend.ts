import { CARDS } from "./cards";
import type {
  Category,
  CreditCard,
  Recommendation,
  RecommendationInput,
  RewardCategory,
  SpendToDate,
} from "./schema";
import { CATEGORY_LABELS } from "./schema";
import { resolveValuations } from "./valuations";

function findReward(
  card: CreditCard,
  category: Category,
): RewardCategory | undefined {
  return (
    card.rewardCategories.find((r) => r.category === category) ??
    card.rewardCategories.find((r) => r.category === "other")
  );
}

/**
 * Effective earn rate after applying optional monthly/annual cap exhaustion.
 * When a cap is fully exhausted, falls back to the card's "other" rate
 * (or 0 if no other rate exists).
 */
export function effectiveEarnRate(
  card: CreditCard,
  category: Category,
  spendToDate?: SpendToDate,
): { earnRate: number; capExhausted: boolean; reward: RewardCategory | undefined } {
  const reward = findReward(card, category);
  if (!reward) {
    return { earnRate: 0, capExhausted: false, reward: undefined };
  }

  const monthlySpend = spendToDate?.monthly?.[category] ?? 0;
  const annualSpend = spendToDate?.annual?.[category] ?? 0;

  const monthlyExhausted =
    reward.capMonthly !== undefined && monthlySpend >= reward.capMonthly;
  const annualExhausted =
    reward.capAnnual !== undefined && annualSpend >= reward.capAnnual;

  if (monthlyExhausted || annualExhausted) {
    const fallback =
      category === "other"
        ? undefined
        : card.rewardCategories.find((r) => r.category === "other");
    return {
      earnRate: fallback?.earnRate ?? 0,
      capExhausted: true,
      reward,
    };
  }

  return { earnRate: reward.earnRate, capExhausted: false, reward };
}

function formatCents(cents: number): string {
  const rounded = Math.round(cents * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

function buildReason(
  card: CreditCard,
  category: Category,
  earnRate: number,
  pointValue: number,
  centsPerDollar: number,
  capExhausted: boolean,
): string {
  const label = CATEGORY_LABELS[category];
  if (capExhausted) {
    return `Bonus cap reached for ${label.toLowerCase()} — falling back to base earn (${formatCents(centsPerDollar)}¢/$)`;
  }
  if (card.pointCurrency === "cashback") {
    return `${earnRate}% cash back on ${label.toLowerCase()}`;
  }
  return `${earnRate}× ${card.pointCurrency} (${pointValue}¢/pt) on ${label.toLowerCase()}`;
}

/**
 * Rank owned cards by cents-back-per-dollar for a spending category.
 * Pure function — no I/O. Cap exhaustion is optional via spendToDate.
 */
export function recommendCards(input: RecommendationInput): Recommendation[] {
  const {
    ownedCardIds,
    category,
    spendToDate,
    valuations: valuationOverrides,
    cards = CARDS,
  } = input;

  const valuations = resolveValuations(valuationOverrides);
  const owned = new Set(ownedCardIds);

  const results: Recommendation[] = [];

  for (const card of cards) {
    if (!owned.has(card.id)) continue;

    const { earnRate, capExhausted } = effectiveEarnRate(
      card,
      category,
      spendToDate,
    );
    const pointValue = valuations[card.pointCurrency] ?? 0;
    const centsPerDollar = earnRate * pointValue;

    results.push({
      card,
      earnRate,
      pointValue,
      centsPerDollar,
      capExhausted,
      reason: buildReason(
        card,
        category,
        earnRate,
        pointValue,
        centsPerDollar,
        capExhausted,
      ),
    });
  }

  return results.sort((a, b) => {
    if (b.centsPerDollar !== a.centsPerDollar) {
      return b.centsPerDollar - a.centsPerDollar;
    }
    // Tie-break: lower annual fee, then name
    if (a.card.annualFee !== b.card.annualFee) {
      return a.card.annualFee - b.card.annualFee;
    }
    return a.card.name.localeCompare(b.card.name);
  });
}

/** Convenience: best single card, or null if none owned. */
export function bestCard(input: RecommendationInput): Recommendation | null {
  return recommendCards(input)[0] ?? null;
}
