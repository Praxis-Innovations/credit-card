import { CARDS } from "./cards";
import {
  ASSUMED_CAD_PER_LITRE,
  DEFAULT_FUEL_GRADE,
  recommendCardsForMerchant,
  type PartnershipCatalog,
} from "./recommend-merchant";
import {
  cardEarnComponent,
  effectiveEarnRate,
  recommendCards,
} from "./recommend";
import type {
  AcceptedNetwork,
  Category,
  CreditCard,
  FuelGrade,
  MccCertainty,
  MerchantBrand,
  PointCurrency,
  Recommendation,
  RewardCategory,
  SpendToDate,
  ValueComponent,
} from "./schema";
import { CATEGORIES, CATEGORY_LABELS } from "./schema";
import { resolveValuations } from "./valuations";
import { buildValueBreakdown } from "./value-breakdown";

/** How the store's MCC (or fallback) was resolved for this purchase. */
export type MccMatchKind =
  | "named_merchant"
  | "mcc_list"
  | "category_default"
  | "store_type_estimate"
  | "user_category"
  | "base_rate"
  | "network_not_accepted";

export type RecommendationWarningKind =
  | "welcome_bonus"
  | "user_chosen_category"
  | "certainty"
  | "network_not_accepted"
  | "cap_assumed_not_reached"
  | "tier_assumed_not_reached"
  | "exclusion";

export interface RecommendationWarning {
  kind: RecommendationWarningKind;
  message: string;
}

export interface CategoryMccRow {
  category: Category;
  mcc: string;
}

export interface StoreTypeMccRow {
  osmTag: string;
  mcc: string;
}

export interface MccCatalog {
  categoryMccs?: CategoryMccRow[];
  storeTypeMccs?: StoreTypeMccRow[];
}

export interface StoreInput {
  /** Catalog brand id when already resolved. */
  brandId?: string;
  /** Free-text / OSM query resolved server-side. */
  merchantQuery?: string;
  /** Explicit MCC from the client (e.g. known from a prior purchase). */
  mcc?: string;
  /** OSM tag for store-type fallback (e.g. `shop=supermarket`). */
  osmTag?: string;
  /** Display name override. */
  name?: string;
}

export interface MccRecommendationInput {
  amountCad: number;
  ownedCardIds: string[];
  store?: StoreInput;
  /** Explicit MCC when no store is known. */
  mcc?: string;
  /**
   * User-picked display category. Used only as a fallback when store code and
   * store-type estimate are unknown; never counts as a Tangerine-style chosen
   * bonus (those are warnings only).
   */
  categoryFallback?: Category;
  fuelGrade?: FuelGrade;
  spendToDate?: SpendToDate;
  /** Cap-group spend already applied (CAD), keyed by capGroup id. */
  capGroupSpendToDate?: Record<string, number>;
  /** Annual spend toward tier thresholds (CAD), keyed by card id. */
  annualSpendByCard?: Record<string, number>;
  valuations?: Partial<Record<PointCurrency, number>>;
  cards?: CreditCard[];
  brands?: MerchantBrand[];
  catalog?: PartnershipCatalog;
  mccCatalog?: MccCatalog;
  /** ISO date for dated-offer validity; defaults to today. */
  asOf?: string;
  limit?: number;
}

export interface MccCardRecommendation {
  card: CreditCard;
  earnRate: number;
  pointValue: number;
  centsPerDollar: number;
  estimatedCentsBack: number;
  estimatedRewardCad: number;
  capExhausted: boolean;
  reason: string;
  matchKind: MccMatchKind;
  confidence: MccCertainty;
  matchedRule?: RewardCategory;
  effectiveMcc: string | null;
  displayCategory: Category;
  warnings: RecommendationWarning[];
  usedPartnership: boolean;
  partnershipId?: string;
  valueComponents: ValueComponent[];
}

export interface MccRecommendationResult {
  purchase: {
    amountCad: number;
    mcc: string | null;
    displayCategory: Category;
    merchant: string | null;
    merchantBrandId: string | null;
    certainty: MccCertainty;
    matchKind: MccMatchKind;
    fuelGrade: FuelGrade | null;
  };
  recommendations: MccCardRecommendation[];
  bestCardId: string | null;
  warnings: RecommendationWarning[];
}

function networkKey(network: CreditCard["network"]): AcceptedNetwork | null {
  if (network === "Visa") return "visa";
  if (network === "Mastercard") return "mastercard";
  if (network === "Amex") return "amex";
  return null;
}

function brandMccForNetwork(
  brand: MerchantBrand,
  network: CreditCard["network"],
): string | null {
  if (network === "Amex" && brand.amexMcc) return brand.amexMcc;
  return brand.mcc ?? null;
}

