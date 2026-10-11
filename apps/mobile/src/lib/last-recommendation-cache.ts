import type { RecommendationResponse } from "./api-types";
import { LAST_RECOMMENDATION_CACHE_KEY } from "./storage-keys";
import type { StoreChoice } from "./stores";
import { ssrSafeStorage } from "./ssr-safe-storage";

/**
 * The last successful /v1/recommendations response and the store it was for,
 * kept for offline display. No on-device re-ranking — avoids client/server
 * ranking drift.
 */
export interface CachedRecommendation {
  response: RecommendationResponse;
  store: StoreChoice | null;
}

export async function loadLastRecommendation(): Promise<CachedRecommendation | null> {
  try {
    const raw = await ssrSafeStorage.getItem(LAST_RECOMMENDATION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRecommendation;
    if (!parsed?.response || !Array.isArray(parsed.response.recommendations)) return null;
    return { response: parsed.response, store: parsed.store ?? null };
  } catch {
    return null;
  }
}

export async function saveLastRecommendation(entry: CachedRecommendation): Promise<void> {
  await ssrSafeStorage.setItem(LAST_RECOMMENDATION_CACHE_KEY, JSON.stringify(entry));
}

export async function clearLastRecommendation(): Promise<void> {
  await ssrSafeStorage.removeItem(LAST_RECOMMENDATION_CACHE_KEY);
}
