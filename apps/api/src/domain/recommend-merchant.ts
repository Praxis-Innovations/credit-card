import { CARDS } from "./cards";
import {
  getLoyaltyProgramById,
  getMerchantBrandById,
  LOYALTY_PROGRAMS,
  MERCHANT_PARTNERSHIPS,
} from "./partnerships";
import {
  cardEarnComponent,
  effectiveEarnRate,
  recommendCards,
} from "./recommend";
import type {
  FuelGrade,
  LoyaltyProgram,
  MerchantBrand,
  MerchantPartnership,
  PartnershipBenefit,
  PointCurrency,
  Recommendation,
  RecommendationInput,
  ValueComponent,
} from "./schema";
import { resolveValuations } from "./valuations";

/**
 * Assumed pump price used only to convert ¢/L partnership benefits into an
 * approximate ¢/$ comparable to category earn rates. Not a live price feed.
 */
export const ASSUMED_CAD_PER_LITRE = 1.5;

export const DEFAULT_FUEL_GRADE: FuelGrade = "regular";

/**
 * `appliesTo` scopes that restrict a benefit to one fuel grade. Scopes not
 * listed here (e.g. `all_fuel`) apply to every grade. Keep in sync with
 * grade-specific benefits in the partnership catalog.
 */
export const FUEL_GRADE_SCOPES: Readonly<Record<string, FuelGrade>> = {
  regular_fuel: "regular",
  premium_fuel: "premium",
  premium_fuel_pc_mastercard: "premium",
  shell_vpower: "premium",
};

/**
 * Optional override for merchant / loyalty / partnership lookups.
 * When omitted, uses the built-in static catalogs.
 */
export interface PartnershipCatalog {
  brands?: MerchantBrand[];
  partnerships?: MerchantPartnership[];
  loyaltyPrograms?: LoyaltyProgram[];
}

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
  /** Grade being pumped; grade-scoped benefits only apply to a match. Defaults to regular. */
  fuelGrade?: FuelGrade;
  /** Inject Supabase / API-backed catalogs instead of static seed data. */
  catalog?: PartnershipCatalog;
}

function resolveBrand(
  id: string,
  catalog?: PartnershipCatalog,
): MerchantBrand | undefined {
  if (catalog?.brands) {
    return catalog.brands.find((b) => b.id === id);
  }
  return getMerchantBrandById(id);
}

function resolvePartnershipsForBrand(
  brandId: string,
  catalog?: PartnershipCatalog,
): MerchantPartnership[] {
  const list = catalog?.partnerships ?? MERCHANT_PARTNERSHIPS;
  return list.filter((p) => p.merchantBrandIds.includes(brandId));
}

function resolveLoyaltyProgram(
  id: string,
  catalog?: PartnershipCatalog,
): LoyaltyProgram | undefined {
  if (catalog?.loyaltyPrograms) {
    return catalog.loyaltyPrograms.find((p) => p.id === id);
  }
  return getLoyaltyProgramById(id) ?? LOYALTY_PROGRAMS.find((p) => p.id === id);
}

/**
 * Whether a benefit applies to this card and fuel grade. `appliesTo` parts
 * naming partnership card ids restrict the card; parts listed in
 * {@link FUEL_GRADE_SCOPES} restrict the grade. Other scopes always apply.
 */
export function isBenefitApplicable(
  benefit: PartnershipBenefit,
  cardId: string,
  partnershipCardIds: string[],
  fuelGrade: FuelGrade = DEFAULT_FUEL_GRADE,
): boolean {
  if (!benefit.appliesTo) return true;
  const parts = benefit.appliesTo.split("|").map((p) => p.trim());
  const mentionsCard = parts.some((p) => partnershipCardIds.includes(p));
  if (mentionsCard && !parts.includes(cardId)) return false;
  const grades = parts.flatMap((p) => {
    const grade = FUEL_GRADE_SCOPES[p];
    return grade ? [grade] : [];
  });
  if (grades.length > 0 && !grades.includes(fuelGrade)) return false;
  return true;
}

/**
 * Point currency and ¢/pt used to value a point-denominated benefit, or
 * undefined for benefits already denominated in cents / percent.
 */
