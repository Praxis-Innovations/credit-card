import { fetchPartnership } from "./api-client";
import type { Partnership } from "./api-types";
import { PARTNERSHIP_CACHE_KEY } from "./storage-keys";
import { ssrSafeStorage } from "./ssr-safe-storage";

async function readCache(): Promise<Record<string, Partnership>> {
  try {
    const raw = await ssrSafeStorage.getItem(PARTNERSHIP_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, Partnership>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Partnership details for the result screen. Network first; falls back to the
 * last copy we saw so the "before you pay" note still shows offline.
 */
export async function loadPartnership(id: string): Promise<Partnership | null> {
  try {
    const partnership = await fetchPartnership(id);
    const cache = await readCache();
    cache[id] = partnership;
    await ssrSafeStorage.setItem(PARTNERSHIP_CACHE_KEY, JSON.stringify(cache));
    return partnership;
  } catch {
    const cache = await readCache();
    return cache[id] ?? null;
  }
}
