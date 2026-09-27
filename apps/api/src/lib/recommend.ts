import {
  ASSUMED_CAD_PER_LITRE,
  CATEGORIES,
  CATEGORY_LABELS,
  DEFAULT_FUEL_GRADE,
  FUEL_GRADES,
  ISSUERS,
  POINT_CURRENCIES,
  buildValueBreakdown,
  matchMerchantBrand,
  recommendCards,
  recommendCardsForMerchant,
  type Category,
  type FuelGrade,
  type PointCurrency,
  type SpendToDate,
  type ValueAssumptions,
  type ValueBreakdownItem,
} from "@/domain";
import { ApiError } from "./errors";
import {
  listAllVerifiedBrands,
  listAllVerifiedCards,
  listAllVerifiedPartnerships,
  listLoyaltyPrograms,
} from "./catalog";
import {
  serializeCard,
  summarizeLogo,
  type CardResponse,
  type LogoSummary,
} from "./serialize";

const CATEGORY_SET = new Set<string>(CATEGORIES);

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORY_SET.has(value);
}

const FUEL_GRADE_SET = new Set<string>(FUEL_GRADES);

export function isFuelGrade(value: unknown): value is FuelGrade {
  return typeof value === "string" && FUEL_GRADE_SET.has(value);
}

export interface RecommendationRequestBody {
  amountCad: number;
  category: Category;
  merchant?: string;
  /**
   * Raw free-text brand/name from OSM or the user (e.g. "Shell").
   * Resolved server-side against merchant_brands — clients never send brand ids.
   */
  merchantQuery?: string;
  ownedCardIds?: string[];
  spendToDate?: SpendToDate;
  valuations?: Partial<Record<PointCurrency, number>>;
  /** Grade being pumped; premium unlocks grade-scoped benefits (e.g. Shell V-Power). */
  fuelGrade?: FuelGrade;
  limit?: number;
}

export interface RecommendationItem {
  rank: number;
  card: CardResponse;
  earnRate: number;
  pointValue: number;
  centsPerDollar: number;
  estimatedCentsBack: number;
  estimatedRewardCad: number;
  capExhausted: boolean;
  reason: string;
  usedPartnership?: boolean;
  partnershipId?: string;
  /** Brand resolved from merchantQuery, else null. */
  merchantBrand: LogoSummary | null;
  /** Loyalty program of the partnership that drove this item, else null. */
  loyaltyProgram: LogoSummary | null;
  /** Dollar lines that sum exactly to estimatedRewardCad. */
  valueBreakdown: ValueBreakdownItem[];
  assumptions: ValueAssumptions;
}

export interface RecommendationResponse {
  purchase: {
    amountCad: number;
    category: Category;
    merchant: string | null;
    merchantQuery?: string | null;
    /** Resolved catalog brand id when merchantQuery matched, else null. */
    merchantBrandId?: string | null;
    merchantBrand: LogoSummary | null;
    /** Fuel grade applied for gas purchases, else null. */
    fuelGrade?: FuelGrade | null;
  };
  recommendations: RecommendationItem[];
  bestCardId: string | null;
}

/**
 * Stateless recommendation: ranks caller-supplied `ownedCardIds` by invoking
 * the API-owned domain engine. Never loads `user_cards` or inspects identity.
 * Resolves optional `merchantQuery` against the merchant brand catalog.
 */