/** Rules marked user-chosen (Tangerine) must not drive dollars — warning only. */
function usableRules(card: CreditCard): RewardCategory[] {
  return card.rewardCategories.filter((r) => !r.userChosen);
}

function ruleIsActive(rule: RewardCategory, asOf: string): boolean {
  if (rule.validFrom && asOf < rule.validFrom) return false;
  if (rule.validTo && asOf > rule.validTo) return false;
  return true;
}

function merchantMatches(
  rule: RewardCategory,
  brand: MerchantBrand | null,
): boolean {
  if (!brand || !rule.merchants?.length) return false;
  const ids = new Set(rule.merchants.map((m) => m.toLowerCase()));
  return ids.has(brand.id.toLowerCase()) || ids.has(brand.name.toLowerCase());
}

function mccMatches(rule: RewardCategory, mcc: string | null): boolean {
  if (!mcc || !rule.mccs?.length) return false;
  return rule.mccs.includes(mcc);
}

function isExcluded(
  rule: RewardCategory,
  brand: MerchantBrand | null,
  mcc: string | null,
): boolean {
  if (!rule.exclusions?.length) return false;
  const ex = rule.exclusions.map((e) => e.toLowerCase());
  if (brand && (ex.includes(brand.id.toLowerCase()) || ex.includes(brand.name.toLowerCase()))) {
    return true;
  }
  if (mcc && ex.includes(mcc)) return true;
  return false;
}

function categoryForMcc(
  mcc: string | null,
  mccCatalog: MccCatalog | undefined,
  brand: MerchantBrand | null,
  fallback?: Category,
): Category {
  if (brand?.category) return brand.category;
  if (mcc && mccCatalog?.categoryMccs) {
    const hit = mccCatalog.categoryMccs.find((r) => r.mcc === mcc);
    if (hit) return hit.category;
  }
  return fallback ?? "other";
}

export interface ResolvedStoreCode {
  mcc: string | null;
  brand: MerchantBrand | null;
  certainty: MccCertainty;
  matchKind: MccMatchKind;
  displayCategory: Category;
  warnings: RecommendationWarning[];
}

/**
 * Resolve the purchase MCC: approved store code → store-type estimate →
 * user-picked category → unknown (base rate).
 */
export function resolveStoreCode(
  input: Pick<MccRecommendationInput, "store" | "mcc" | "categoryFallback" | "brands" | "mccCatalog">,
  forNetwork?: CreditCard["network"],
): ResolvedStoreCode {
  const brands = input.brands ?? [];
  const warnings: RecommendationWarning[] = [];
  let brand: MerchantBrand | null = null;

  if (input.store?.brandId) {
    brand = brands.find((b) => b.id === input.store!.brandId) ?? null;
  }

  const explicitMcc = input.store?.mcc ?? input.mcc ?? null;

  if (brand) {
    const code = forNetwork
      ? brandMccForNetwork(brand, forNetwork)
      : (brand.mcc ?? null);
    const certainty = brand.certainty ?? (code ? "confirmed" : "unknown");
    if (
      certainty === "varies_by_store" ||
      certainty === "varies_by_network" ||
      certainty === "varies_by_product" ||
      certainty === "estimate" ||
      certainty === "category_only" ||
      certainty === "unknown"
    ) {
      if (code || certainty !== "unknown") {
        warnings.push({
          kind: "certainty",
          message: `Store code certainty is ${certainty.replaceAll("_", " ")}`,
        });
      }
    }
    if (code) {
      return {
        mcc: code,
        brand,
        certainty,
        matchKind: "named_merchant",
        displayCategory: brand.category,
        warnings,
      };
    }
    // Brand known but no approved code yet — fall through.
  }

  if (explicitMcc) {
    return {
      mcc: explicitMcc,
      brand,
      certainty: "confirmed",
      matchKind: "mcc_list",
      displayCategory: categoryForMcc(
        explicitMcc,
        input.mccCatalog,
        brand,
        input.categoryFallback,
      ),
      warnings,
    };
  }

  const osmTag = input.store?.osmTag;
  if (osmTag && input.mccCatalog?.storeTypeMccs) {
    const hit = input.mccCatalog.storeTypeMccs.find((r) => r.osmTag === osmTag);
    if (hit) {
      warnings.push({
        kind: "certainty",
        message: "Using store-type MCC estimate (no approved brand code)",
      });
      return {
        mcc: hit.mcc,
        brand,
        certainty: "estimate",
        matchKind: "store_type_estimate",
        displayCategory: categoryForMcc(
          hit.mcc,
          input.mccCatalog,
          brand,
          input.categoryFallback,
        ),
        warnings,
      };
    }
  }

  if (input.categoryFallback) {
    warnings.push({
      kind: "user_chosen_category",
      message: `No store code — using category ${CATEGORY_LABELS[input.categoryFallback]} as fallback`,
    });
    return {
      mcc: null,
      brand,
      certainty: "unknown",
      matchKind: "user_category",
      displayCategory: input.categoryFallback,
      warnings,
    };
  }

  return {
    mcc: null,
    brand,
    certainty: "unknown",
    matchKind: "base_rate",
    displayCategory: brand?.category ?? "other",
    warnings,
  };
}

