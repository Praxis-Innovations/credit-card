import {
  CATEGORIES,
  CATEGORY_LABELS,
  CARDS,
  getCardById,
  getMerchantBrandById,
  recommendCards,
  recommendCardsForMerchant,
  type Category,
} from "@northtap/core";
import type {
  ApiErrorBody,
  RecommendationRequest,
  RecommendationResponse,
} from "./api-types";

const CATEGORY_SET = new Set<string>(CATEGORIES);

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORY_SET.has(value);
}

/**
 * In-process recommendation shaping for the Expo app.
 * When `merchantBrandId` is set, uses partnership-aware ranking from core.
 */
export function buildRecommendationResponse(
  input: RecommendationRequest,
): RecommendationResponse | { error: ApiErrorBody["error"]; status: number } {
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
    return {
      status: 400,
      error: {
        code: "bad_request",
        message: "amountCad must be a number greater than 0",
      },
    };
  }

  if (!isCategory(category)) {
    return {
      status: 400,
      error: {
        code: "bad_request",
        message: "category must be a known spend category",
      },
    };
  }

  if (!ownedCardIds || ownedCardIds.length === 0) {
    return {
      status: 422,
      error: {
        code: "empty_wallet",
        message: "Provide ownedCardIds, or sign in so the wallet can be loaded",
      },
    };
  }

  const knownIds = ownedCardIds.filter((id) => Boolean(getCardById(id)));
  const brand = merchantBrandId
    ? getMerchantBrandById(merchantBrandId)
    : undefined;
  const effectiveCategory = brand?.category ?? category;

  const emptyPurchase = {
    amountCad,
    category: effectiveCategory,
    merchant: merchant?.trim()
      ? merchant.trim()
      : brand?.name ?? null,
    merchantBrandId: brand?.id ?? null,
  } as const;

  if (knownIds.length === 0) {
    const empty: RecommendationResponse = {
      purchase: emptyPurchase,
      recommendations: [],
      bestCardId: null,
    };
    return empty;
  }

  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
  const ranked = brand
    ? recommendCardsForMerchant({
        ownedCardIds: knownIds,
        category: brand.category,
        merchantBrandId: brand.id,
        spendToDate,
        valuations,
        cards: CARDS,
      })
    : recommendCards({
        ownedCardIds: knownIds,
        category: effectiveCategory,
        spendToDate,
        valuations,
        cards: CARDS,
      }).map((rec) => ({
        ...rec,
        usedPartnership: false as const,
        partnership: undefined,
      }));

  const label = CATEGORY_LABELS[effectiveCategory].toLowerCase();
  const where =
    merchant?.trim() ||
    brand?.name ||
    label;
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
