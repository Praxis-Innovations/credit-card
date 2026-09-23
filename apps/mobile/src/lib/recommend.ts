import { fetchRecommendation } from "./api-client";
import {
  CATEGORIES,
  type Category,
  type RecommendationRequest,
  type RecommendationResponse,
  type ApiErrorBody,
} from "./api-types";
import {
  loadLastRecommendation,
  saveLastRecommendation,
} from "./last-recommendation-cache";

const CATEGORY_SET = new Set<string>(CATEGORIES);

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORY_SET.has(value);
}

export type RecommendResult =
  | (RecommendationResponse & { stale?: boolean })
  | { error: ApiErrorBody["error"]; status: number };

function isNetworkFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const e = err as Error & { status?: number };
  if (typeof e.status === "number") return false;
  if (e.name === "TypeError") return true;
  return /network|fetch|offline|failed to fetch|load failed/i.test(e.message);
}

/**
 * Prefer apps/api server-side ranking. On network failure, show the last
 * successful response labeled stale — no on-device re-ranking.
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
    await saveLastRecommendation(result);
    return result;
  } catch (err) {
    if (isNetworkFailure(err)) {
      const cached = await loadLastRecommendation();
      if (cached) {
        return { ...cached, stale: true };
      }
      return {
        status: 503,
        error: {
          code: "offline_cache_miss",
          message:
            "No network and no cached recommendation yet — connect once to warm the offline cache",
        },
      };
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