function pickEarnRule(
  card: CreditCard,
  brand: MerchantBrand | null,
  mcc: string | null,
  displayCategory: Category,
  asOf: string,
): { rule: RewardCategory; matchKind: MccMatchKind; warnings: RecommendationWarning[] } {
  const warnings: RecommendationWarning[] = [];
  const rules = usableRules(card).filter((r) => ruleIsActive(r, asOf));

  // User-chosen category rules on this card → warning only (never dollars).
  for (const r of card.rewardCategories) {
    if (r.userChosen) {
      warnings.push({
        kind: "user_chosen_category",
        message: `${card.name}: user-chosen ${CATEGORY_LABELS[r.category]} bonus is not used in the calculation`,
      });
    }
  }

  const named = rules.find(
    (r) => merchantMatches(r, brand) && !isExcluded(r, brand, mcc),
  );
  if (named) {
    return { rule: named, matchKind: "named_merchant", warnings };
  }

  const byMcc = rules.find(
    (r) => mccMatches(r, mcc) && !isExcluded(r, brand, mcc),
  );
  if (byMcc) {
    return { rule: byMcc, matchKind: "mcc_list", warnings };
  }

  // Category default: rule for display category that has no merchant/MCC gate,
  // or whose mccs come from network_default for this category.
  const byCategory = rules.find((r) => {
    if (r.category !== displayCategory) return false;
    if (isExcluded(r, brand, mcc)) return false;
    if (r.merchants?.length) return false;
    if (r.mccs?.length && mcc && !r.mccs.includes(mcc)) return false;
    return true;
  });
  if (byCategory) {
    if (byCategory.category === "other") {
      return { rule: byCategory, matchKind: "base_rate", warnings };
    }
    const kind: MccMatchKind =
      byCategory.mccSource === "network_default" || byCategory.mccs?.length || mcc
        ? "category_default"
        : "user_category";
    return { rule: byCategory, matchKind: kind, warnings };
  }

  const base =
    rules.find((r) => r.category === "other") ??
    ({ category: "other", earnRate: 0 } satisfies RewardCategory);
  return { rule: base, matchKind: "base_rate", warnings };
}

function applyCapAndTier(
  card: CreditCard,
  rule: RewardCategory,
  displayCategory: Category,
  spendToDate: SpendToDate | undefined,
  capGroupSpend: Record<string, number> | undefined,
  annualSpendByCard: Record<string, number> | undefined,
): { earnRate: number; capExhausted: boolean; warnings: RecommendationWarning[] } {
  const warnings: RecommendationWarning[] = [];

  if (rule.tierThreshold !== undefined) {
    const spent = annualSpendByCard?.[card.id] ?? 0;
    if (spent < rule.tierThreshold) {
      warnings.push({
        kind: "tier_assumed_not_reached",
        message: `${card.name}: spend tier $${rule.tierThreshold} not reached — using lower/base rate path`,
      });
      // Tier not reached: fall back to other / rate without this tier.
      const fallback =
        card.rewardCategories.find((r) => r.category === "other") ??
        ({ category: "other", earnRate: 0 } satisfies RewardCategory);
      return {
        earnRate: fallback.earnRate,
        capExhausted: false,
        warnings,
      };
    }
  }

  if (rule.capGroup) {
    const spent = capGroupSpend?.[rule.capGroup] ?? 0;
    const cap = rule.capMonthly ?? rule.capAnnual;
    if (cap !== undefined && spent >= cap) {
      const after = rule.rateAfterCap;
      if (after !== undefined) {
        return { earnRate: after, capExhausted: true, warnings };
      }
      const fallback = effectiveEarnRate(card, "other", spendToDate);
      return { earnRate: fallback.earnRate, capExhausted: true, warnings };
    }
    if (cap !== undefined && spent === 0) {
      warnings.push({
        kind: "cap_assumed_not_reached",
        message: `${card.name}: shared cap assumed not reached`,
      });
    }
    return { earnRate: rule.earnRate, capExhausted: false, warnings };
  }

  // Per-category caps via existing helper (maps spendToDate.monthly[category]).
  const { earnRate, capExhausted } = effectiveEarnRate(
    card,
    displayCategory,
    spendToDate,
  );
  // Prefer the matched rule's rate when the category lookup would miss MCC-only rules.
  if (!capExhausted && rule.earnRate !== earnRate && rule.category === displayCategory) {
    return { earnRate: rule.earnRate, capExhausted: false, warnings };
  }
  if (!capExhausted) {
    // When we matched by merchant/MCC, use that rule's rate directly.
    return { earnRate: rule.earnRate, capExhausted: false, warnings };
  }
  if (rule.rateAfterCap !== undefined) {
    return { earnRate: rule.rateAfterCap, capExhausted: true, warnings };
  }
  return { earnRate, capExhausted, warnings };
}

