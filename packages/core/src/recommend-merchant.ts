import { CARDS, getCardById } from "./cards";
import {
  getLoyaltyProgramById,
  getMerchantBrandById,
  getPartnershipsForBrand,
} from "./partnerships";
import { effectiveEarnRate, recommendCards } from "./recommend";
import type {
  MerchantBrand,
  MerchantPartnership,
  PartnershipBenefit,
  Recommendation,
  RecommendationInput,
} from "./schema";
import { resolveValuations } from "./valuations";

/**
 * Assumed pump price used only to convert ¢/L partnership benefits into an
 * approximate ¢/$ comparable to category earn rates. Not a live price feed.
 */
export const ASSUMED_CAD_PER_LITRE = 1.5;

export interface MerchantRecommendation extends Recommendation {
  /** Catalog brand that drove partnership preference, when any. */
  merchantBrand?: MerchantBrand;
  /** Best partnership applied for this card, when any. */
  partnership?: MerchantPartnership;
  /** Partnership-only contribution in ¢/$, before / after stacking. */
  partnershipCentsPerDollar: number;
  /** True when a partnership benefit replaced or boosted the generic reason. */
  usedPartnership: boolean;
}

export interface RecommendForMerchantInput extends RecommendationInput {
  merchantBrandId: string;
}

function benefitAppliesToCard(
  benefit: PartnershipBenefit,
  cardId: string,
  partnershipCardIds: string[],
): boolean {
  if (!benefit.appliesTo) return true;
  const parts = benefit.appliesTo.split("|").map((p) => p.trim());
  const mentionsCard = parts.some((p) => partnershipCardIds.includes(p));
  if (mentionsCard) return parts.includes(cardId);
  return true;
}

/**
 * Approximate a single partnership benefit as cents-back per dollar spent.
 */
export function benefitToCentsPerDollar(
  benefit: PartnershipBenefit,
  valuations: Record<string, number>,
  assumedCadPerLitre = ASSUMED_CAD_PER_LITRE,
): number {
  const litresPerDollar =
    assumedCadPerLitre > 0 ? 1 / assumedCadPerLitre : 0;

  switch (benefit.kind) {
    case "cents_per_litre_instant":
    case "cents_per_litre_rewards":
      return benefit.amount * litresPerDollar;
    case "points_per_litre": {
      const pv =
        valuations[benefit.pointCurrency ?? ""] ??
        valuations["Scene+"] ??
        0;
      return benefit.amount * pv * litresPerDollar;
    }
    case "points_per_dollar": {
      const pv =
        valuations[benefit.pointCurrency ?? ""] ??
        valuations.cashback ??
        0;
      return benefit.amount * pv;
    }
    case "cashback_percent":
      return benefit.amount;
    default:
      return 0;
  }
}

function formatBenefitShort(benefit: PartnershipBenefit): string {
  switch (benefit.kind) {
    case "cents_per_litre_instant":
    case "cents_per_litre_rewards":
      return `+${formatNum(benefit.amount)}¢/L`;
    case "points_per_litre":
      return `+${formatNum(benefit.amount)} ${benefit.pointCurrency ?? "pts"}/L`;
    case "points_per_dollar":
      return `${formatNum(benefit.amount)}× ${benefit.pointCurrency ?? "pts"}/$`;
    case "cashback_percent":
      return `${formatNum(benefit.amount)}% back`;
    default:
      return benefit.summary;
  }
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}

/**
 * Collapse related ¢/L benefits into a range like "+3–4¢/L" when possible.
 */
export function summarizePartnershipBenefits(
  benefits: PartnershipBenefit[],
): string {
  const cpl = benefits.filter(
    (b) =>
      b.kind === "cents_per_litre_instant" ||
      b.kind === "cents_per_litre_rewards",
  );
  if (cpl.length >= 1) {
    const amounts = cpl.map((b) => b.amount).sort((a, b) => a - b);
    const min = amounts[0]!;
    const max = amounts[amounts.length - 1]!;
    const cplLabel =
      min === max ? `+${formatNum(min)}¢/L` : `+${formatNum(min)}–${formatNum(max)}¢/L`;
    const rest = benefits
      .filter(
        (b) =>
          b.kind !== "cents_per_litre_instant" &&
          b.kind !== "cents_per_litre_rewards",
      )
      .map(formatBenefitShort);
    return [cplLabel, ...rest].join(", ");
  }
  return benefits.map(formatBenefitShort).join(", ");
}

function buildPartnershipReason(
  brand: MerchantBrand,
  cardName: string,
  partnership: MerchantPartnership,
  benefits: PartnershipBenefit[],
): string {
  const program = partnership.loyaltyProgramId
    ? getLoyaltyProgramById(partnership.loyaltyProgramId)
    : undefined;
  const benefitText = summarizePartnershipBenefits(benefits);

  let linkBit = "";
  if (partnership.affiliation === "linked" && program) {
    linkBit = ` linked to ${program.name}`;
  } else if (partnership.affiliation === "affiliated" && program) {
    linkBit = ` with ${program.name}`;
  } else if (partnership.affiliation === "direct") {
    linkBit = "";
  }

  return `${brand.name} — ${cardName}${linkBit} gets ${benefitText}`;
}

