import { fetchRecommendation } from "./api-client";
import {
  CATEGORIES,
  type ApiErrorBody,
  type Category,
  type RecommendationRequest,
  type RecommendationResponse,
} from "./api-types";
import {
  loadLastRecommendation,
  saveLastRecommendation,
} from "./last-recommendation-cache";
import type { StoreChoice } from "./stores";

const CATEGORY_SET = new Set<string>(CATEGORIES);

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORY_SET.has(value);
}

export type RecommendResult =
  | {
      response: RecommendationResponse;
      /** The store the response is for (the cached one when stale). */
      store: StoreChoice | null;
      stale: boolean;
    }
  | { error: ApiErrorBody["error"]; status: number };

/**
 * Request for a picked store: amount + store identity only.
 * Nearby/browse/search send `merchantQuery` (and `osmTag` when known).
 * Bare category chips send `categoryFallback`. In-store is assumed.
 */
export function recommendationRequestFor(
  store: Pick<StoreChoice, "name" | "category" | "osmTag" | "source">,
  amountCad: number,
  ownedCardIds: string[],
): RecommendationRequest {
  if (store.source === "category") {
    return {
      amountCad,
      categoryFallback: store.category,
      ownedCardIds,
      limit: 10,
    };
  }
  return {
    amountCad,
    merchantQuery: store.name,
    ...(store.osmTag ? { osmTag: store.osmTag } : {}),
    ...(store.source === "search" ? { categoryFallback: store.category } : {}),
    ownedCardIds,
    limit: 10,
  };
}

function isNetworkFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const e = err as Error & { status?: number };
  if (typeof e.status === "number") return false;
  if (e.name === "TypeError") return true;
  return /network|fetch|offline|failed to fetch|load failed/i.test(e.message);
}

function hasStoreIdentity(input: RecommendationRequest): boolean {
  return Boolean(
    input.merchantQuery?.trim() ||
      input.osmTag?.trim() ||
      input.merchant?.trim() ||
      input.categoryFallback,
  );
}

function validateRecommendationRequest(
  input: RecommendationRequest,
): Extract<RecommendResult, { error: ApiErrorBody["error"] }> | null {
  const { amountCad, ownedCardIds } = input;

  if (typeof amountCad !== "number" || !(amountCad > 0) || !Number.isFinite(amountCad)) {
    return {
      status: 400,
      error: { code: "bad_request", message: "amountCad must be a number greater than 0" },
    };
  }

  if (!hasStoreIdentity(input)) {
    return {
      status: 400,
      error: {
        code: "bad_request",
        message: "Provide merchantQuery/osmTag or categoryFallback",
      },
    };
  }

  if (
    input.categoryFallback !== undefined &&
    !isCategory(input.categoryFallback)
  ) {
    return {
      status: 400,
      error: { code: "bad_request", message: "categoryFallback must be a known spend category" },
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

  return null;
}

async function recommendationFromNetworkFailure(
  err: unknown,
): Promise<RecommendResult> {
  if (isNetworkFailure(err)) {
    const cached = await loadLastRecommendation();
    if (cached) return { ...cached, stale: true };
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

/**
 * Prefer apps/api server-side ranking. On network failure, show the last
 * successful response labeled stale — no on-device re-ranking.
 */
export async function requestRecommendation(
  input: RecommendationRequest,
  store: StoreChoice | null = null,
): Promise<RecommendResult> {
  const invalid = validateRecommendationRequest(input);
  if (invalid) return invalid;

  try {
    const response = await fetchRecommendation(input);
    await saveLastRecommendation({ response, store });
    return { response, store, stale: false };
  } catch (err) {
    return recommendationFromNetworkFailure(err);
  }
}