function welcomeWarning(card: CreditCard): RecommendationWarning | null {
  if (!card.welcomeOffer) return null;
  return {
    kind: "welcome_bonus",
    message: `Welcome bonus not included: ${card.welcomeOffer.summary}`,
  };
}

/**
 * Rank owned cards for a store + amount using MCC-aware earn rules.
 * Caps/tiers are assumed not reached unless spend inputs say otherwise.
 * Welcome bonuses and user-chosen categories are warnings only.
 */
export function recommendByMcc(
  input: MccRecommendationInput,
): MccRecommendationResult {
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const cards = input.cards ?? CARDS;
  const brands = input.brands ?? [];
  const valuations = resolveValuations(input.valuations);
  const fuelGrade = input.fuelGrade ?? DEFAULT_FUEL_GRADE;
  const owned = new Set(input.ownedCardIds);

  const resolved = resolveStoreCode(input);
  const purchaseWarnings = [...resolved.warnings];

  const results: MccCardRecommendation[] = [];

  for (const card of cards) {
    if (!owned.has(card.id)) continue;

    const cardWarnings: RecommendationWarning[] = [];
    const welcome = welcomeWarning(card);
    if (welcome) cardWarnings.push(welcome);

    // Network accepted?
    const net = networkKey(card.network);
    if (
      resolved.brand?.acceptedNetworks?.length &&
      net &&
      !resolved.brand.acceptedNetworks.includes(net)
    ) {
      cardWarnings.push({
        kind: "network_not_accepted",
        message: `${resolved.brand.name} does not accept ${card.network}`,
      });
      results.push({
        card,
        earnRate: 0,
        pointValue: valuations[card.pointCurrency] ?? 0,
        centsPerDollar: 0,
        estimatedCentsBack: 0,
        estimatedRewardCad: 0,
        capExhausted: false,
        reason: `Not accepted at ${resolved.brand.name}`,
        matchKind: "network_not_accepted",
        confidence: resolved.certainty,
        effectiveMcc: resolved.mcc,
        displayCategory: resolved.displayCategory,
        warnings: cardWarnings,
        usedPartnership: false,
        valueComponents: [],
      });
      continue;
    }

    // Per-card MCC (Amex may differ).
    const storeForCard = resolveStoreCode(input, card.network);
    const mcc = storeForCard.mcc;
    const brand = storeForCard.brand;
    const displayCategory = storeForCard.displayCategory;

    const picked = pickEarnRule(card, brand, mcc, displayCategory, asOf);
    cardWarnings.push(...picked.warnings);

    if (isExcluded(picked.rule, brand, mcc)) {
      cardWarnings.push({
        kind: "exclusion",
        message: `${card.name}: purchase excluded from bonus rate`,
      });
    }

    const capped = applyCapAndTier(
      card,
      picked.rule,
      displayCategory,
      input.spendToDate,
      input.capGroupSpendToDate,
      input.annualSpendByCard,
    );
    cardWarnings.push(...capped.warnings);

    const pointValue = valuations[card.pointCurrency] ?? 0;
    let earnRate = capped.earnRate;
    let centsPerDollar = earnRate * pointValue;
    let valueComponents: ValueComponent[] = [
      cardEarnComponent(
        card,
        picked.rule.category,
        earnRate,
        pointValue,
        capped.capExhausted,
      ),
    ];
    let usedPartnership = false;
    let partnershipId: string | undefined;
    let reason: string;

    // Partnerships still apply when we have a brand.
    if (brand) {
      const partnered = recommendCardsForMerchant({
        ownedCardIds: [card.id],
        category: brand.category,
        merchantBrandId: brand.id,
        fuelGrade,
        spendToDate: input.spendToDate,
        valuations: input.valuations,
        cards: [card],
        catalog: input.catalog ?? { brands },
      });
      const hit = partnered[0];
      if (hit?.usedPartnership) {
        usedPartnership = true;
        partnershipId = hit.partnership?.id;
        centsPerDollar = hit.centsPerDollar;
        earnRate = hit.earnRate;
        valueComponents = hit.valueComponents;
        reason = hit.reason;
      } else {
        reason = buildMccReason(
          card,
          picked.matchKind,
          picked.rule,
          earnRate,
          pointValue,
          centsPerDollar,
          capped.capExhausted,
          mcc,
          brand,
        );
      }
    } else {
      reason = buildMccReason(
        card,
        picked.matchKind,
        picked.rule,
        earnRate,
        pointValue,
        centsPerDollar,
        capped.capExhausted,
        mcc,
        brand,
      );
    }

    const breakdown = buildValueBreakdown(
      valueComponents,
      input.amountCad,
      ASSUMED_CAD_PER_LITRE,
    );

    results.push({
      card,
      earnRate,
      pointValue,
      centsPerDollar,
      estimatedCentsBack: input.amountCad * centsPerDollar,
      estimatedRewardCad: breakdown.totalCad,
      capExhausted: capped.capExhausted,
      reason,
      matchKind: usedPartnership ? "named_merchant" : picked.matchKind,
      confidence: storeForCard.certainty,
      matchedRule: picked.rule,
      effectiveMcc: mcc,
      displayCategory,
      warnings: cardWarnings,
      usedPartnership,
      partnershipId,
      valueComponents,
    });
  }

  results.sort((a, b) => {
    if (b.centsPerDollar !== a.centsPerDollar) {
      return b.centsPerDollar - a.centsPerDollar;
    }
    if (a.card.annualFee !== b.card.annualFee) {
      return a.card.annualFee - b.card.annualFee;
    }
    return a.card.name.localeCompare(b.card.name);
  });

  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
  const sliced = results.slice(0, limit);

  return {
    purchase: {
      amountCad: input.amountCad,
      mcc: resolved.mcc,
      displayCategory: resolved.displayCategory,
      merchant:
        input.store?.name ??
        resolved.brand?.name ??
        input.store?.merchantQuery ??
        null,
      merchantBrandId: resolved.brand?.id ?? null,
      certainty: resolved.certainty,
      matchKind: resolved.matchKind,
      fuelGrade:
        resolved.displayCategory === "gas" ? fuelGrade : null,
    },
    recommendations: sliced,
    bestCardId: sliced[0]?.card.id ?? null,
    warnings: purchaseWarnings,
  };
}

