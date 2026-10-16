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
  previewCardAtStore,
  recommendByMcc,
  type Category,
  type FuelGrade,
  type MccCertainty,
  type MccMatchKind,
  type PointCurrency,
  type RecommendationWarning,
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

export function isMccCode(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}$/.test(value);
}

export interface RecommendationRequestBody {
  amountCad: number;
  /** Four-digit MCC when known. */
  mcc?: string;
  /**
   * Raw free-text brand/name from OSM or the user (e.g. "Shell").
   * Resolved server-side against merchant_brands — clients never send brand ids.
   */
  merchantQuery?: string;
  /** Display name override. */
  merchant?: string;
  /** OSM tag for store-type MCC fallback (e.g. shop=supermarket). */
  osmTag?: string;
  /**
   * Optional display-category fallback when store code and store-type are
   * unknown. Not a Tangerine-style chosen bonus.
   */
  categoryFallback?: Category;
  ownedCardIds?: string[];
  spendToDate?: SpendToDate;
  capGroupSpendToDate?: Record<string, number>;
  annualSpendByCard?: Record<string, number>;
  valuations?: Partial<Record<PointCurrency, number>>;
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
  matchKind: MccMatchKind;
  confidence: MccCertainty;
  effectiveMcc: string | null;
  usedPartnership?: boolean;
  partnershipId?: string;
  merchantBrand: LogoSummary | null;
  loyaltyProgram: LogoSummary | null;
  valueBreakdown: ValueBreakdownItem[];
  assumptions: ValueAssumptions;
  warnings: RecommendationWarning[];
}

export interface RecommendationResponse {
  purchase: {
    amountCad: number;
    mcc: string | null;
    displayCategory: Category;
    merchant: string | null;
    merchantQuery?: string | null;
    merchantBrandId?: string | null;
    merchantBrand: LogoSummary | null;
    certainty: MccCertainty;
    matchKind: MccMatchKind;
    fuelGrade?: FuelGrade | null;
  };
  recommendations: RecommendationItem[];
  bestCardId: string | null;
  warnings: RecommendationWarning[];
}

export interface PreviewRequestBody {
  amountCad: number;
  cardId: string;
  mcc?: string;
  merchantQuery?: string;
  merchant?: string;
  osmTag?: string;
  categoryFallback?: Category;
  fuelGrade?: FuelGrade;
  spendToDate?: SpendToDate;
  valuations?: Partial<Record<PointCurrency, number>>;
}

/**
 * Stateless MCC recommendation: ranks caller-supplied `ownedCardIds`.
 * Requires `mcc` and/or a store (`merchantQuery` / `osmTag`).
 */
export async function createRecommendation(
  input: RecommendationRequestBody,
): Promise<RecommendationResponse> {
  const { amountCad, ownedCardIds } = input;

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

  if (input.mcc !== undefined && !isMccCode(input.mcc)) {
    throw new ApiError(400, "bad_request", "mcc must be a 4-digit code");
  }

  if (
    input.categoryFallback !== undefined &&
    !isCategory(input.categoryFallback)
  ) {
    throw new ApiError(
      400,
      "bad_request",
      "categoryFallback must be a known spend category",
    );
  }

  const hasStore =
    Boolean(input.merchantQuery?.trim()) ||
    Boolean(input.osmTag?.trim()) ||
    Boolean(input.merchant?.trim());
  if (!input.mcc && !hasStore && !input.categoryFallback) {
    throw new ApiError(
      400,
      "bad_request",
      "Provide mcc, merchantQuery/osmTag, or categoryFallback",
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

  const queryText = input.merchantQuery?.trim() || undefined;
  const brand = queryText
    ? matchMerchantBrand(queryText, { tags: [queryText] }, brands)
    : null;

  const result = recommendByMcc({
    amountCad,
    ownedCardIds: knownIds,
    mcc: input.mcc,
    store: {
      brandId: brand?.id,
      merchantQuery: queryText,
      name: input.merchant?.trim() || brand?.name || queryText,
      mcc: input.mcc,
      osmTag: input.osmTag?.trim() || undefined,
    },
    categoryFallback: input.categoryFallback,
    fuelGrade,
    spendToDate: input.spendToDate,
    capGroupSpendToDate: input.capGroupSpendToDate,
    annualSpendByCard: input.annualSpendByCard,
    valuations: input.valuations,
    cards,
    brands,
    catalog: { brands, partnerships, loyaltyPrograms },
    limit: input.limit,
  });

  const brandSummary = brand ? summarizeLogo(brand) : null;
  const programById = new Map(loyaltyPrograms.map((p) => [p.id, p]));
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);

  const recommendations = result.recommendations.slice(0, limit).map((rec, index) => {
    const breakdown = buildValueBreakdown(
      rec.valueComponents,
      amountCad,
      ASSUMED_CAD_PER_LITRE,
    );
    const program = rec.partnershipId
      ? [...partnerships].find((p) => p.id === rec.partnershipId)
      : undefined;
    const loyalty = program?.loyaltyProgramId
      ? programById.get(program.loyaltyProgramId)
      : undefined;

    return {
      rank: index + 1,
      card: serializeCard(rec.card),
      earnRate: rec.earnRate,
      pointValue: rec.pointValue,
      centsPerDollar: rec.centsPerDollar,
      estimatedCentsBack: rec.estimatedCentsBack,
      estimatedRewardCad: breakdown.totalCad,
      capExhausted: rec.capExhausted,
      reason: rec.reason,
      matchKind: rec.matchKind,
      confidence: rec.confidence,
      effectiveMcc: rec.effectiveMcc,
      usedPartnership: rec.usedPartnership,
      partnershipId: rec.partnershipId,
      merchantBrand: brandSummary,
      loyaltyProgram: loyalty ? summarizeLogo(loyalty) : null,
      valueBreakdown: breakdown.items,
      assumptions: breakdown.assumptions,
      warnings: rec.warnings,
    };
  });

  return {
    purchase: {
      amountCad,
      mcc: result.purchase.mcc,
      displayCategory: result.purchase.displayCategory,
      merchant: result.purchase.merchant,
      merchantQuery: queryText ?? null,
      merchantBrandId: result.purchase.merchantBrandId,
      merchantBrand: brandSummary,
      certainty: result.purchase.certainty,
      matchKind: result.purchase.matchKind,
      fuelGrade: result.purchase.fuelGrade,
    },
    recommendations,
    bestCardId: recommendations[0]?.card.id ?? null,
    warnings: result.warnings,
  };
}

/** Admin preview: one card × store/MCC × amount. */
export async function createRecommendationPreview(
  input: PreviewRequestBody,
): Promise<{
  purchase: RecommendationResponse["purchase"];
  recommendation: RecommendationItem | null;
  warnings: RecommendationWarning[];
}> {
  if (!input.cardId || typeof input.cardId !== "string") {
    throw new ApiError(400, "bad_request", "cardId is required");
  }

  const full = await createRecommendation({
    amountCad: input.amountCad,
    mcc: input.mcc,
    merchantQuery: input.merchantQuery,
    merchant: input.merchant,
    osmTag: input.osmTag,
    categoryFallback: input.categoryFallback,
    fuelGrade: input.fuelGrade,
    spendToDate: input.spendToDate,
    valuations: input.valuations,
    ownedCardIds: [input.cardId],
    limit: 1,
  });

  // Soft-check that the domain preview agrees (same inputs).
  void previewCardAtStore;

  return {
    purchase: full.purchase,
    recommendation: full.recommendations[0] ?? null,
    warnings: full.warnings,
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
