import {
  CATEGORIES,
  CATEGORY_LABELS,
  recommendCards,
  type Category,
  type CreditCard,
} from "@northtap/core";
import { fetchRecommendation } from "./api-client";
import type {
  ApiErrorBody,
  RecommendationRequest,
  RecommendationResponse,
} from "./api-types";
import {
  loadWalletCardCache,
  mergeWalletCardCache,
} from "./wallet-card-cache";

const CATEGORY_SET = new Set<string>(CATEGORIES);

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORY_SET.has(value);
}

export type RecommendResult =
  | (RecommendationResponse & { offline?: boolean })
  | { error: ApiErrorBody["error"]; status: number };

function isNetworkFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const e = err as Error & { status?: number };
  // api-client only sets status on HTTP error responses; bare fetch failures
  // (airplane mode, DNS, timeout) throw TypeError / network Error with no status.
  if (typeof e.status === "number") return false;
  if (e.name === "TypeError") return true;
  return /network|fetch|offline|failed to fetch|load failed/i.test(e.message);
}

/**
 * Category-only local ranking against the cached wallet card snapshots.
 * No merchant-partnership awareness — intentional weak-signal fallback.
 */
export function rankOfflineFromCache(
  input: RecommendationRequest,
  cachedCards: CreditCard[],
): RecommendationResponse | { error: ApiErrorBody["error"]; status: number } {
  const {
    amountCad,
    category,
    merchant,
    ownedCardIds,
    spendToDate,
    valuations,
  } = input;

  if (!ownedCardIds || ownedCardIds.length === 0) {
    return {
      status: 422,
      error: {
        code: "empty_wallet",
        message: "Provide ownedCardIds from the local wallet",
      },
    };
  }

  const owned = new Set(ownedCardIds);
  const cards = cachedCards.filter((c) => owned.has(c.id));
  const knownIds = cards.map((c) => c.id);

  const emptyPurchase = {
    amountCad,
    category,
    merchant: merchant?.trim() ? merchant.trim() : null,
    merchantBrandId: null as string | null,
  };

  if (knownIds.length === 0) {
    return {
      status: 503,
      error: {
        code: "offline_cache_miss",
        message:
          "No network and no cached wallet cards yet — connect once to warm the offline cache",
      },
    };
  }

  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
  const ranked = recommendCards({
    ownedCardIds: knownIds,
    category,
    spendToDate,
    valuations,
    cards,
  });

  const label = CATEGORY_LABELS[category].toLowerCase();
  const whereLabel = merchant?.trim()
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
      ? `${rec.card.name} gives ${earnBit} on ${label} — best for this $${amountCad.toFixed(2)} purchase at ${whereLabel} (~$${estimatedRewardCad.toFixed(2)} back) [offline]`
      : `${rec.reason} — ~$${estimatedRewardCad.toFixed(2)} back on this $${amountCad.toFixed(2)} purchase [offline]`;

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
      usedPartnership: false,
    };
  });

  return {
    purchase: emptyPurchase,
    recommendations,
    bestCardId: recommendations[0]?.card.id ?? null,
  };
}

/**
 * Prefer apps/api server-side ranking. On network failure, fall back to
 * category-only `recommendCards()` against the cached wallet card snapshots.
 *
 * Wallet ownership itself never goes through apps/api — callers always pass
 * `ownedCardIds` loaded from Supabase RLS or local guest storage.
 */
export async function requestRecommendation(
  input: RecommendationRequest,
): Promise<RecommendResult> {
  const { amountCad, category, ownedCardIds } = input;

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
        message: "Provide ownedCardIds from the local wallet (Supabase or guest)",
      },
    };
  }

  try {
    const result = await fetchRecommendation(input);
    await mergeWalletCardCache(
      result.recommendations.map((r) => r.card),
      ownedCardIds,
    );
    return result;
  } catch (err) {
    if (isNetworkFailure(err)) {
      const cached = await loadWalletCardCache();
      const offline = rankOfflineFromCache(input, cached);
      if ("error" in offline) return offline;
      return { ...offline, offline: true };
    }

    const e = err as Error & { status?: number; code?: string };
    return {
      status: e.status ?? 502,
      error: {
        code: e.code ?? "bad_gateway",
        message: e.message || "Recommendation request failed",
      },
    };
  }
}

/** @deprecated Use requestRecommendation */
export const buildRecommendationResponse = requestRecommendation;