function buildMccReason(
  card: CreditCard,
  matchKind: MccMatchKind,
  rule: RewardCategory,
  earnRate: number,
  pointValue: number,
  centsPerDollar: number,
  capExhausted: boolean,
  mcc: string | null,
  brand: MerchantBrand | null,
): string {
  const label = CATEGORY_LABELS[rule.category].toLowerCase();
  const earn =
    card.pointCurrency === "cashback"
      ? `${earnRate}% cash back`
      : `${earnRate}× ${card.pointCurrency}`;
  if (capExhausted) {
    return `Bonus cap reached — ${earn} fallback (${centsPerDollar.toFixed(1)}¢/$)`;
  }
  switch (matchKind) {
    case "named_merchant":
      return brand
        ? `${earn} at ${brand.name} (named merchant)`
        : `${earn} on named merchant`;
    case "mcc_list":
      return mcc
        ? `${earn} on MCC ${mcc}`
        : `${earn} on MCC list`;
    case "category_default":
      return `${earn} on ${label} (category default codes)`;
    case "store_type_estimate":
      return `${earn} on ${label} (store-type estimate)`;
    case "user_category":
      return `${earn} on ${label} (category fallback)`;
    case "network_not_accepted":
      return "Network not accepted";
    default:
      return `${earn} base rate on ${label}`;
  }
}

/** Preview a single card at a store/MCC — used by the admin console. */
export function previewCardAtStore(
  input: MccRecommendationInput & { cardId: string },
): MccCardRecommendation | null {
  const result = recommendByMcc({
    ...input,
    ownedCardIds: [input.cardId],
    limit: 1,
  });
  return result.recommendations[0] ?? null;
}

/** Re-export category list so callers don't grow CATEGORIES ad hoc. */
export const DISPLAY_CATEGORIES = CATEGORIES;

/** @deprecated Prefer recommendByMcc; kept for gradual migration of callers. */
export function recommendCardsByCategory(
  input: Parameters<typeof recommendCards>[0],
): Recommendation[] {
  return recommendCards(input);
}
