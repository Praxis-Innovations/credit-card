import {
  CATEGORIES,
  CATEGORY_LABELS,
  CARDS,
  getCardById,
  recommendCards,
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
 * In-process implementation of POST /v1/recommendations (OpenAPI).
 * Shapes recommendation responses for the mobile UI — calls recommendCards()
 * from @northtap/core; no network hop required in Expo.
 */
export function buildRecommendationResponse(
  input: RecommendationRequest,
): RecommendationResponse | { error: ApiErrorBody["error"]; status: number } {
  const { amountCad, category, merchant, ownedCardIds, spendToDate, valuations } =
    input;

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
  const emptyPurchase = {
    amountCad,
    category,
    merchant: merchant?.trim() ? merchant.trim() : null,
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
  const ranked = recommendCards({
    ownedCardIds: knownIds,
    category,
    spendToDate,
    valuations,
    cards: CARDS,
  });

  const label = CATEGORY_LABELS[category].toLowerCase();
  const where = merchant?.trim()
    ? `${merchant.trim()} (${label})`
    : label;

  const recommendations = ranked.slice(0, limit).map((rec, index) => {
    const estimatedCentsBack = amountCad * rec.centsPerDollar;
    const estimatedRewardCad = estimatedCentsBack / 100;
    const isTop = index === 0;
    const earnBit =
      rec.card.pointCurrency === "cashback"
        ? `${rec.earnRate}% cash back`
        : `${rec.earnRate}× ${rec.card.pointCurrency}`;
    const reason = isTop
      ? `${rec.card.name} gives ${earnBit} on ${label} — best for this $${amountCad.toFixed(2)} purchase at ${where} (~$${estimatedRewardCad.toFixed(2)} back)`
      : `${rec.reason} — ~$${estimatedRewardCad.toFixed(2)} back on this $${amountCad.toFixed(2)} purchase`;

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
    };
  });

  return {
    purchase: {
      amountCad,
      category,
      merchant: merchant?.trim() ? merchant.trim() : null,
    },
    recommendations,
    bestCardId: recommendations[0]?.card.id ?? null,
  };
}