export function benefitValuation(
  benefit: PartnershipBenefit,
  valuations: Record<string, number>,
): { currency: PointCurrency; centsPerPoint: number } | undefined {
  let fallback: PointCurrency;
  switch (benefit.kind) {
    case "points_per_litre":
      fallback = "Scene+";
      break;
    case "points_per_dollar":
      fallback = "cashback";
      break;
    default:
      return undefined;
  }
  const own = benefit.pointCurrency;
  if (own && valuations[own] !== undefined) {
    return { currency: own, centsPerPoint: valuations[own] };
  }
  return {
    currency: valuations[fallback] !== undefined ? fallback : (own ?? fallback),
    centsPerPoint: valuations[fallback] ?? 0,
  };
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
  const pv = benefitValuation(benefit, valuations)?.centsPerPoint ?? 0;

  switch (benefit.kind) {
    case "cents_per_litre_instant":
    case "cents_per_litre_rewards":
      return benefit.amount * litresPerDollar;
    case "points_per_litre":
      return benefit.amount * pv * litresPerDollar;
    case "points_per_dollar":
      return benefit.amount * pv;
    case "cashback_percent":
      return benefit.amount;
    default:
      return 0;
  }
}

function benefitComponent(
  partnership: MerchantPartnership,
  benefit: PartnershipBenefit,
  valuations: Record<string, number>,
): ValueComponent {
  const valuation = benefitValuation(benefit, valuations);
  return {
    label: benefit.summary,
    kind: benefit.kind,
    centsPerDollar: benefitToCentsPerDollar(benefit, valuations),
    partnershipId: partnership.id,
    benefit,
    ...(valuation ? { valuation } : {}),
  };
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
  catalog?: PartnershipCatalog,
): string {
  const program = partnership.loyaltyProgramId
    ? resolveLoyaltyProgram(partnership.loyaltyProgramId, catalog)
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
  fuelGrade: FuelGrade,
): PartnershipBenefit[] {
  return partnership.benefits.filter((b) =>
    isBenefitApplicable(b, cardId, partnership.cardIds, fuelGrade),
  );
}

interface PartnershipValue {
  partnership: MerchantPartnership;
  cents: number;
  benefits: PartnershipBenefit[];
  components: ValueComponent[];
}

function partnershipValueForCard(
  partnership: MerchantPartnership,
  cardId: string,
  valuations: Record<string, number>,
  fuelGrade: FuelGrade,
): PartnershipValue {
  const benefits = applicableBenefits(partnership, cardId, fuelGrade);
  const components = benefits.map((b) =>
    benefitComponent(partnership, b, valuations),
  );
  const cents = components.reduce((sum, c) => sum + c.centsPerDollar, 0);
  return { partnership, cents, benefits, components };
}

function pickBestPartnership(
  brandId: string,
  cardId: string,
  valuations: Record<string, number>,
  fuelGrade: FuelGrade,
  catalog?: PartnershipCatalog,
): PartnershipValue | null {
  let best: PartnershipValue | null = null;

  for (const partnership of resolvePartnershipsForBrand(brandId, catalog)) {
    if (!partnership.cardIds.includes(cardId)) continue;
    const value = partnershipValueForCard(
      partnership,
      cardId,
      valuations,
      fuelGrade,
    );
    if (value.benefits.length === 0) continue;
    if (!best || value.cents > best.cents) {
      best = value;
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
  const catalog = input.catalog;
  const brand = resolveBrand(input.merchantBrandId, catalog);
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
  const fuelGrade = input.fuelGrade ?? DEFAULT_FUEL_GRADE;
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
      valueComponents: [
        cardEarnComponent(
          card,
          brand.category,
          earnRate,
          pointValue,
          capExhausted,
        ),
      ],
    });
  }

  const results: MerchantRecommendation[] = [];

  for (const base of byId.values()) {
    const picked = pickBestPartnership(
      brand.id,
      base.card.id,
      valuations,
      fuelGrade,
      catalog,
    );
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

    const {
      partnership,
      cents: partnershipCents,
      benefits,
      components: partnershipComponents,
    } = picked;
    const categoryCents = base.centsPerDollar;
    let effectiveCents: number;
    let valueComponents: ValueComponent[];
    if (partnership.stacksWithCardCategoryRewards) {
      effectiveCents = categoryCents + partnershipCents;
      valueComponents = [...base.valueComponents, ...partnershipComponents];
    } else if (partnershipCents > categoryCents) {
      effectiveCents = partnershipCents;
      valueComponents = partnershipComponents;
    } else {
      effectiveCents = categoryCents;
      valueComponents = base.valueComponents;
    }

    const card =
      cards.find((c) => c.id === base.card.id) ?? base.card;
    results.push({
      card,
      earnRate: base.earnRate,
      pointValue: base.pointValue,
      centsPerDollar: effectiveCents,
      capExhausted: base.capExhausted,
      reason: buildPartnershipReason(
        brand,
        card.name,
        partnership,
        benefits,
        catalog,
      ),
      valueComponents,
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
