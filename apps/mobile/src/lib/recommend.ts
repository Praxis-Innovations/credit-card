import { CATEGORIES, type Category } from "@northtap/core";
import { fetchRecommendation } from "./api-client";
import type {
  ApiErrorBody,
  RecommendationRequest,
  RecommendationResponse,
} from "./api-types";

const CATEGORY_SET = new Set<string>(CATEGORIES);

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORY_SET.has(value);
}

export type RecommendResult =
  | RecommendationResponse
  | { error: ApiErrorBody["error"]; status: number };

/**
 * Client-side validation + HTTP call to apps/api POST /v1/recommendations.
 * Ranking and catalog data live on the API (Supabase / seeded catalog).
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
        message: "Provide ownedCardIds, or sign in so the wallet can be loaded",
      },
    };
  }

  try {
    return await fetchRecommendation(input);
  } catch (err) {
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

/** @deprecated Use requestRecommendation — kept for call-site clarity during migrate. */
export const buildRecommendationResponse = requestRecommendation;