function applicableBenefits(
  partnership: MerchantPartnership,
  cardId: string,
): PartnershipBenefit[] {
  return partnership.benefits.filter((b) =>
    benefitAppliesToCard(b, cardId, partnership.cardIds),
  );
}

function partnershipValueForCard(
  partnership: MerchantPartnership,
  cardId: string,
  valuations: Record<string, number>,
): { cents: number; benefits: PartnershipBenefit[] } {
  const benefits = applicableBenefits(partnership, cardId);
  // Sum all applicable benefits (including limited-time ¢/L tiers such as
  // Shell V-Power) so merchant-specific deals compete fairly with generic
  // category earn rates when ranking at a matched brand.
  const cents = benefits.reduce(
    (sum, b) => sum + benefitToCentsPerDollar(b, valuations),
    0,
  );
  return { cents, benefits };
}

function pickBestPartnership(
  brandId: string,
  cardId: string,
  valuations: Record<string, number>,
): {
  partnership: MerchantPartnership;
  cents: number;
  benefits: PartnershipBenefit[];
} | null {
  let best: {
    partnership: MerchantPartnership;
    cents: number;
    benefits: PartnershipBenefit[];
  } | null = null;

  for (const partnership of getPartnershipsForBrand(brandId)) {
    if (!partnership.cardIds.includes(cardId)) continue;
    const { cents, benefits } = partnershipValueForCard(
      partnership,
      cardId,
      valuations,
    );
    if (benefits.length === 0) continue;
    if (!best || cents > best.cents) {
      best = { partnership, cents, benefits };
    }
  }
  return best;
}

/**
 * Rank owned cards for a known merchant brand. Uses category earn rates as the
 * baseline (same as {@link recommendCards}), then prefers a matched partnership
 * benefit — boosting when it stacks, or replacing when it does not.
 */
export function recommendCardsForMerchant(
  input: RecommendForMerchantInput,
): MerchantRecommendation[] {
  const brand = getMerchantBrandById(input.merchantBrandId);
  if (!brand) {
    return recommendCards({ ...input, category: input.category }).map(
      (rec) => ({
        ...rec,
        partnershipCentsPerDollar: 0,
        usedPartnership: false,
      }),
    );
  }

  const valuations = resolveValuations(input.valuations);
  const baseline = recommendCards({
    ...input,
    category: brand.category,
  });

  const owned = new Set(input.ownedCardIds);
  const cards = input.cards ?? CARDS;

  // Ensure every owned card that only has a partnership (no category rate) still appears.
  const byId = new Map(baseline.map((r) => [r.card.id, r]));
  for (const card of cards) {
    if (!owned.has(card.id) || byId.has(card.id)) continue;
    const { earnRate, capExhausted } = effectiveEarnRate(
      card,
      brand.category,
      input.spendToDate,
    );
    const pointValue = valuations[card.pointCurrency] ?? 0;
    byId.set(card.id, {
      card,
      earnRate,
      pointValue,
      centsPerDollar: earnRate * pointValue,
      capExhausted,
      reason: "",
    });
  }

  const results: MerchantRecommendation[] = [];

  for (const base of byId.values()) {
    const picked = pickBestPartnership(brand.id, base.card.id, valuations);
    if (!picked) {
      results.push({
        ...base,
        merchantBrand: brand,
        partnershipCentsPerDollar: 0,
        usedPartnership: false,
        reason:
          base.reason ||
          `${base.card.name} on ${brand.name} (${brand.category})`,
      });
      continue;
    }

    const { partnership, cents: partnershipCents, benefits } = picked;
    const categoryCents = base.centsPerDollar;
    const effectiveCents = partnership.stacksWithCardCategoryRewards
      ? categoryCents + partnershipCents
      : Math.max(categoryCents, partnershipCents);

    const card = getCardById(base.card.id) ?? base.card;
    results.push({
      card,
      earnRate: base.earnRate,
      pointValue: base.pointValue,
      centsPerDollar: effectiveCents,
      capExhausted: base.capExhausted,
      reason: buildPartnershipReason(brand, card.name, partnership, benefits),
      merchantBrand: brand,
      partnership,
      partnershipCentsPerDollar: partnershipCents,
      usedPartnership: true,
    });
  }

  return results.sort((a, b) => {
    if (b.centsPerDollar !== a.centsPerDollar) {
      return b.centsPerDollar - a.centsPerDollar;
    }
    // Prefer partnership-backed picks on ties.
    if (a.usedPartnership !== b.usedPartnership) {
      return a.usedPartnership ? -1 : 1;
    }
    if (a.card.annualFee !== b.card.annualFee) {
      return a.card.annualFee - b.card.annualFee;
    }
    return a.card.name.localeCompare(b.card.name);
  });
}

export function bestCardForMerchant(
  input: RecommendForMerchantInput,
): MerchantRecommendation | null {
  return recommendCardsForMerchant(input)[0] ?? null;
}
