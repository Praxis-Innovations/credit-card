import {
  CATEGORIES,
  CATEGORY_LABELS,
  ISSUERS,
  POINT_CURRENCIES,
  recommendCards,
  recommendCardsForMerchant,
  type Category,
  type CreditCard,
  type PointCurrency,
  type SpendToDate,
} from "@northtap/core";
import { ApiError } from "./errors";
import {
  getMerchantBrand,
  listAllVerifiedBrands,
  listAllVerifiedCards,
  listAllVerifiedPartnerships,
  listLoyaltyPrograms,
} from "./catalog";

const CATEGORY_SET = new Set<string>(CATEGORIES);

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORY_SET.has(value);
}

export interface RecommendationRequestBody {
  amountCad: number;
  category: Category;
  merchant?: string;
  merchantBrandId?: string;
  ownedCardIds?: string[];
  spendToDate?: SpendToDate;
  valuations?: Partial<Record<PointCurrency, number>>;
  limit?: number;
}

export interface RecommendationItem {
  rank: number;
  card: CreditCard;
  earnRate: number;
  pointValue: number;
  centsPerDollar: number;
  estimatedCentsBack: number;
  estimatedRewardCad: number;
  capExhausted: boolean;
  reason: string;
  usedPartnership?: boolean;
  partnershipId?: string;
}

export interface RecommendationResponse {
  purchase: {
    amountCad: number;
    category: Category;
    merchant: string | null;
    merchantBrandId?: string | null;
  };
  recommendations: RecommendationItem[];
  bestCardId: string | null;
}

/**
 * Stateless recommendation: ranks caller-supplied `ownedCardIds` by invoking
 * `@northtap/core` server-side. Never loads `user_cards` or inspects identity.
 */
export async function createRecommendation(
  input: RecommendationRequestBody,
): Promise<RecommendationResponse> {
  const {
    amountCad,
    category,
    merchant,
    merchantBrandId,
    ownedCardIds,
    spendToDate,
    valuations,
  } = input;

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

  const brand = merchantBrandId
    ? await getMerchantBrand(merchantBrandId)
    : null;
  if (merchantBrandId && !brand) {
    throw new ApiError(
      400,
      "bad_request",
      `Unknown merchantBrandId: ${merchantBrandId}`,
    );
  }

  const effectiveCategory = brand?.category ?? category;
  const emptyPurchase = {
    amountCad,
    category: effectiveCategory,
    merchant: merchant?.trim()
      ? merchant.trim()
      : (brand?.name ?? null),
    merchantBrandId: brand?.id ?? null,
  } as const;

  if (knownIds.length === 0) {
    return {
      purchase: emptyPurchase,
      recommendations: [],
      bestCardId: null,
    };
  }

  const [brands, partnerships, loyaltyPrograms] = await Promise.all([
    listAllVerifiedBrands(),
    listAllVerifiedPartnerships(),
    listLoyaltyPrograms(),
  ]);

  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
  const ranked = brand
    ? recommendCardsForMerchant({
        ownedCardIds: knownIds,
        category: brand.category,
        merchantBrandId: brand.id,
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
  const where = merchant?.trim() || brand?.name || label;
  const whereLabel = merchant?.trim()
    ? `${merchant.trim()} (${label})`
    : brand
      ? `${brand.name} (${label})`
      : label;

  const recommendations = ranked.slice(0, limit).map((rec, index) => {
    const estimatedCentsBack = amountCad * rec.centsPerDollar;
    const estimatedRewardCad = estimatedCentsBack / 100;
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

    return {
      rank: index + 1,
      card: rec.card,
      earnRate: rec.earnRate,
      pointValue: rec.pointValue,
      centsPerDollar: rec.centsPerDollar,
      estimatedCentsBack,
      estimatedRewardCad,
      capExhausted: rec.capExhausted,
      reason,
      usedPartnership,
      partnershipId:
        usedPartnership && "partnership" in rec
          ? rec.partnership?.id
          : undefined,
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