export async function createRecommendation(
  input: RecommendationRequestBody,
): Promise<RecommendationResponse> {
  const {
    amountCad,
    category,
    merchant,
    merchantQuery,
    ownedCardIds,
    spendToDate,
    valuations,
  } = input;

  if (input.fuelGrade !== undefined && !isFuelGrade(input.fuelGrade)) {
    throw new ApiError(
      400,
      "bad_request",
      `fuelGrade must be one of: ${FUEL_GRADES.join(", ")}`,
    );
  }
  const fuelGrade = input.fuelGrade ?? DEFAULT_FUEL_GRADE;

  if (
    typeof amountCad !== "number" ||
    !(amountCad > 0) ||
    !Number.isFinite(amountCad)
  ) {
    throw new ApiError(
      400,
      "bad_request",
      "amountCad must be a number greater than 0",
    );
  }

  if (!isCategory(category)) {
    throw new ApiError(
      400,
      "bad_request",
      "category must be a known spend category",
    );
  }

  if (!ownedCardIds || ownedCardIds.length === 0) {
    throw new ApiError(
      422,
      "empty_wallet",
      "Provide ownedCardIds with at least one card id",
    );
  }

  const cards = await listAllVerifiedCards();
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const knownIds = ownedCardIds.filter((id) => cardById.has(id));

  const [brands, partnerships, loyaltyPrograms] = await Promise.all([
    listAllVerifiedBrands(),
    listAllVerifiedPartnerships(),
    listLoyaltyPrograms(),
  ]);

  const queryText = merchantQuery?.trim() || undefined;
  const brand = queryText
    ? matchMerchantBrand(queryText, { tags: [queryText] }, brands)
    : null;

  const effectiveCategory = brand?.category ?? category;
  const displayMerchant =
    merchant?.trim() || brand?.name || queryText || null;
  const brandSummary = brand ? summarizeLogo(brand) : null;
  const programById = new Map(loyaltyPrograms.map((p) => [p.id, p]));

  const emptyPurchase = {
    amountCad,
    category: effectiveCategory,
    merchant: displayMerchant,
    merchantQuery: queryText ?? null,
    merchantBrandId: brand?.id ?? null,
    merchantBrand: brandSummary,
    fuelGrade: effectiveCategory === "gas" ? fuelGrade : null,
  } as const;

  if (knownIds.length === 0) {
    return {
      purchase: emptyPurchase,
      recommendations: [],
      bestCardId: null,
    };
  }

  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
  const ranked = brand
    ? recommendCardsForMerchant({
        ownedCardIds: knownIds,
        category: brand.category,
        merchantBrandId: brand.id,
        fuelGrade,
        spendToDate,
        valuations,
        cards,
        catalog: { brands, partnerships, loyaltyPrograms },
      })
    : recommendCards({
        ownedCardIds: knownIds,
        category: effectiveCategory,
        spendToDate,
        valuations,
        cards,
      }).map((rec) => ({
        ...rec,
        usedPartnership: false as const,
        partnership: undefined,
      }));

  const label = CATEGORY_LABELS[effectiveCategory].toLowerCase();
  const where = displayMerchant || label;
  const whereLabel = displayMerchant
    ? `${displayMerchant} (${label})`
    : label;

  const recommendations = ranked.slice(0, limit).map((rec, index) => {
    const estimatedCentsBack = amountCad * rec.centsPerDollar;
    const breakdown = buildValueBreakdown(
      rec.valueComponents,
      amountCad,
      ASSUMED_CAD_PER_LITRE,
    );
    const estimatedRewardCad = breakdown.totalCad;
    const isTop = index === 0;
    const usedPartnership =
      "usedPartnership" in rec && rec.usedPartnership === true;

    let reason: string;
    if (usedPartnership) {
      reason = isTop
        ? `${rec.reason} — best for this $${amountCad.toFixed(2)} at ${where} (~$${estimatedRewardCad.toFixed(2)} back)`
        : `${rec.reason} — ~$${estimatedRewardCad.toFixed(2)} back on this $${amountCad.toFixed(2)} purchase`;
    } else {
      const earnBit =
        rec.card.pointCurrency === "cashback"
          ? `${rec.earnRate}% cash back`
          : `${rec.earnRate}× ${rec.card.pointCurrency}`;
      reason = isTop
        ? `${rec.card.name} gives ${earnBit} on ${label} — best for this $${amountCad.toFixed(2)} purchase at ${whereLabel} (~$${estimatedRewardCad.toFixed(2)} back)`
        : `${rec.reason} — ~$${estimatedRewardCad.toFixed(2)} back on this $${amountCad.toFixed(2)} purchase`;
    }

    const partnership =
      usedPartnership && "partnership" in rec ? rec.partnership : undefined;
    const program = partnership?.loyaltyProgramId
      ? programById.get(partnership.loyaltyProgramId)
      : undefined;

    return {
      rank: index + 1,
      card: serializeCard(rec.card),
      earnRate: rec.earnRate,
      pointValue: rec.pointValue,
      centsPerDollar: rec.centsPerDollar,
      estimatedCentsBack,
      estimatedRewardCad,
      capExhausted: rec.capExhausted,
      reason,
      usedPartnership,
      partnershipId: partnership?.id,
      merchantBrand: brandSummary,
      loyaltyProgram: program ? summarizeLogo(program) : null,
      valueBreakdown: breakdown.items,
      assumptions: breakdown.assumptions,
    };
  });

  return {
    purchase: emptyPurchase,
    recommendations,
    bestCardId: recommendations[0]?.card.id ?? null,
  };
}

export function listCategoriesResponse() {
  return {
    categories: CATEGORIES.map((id) => ({
      id,
      label: CATEGORY_LABELS[id],
    })),
  };
}

export function listIssuersResponse() {
  return { issuers: [...ISSUERS] };
}

export function listPointCurrenciesResponse() {
  return { pointCurrencies: [...POINT_CURRENCIES] };
}
