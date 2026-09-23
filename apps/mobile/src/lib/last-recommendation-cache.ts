import type { RecommendationResponse } from "./api-types";
import { LAST_RECOMMENDATION_CACHE_KEY } from "./storage-keys";
import { ssrSafeStorage } from "./ssr-safe-storage";

/**
 * Cache the last successful /v1/recommendations response for offline display.
 * No on-device re-ranking — avoids client/server ranking drift.
 */

export async function loadLastRecommendation(): Promise<RecommendationResponse | null> {
  try {
    const raw = await ssrSafeStorage.getItem(LAST_RECOMMENDATION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecommendationResponse;
    if (!parsed || !Array.isArray(parsed.recommendations)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveLastRecommendation(
  response: RecommendationResponse,
): Promise<void> {
  await ssrSafeStorage.setItem(
    LAST_RECOMMENDATION_CACHE_KEY,
    JSON.stringify(response),
  );
}

export async function clearLastRecommendation(): Promise<void> {
  await ssrSafeStorage.removeItem(LAST_RECOMMENDATION_CACHE_KEY);
}
